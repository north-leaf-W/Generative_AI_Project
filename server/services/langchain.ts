import { ChatOpenAI } from "@langchain/openai";
import { Response } from 'express';
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { TavilySearch } from "@langchain/tavily";
import { createClient } from '@supabase/supabase-js';
import { AlibabaTongyiEmbeddings } from '../utils/aliyun-embeddings.js';
import { AlibabaTongyiRerank } from '../utils/aliyun-rerank.js';

// 初始化 Supabase 客户端 (用于RAG检索)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// 初始化 Embedding 模型
const embeddings = new AlibabaTongyiEmbeddings();
// 初始化 Rerank 模型
const reranker = new AlibabaTongyiRerank();

// 创建阿里云DashScope模型的LangChain实例
export const createDashScopeModel = () => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const model = process.env.DASHSCOPE_MODEL || 'qwen-turbo';

  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY is not configured');
  }

  console.log(`Creating DashScope model instance with model: ${model}`);

  return new ChatOpenAI({
    modelName: model,
    apiKey: apiKey,
    configuration: {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    },
    streaming: true,
    temperature: 0.7,
    maxTokens: 2000,
  });
};

// 创建流式响应处理器
export const createStreamHandler = (res: Response, append: (t: string) => void, resolve: (text: string) => void) => {
  return {
    handleLLMNewToken(token: string) {
      try {
        append(token);
        const response = { token, timestamp: new Date().toISOString() };
        res.write(`data: ${JSON.stringify(response)}\n\n`);
      } catch (error) {
        console.error('Error writing token to stream:', error);
      }
    },
    handleLLMError(error: Error) {
      console.error('LLM Error:', error);
    },
    handleLLMEnd() {
      try {
        const endResponse = { done: true, timestamp: new Date().toISOString() };
        res.write(`data: ${JSON.stringify(endResponse)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        resolve('');
      } catch (error) {
        console.error('Error ending stream:', error);
      }
    }
  };
};

// RAG: 检索相关文档 (优化版：混合检索 + 重排序)
export const retrieveDocuments = async (query: string, limit: number = 5, threshold: number = 0.5) => {
  try {
    console.log(`[RAG] Starting retrieval for query: "${query}"`);
    
    // Step 1: Generate Embedding
    const queryEmbedding = await embeddings.embedQuery(query);
    
    // Step 2: Hybrid Search (Vector + Keyword) via Supabase RPC
    // 简单的分词处理：将 query 每个字之间加空格，或者简单按空格分割（取决于入库时的分词策略）
    // 这里采用简单策略：如果 query 包含空格则保留，否则不做处理（依靠 websearch_to_tsquery 的默认行为）
    // 或者尝试简单的 N-gram 模拟：这里先直接传 query，依靠 postgres simple config 的默认行为
    const queryText = query; 

    // 扩大召回数量供 Rerank 使用 (例如取 4 倍的 limit)
    const initialLimit = limit * 4;

    const { data: documents, error } = await supabase.rpc('hybrid_match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: threshold, // 向量检索的阈值
      match_count: initialLimit,
      query_text: queryText
    });

    if (error) {
      console.error('[RAG] Error searching documents (RPC):', error);
      // Fallback: 尝试旧的纯向量检索函数，以防 migration 未生效
      console.log('[RAG] Falling back to standard match_documents');
      const { data: fallbackDocs, error: fallbackError } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit
      });
      if (fallbackError) {
        console.error('[RAG] Fallback failed:', fallbackError);
        return [];
      }
      return fallbackDocs || [];
    }

    if (!documents || documents.length === 0) {
      console.log('[RAG] No documents found in initial search.');
      return [];
    }

    console.log(`[RAG] Initial recall: ${documents.length} documents.`);

    // Step 3: Rerank (重排序)
    // 提取文档内容列表
    const docContents = documents.map((doc: any) => doc.content);
    
    // 调用 Rerank API
    console.log('[RAG] Re-ranking documents...');
    const rerankResults = await reranker.rerank(query, docContents, limit);
    
    // 根据 Rerank 结果重新组装文档列表
    const finalDocuments = rerankResults.map(result => {
      const originalDoc = documents[result.index];
      return {
        ...originalDoc,
        similarity: result.score, // 使用 Rerank score 替换原来的 similarity
        metadata: {
          ...originalDoc.metadata,
          rerank_score: result.score // 保留分数供调试
        }
      };
    });

    console.log(`[RAG] Rerank complete. Top ${finalDocuments.length} documents selected.`);
    return finalDocuments;

  } catch (error) {
    console.error('Error in retrieveDocuments:', error);
    return [];
  }
};

// 生成AI回复
export const generateAIResponse = async (
  message: string,
  agentPrompt: string,
  messageHistory: Array<{ role: string; content: string }>,
  res: Response,
  enableWebSearch: boolean = false,
  enableRAG: boolean = false
) : Promise<string> => {
  try {
    const model = createDashScopeModel();
    let aiResponse = '';
    const append = (t: string) => { aiResponse += t; };
    let resolveFn: (text: string) => void = () => {};
    const donePromise = new Promise<string>((resolve) => { resolveFn = (text: string) => resolve(text || aiResponse.trim()); });
    const streamHandler = createStreamHandler(res, append, resolveFn);

    // 处理上下文 (Web Search & RAG)
    let finalMessage = message;
    let contextParts: string[] = [];
    
    // Web Search
    if (enableWebSearch) {
      try {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
          console.warn('TAVILY_API_KEY is not configured, skipping web search');
        } else {
          console.log('Executing web search with Tavily for:', message);
          
          const searchTool = new TavilySearch({ 
            maxResults: 3,
            tavilyApiKey: apiKey
          });
          const searchResult = await searchTool.invoke({ query: message });
          
          if (searchResult) {
            console.log('Search results found');
            const searchContent = typeof searchResult === 'string' ? searchResult : JSON.stringify(searchResult, null, 2);
            contextParts.push(`【互联网搜索结果】:\n${searchContent}`);
          }
        }
      } catch (error) {
        console.error('Web Search Error:', error);
      }
    }

    // RAG Search
    if (enableRAG) {
      try {
        console.log('Executing RAG search for:', message);
        const docs = await retrieveDocuments(message);
        
        if (docs && docs.length > 0) {
          console.log(`Found ${docs.length} relevant documents`);
          const contextText = docs.map((doc: any) => `[Source: ${doc.metadata?.source || 'Unknown'}]\n${doc.content}`).join('\n\n---\n\n');
          contextParts.push(`【知识库检索结果】:\n${contextText}`);
        } else {
          console.log('No relevant documents found in knowledge base');
        }
      } catch (error) {
        console.error('RAG Search Error:', error);
      }
    }

    // 如果有上下文信息，构建最终的 Prompt
    if (contextParts.length > 0) {
      finalMessage = `请基于以下提供的上下文信息回答用户的问题。
上下文可能包含来自互联网的搜索结果和本地知识库的检索内容。
如果上下文不包含答案，请说明你不知道，不要编造。

${contextParts.join('\n\n====================\n\n')}

用户问题:
${message}`;
    }

    // 创建系统提示词
    const currentDate = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const systemPrompt = (agentPrompt || 'You are a helpful AI assistant.') + `\n\nCurrent System Time: ${currentDate}`;

    // 设置响应头以支持SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // 调用AI模型
    const messages = [
      new SystemMessage(systemPrompt),
      ...messageHistory.map(msg => {
        if (msg.role === 'assistant') {
          return new AIMessage(msg.content);
        }
        return new HumanMessage(msg.content);
      }),
      new HumanMessage(finalMessage)
    ];

    await model.invoke(messages, {
      callbacks: [streamHandler]
    });
    await donePromise;
    return aiResponse.trim();
  } catch (error) {
    console.error('AI Response Error:', error);
    try {
      const errorResponse = {
        error: error instanceof Error ? error.message : 'AI service error',
        timestamp: new Date().toISOString()
      };
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (streamError) {
      console.error('Error writing error response:', streamError);
    }
    return '';
  }
};

// 生成会话标题
export const generateSessionTitle = async (
  firstUserMessage: string,
  firstAiResponse: string
): Promise<string> => {
  try {
    const model = createDashScopeModel();
    const prompt = `请根据以下对话内容，生成一个简短的标题（不超过10个字），直接返回标题文本，不要包含引号或其他内容。
    
用户：${firstUserMessage.slice(0, 200)}
AI：${firstAiResponse.slice(0, 200)}`;

    const response = await model.invoke([
      new HumanMessage(prompt)
    ]);

    const title = typeof response.content === 'string' ? response.content : String(response.content);
    return title.replace(/['"《》]/g, '').trim();
  } catch (error) {
    console.error('Title generation error:', error);
    return '新的对话';
  }
};
