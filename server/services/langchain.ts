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
export const createDashScopeModel = (modelName?: string, options?: { enableSearch?: boolean }) => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  // 优先使用传入的模型名称，否则使用环境变量，最后回退到 qwen-turbo
  const model = modelName || process.env.DASHSCOPE_MODEL || 'qwen-turbo';

  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY is not configured');
  }

  console.log(`Creating DashScope model instance with model: ${model}, search: ${options?.enableSearch}`);

  return new ChatOpenAI({
    modelName: model,
    apiKey: apiKey,
    configuration: {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    },
    streaming: true,
    temperature: 0.7,
    maxTokens: 4096,
    modelKwargs: {
      enable_search: options?.enableSearch
    }
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
export const retrieveDocuments = async (query: string, limit: number = 5, threshold: number = 0.2) => {
  try {
    console.log(`[RAG] Starting retrieval for query: "${query}" (Threshold: ${threshold})`);
    
    // Step 1: Generate Embedding
    const queryEmbedding = await embeddings.embedQuery(query);
    
    // Step 2: Hybrid Search (Vector + Keyword) via Supabase RPC
    // 简单的分词处理：将 query 每个字之间加空格，或者简单按空格分割（取决于入库时的分词策略）
    // 这里采用简单策略：如果 query 包含空格则保留，否则不做处理（依靠 websearch_to_tsquery 的默认行为）
    // 或者尝试简单的 N-gram 模拟：这里先直接传 query，依靠 postgres simple config 的默认行为
    const queryText = query; 

    // 扩大召回数量供 Rerank 使用
    // 由于重排模型效果好，我们可以在召回阶段尽可能多地召回文档，即使阈值较低
    const initialLimit = limit * 6;

    let documents: any[] = [];
    let searchMethod = 'hybrid';

    const { data: hybridDocs, error } = await supabase.rpc('hybrid_match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: initialLimit,
      query_text: queryText
    });

    if (error) {
      console.error('[RAG] Error searching documents (RPC):', error);
      console.log('[RAG] Falling back to standard match_documents');
      searchMethod = 'vector_only';
      
      const { data: fallbackDocs, error: fallbackError } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: initialLimit // 这里也应该扩大召回，供 Rerank 使用
      });
      
      if (fallbackError) {
        console.error('[RAG] Fallback failed:', fallbackError);
        return [];
      }
      documents = fallbackDocs || [];
    } else {
      documents = hybridDocs || [];
    }

    if (!documents || documents.length === 0) {
      console.log(`[RAG] No documents found (${searchMethod}).`);
      return [];
    }

    console.log(`[RAG] Initial recall (${searchMethod}): ${documents.length} documents.`);

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
  enableRAG: boolean = false,
  images?: string[],
  filesContent?: string
) : Promise<string> => {
  try {
    // 如果有图片，强制使用多模态模型 (例如 qwen-vl-max 或 qwen-vl-plus)
    // 注意：qwen-max 不支持图片，必须切换
    let modelName = undefined;
    if (images && images.length > 0) {
      // 优先使用环境变量配置的 VL 模型，默认为 qwen-vl-max
      modelName = process.env.DASHSCOPE_VL_MODEL || 'qwen-vl-max';
    }

    const model = createDashScopeModel(modelName);
    let aiResponse = '';
    const append = (t: string) => { aiResponse += t; };
    let resolveFn: (text: string) => void = () => {};
    const donePromise = new Promise<string>((resolve) => { resolveFn = (text: string) => resolve(text || aiResponse.trim()); });
    const streamHandler = createStreamHandler(res, append, resolveFn);

    // 处理上下文 (Web Search & RAG)
    // message 是用户的原始问题，用于搜索
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
            contextParts.push(`### 互联网搜索结果\n${searchContent}`);
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
          contextParts.push(`### 知识库检索结果\n${contextText}`);
        } else {
          console.log('No relevant documents found in knowledge base');
        }
      } catch (error) {
        console.error('RAG Search Error:', error);
      }
    }

    // 如果有附件内容，也加入上下文
    if (filesContent) {
        contextParts.push(`### 用户上传的附件内容\n${filesContent}`);
    }

    // 构建最终的 Prompt
    let finalMessage: string | any[] = message;
    let contextPrompt = '';
    
    if (contextParts.length > 0) {
      // 动态构建来源说明，避免误导
      const sources: string[] = [];
      if (filesContent) sources.push('用户上传的附件内容');
      if (enableWebSearch) sources.push('互联网搜索结果');
      if (enableRAG) sources.push('本地知识库的检索内容');

      contextPrompt = `请基于以下提供的参考资料回答用户的问题。
这些参考资料可能包含：${sources.join('、')}。

请严格遵循以下规则：
1. **明确来源**：回答时，请明确指出信息是来自“附件”、“互联网搜索”还是“知识库”。${enableRAG ? '' : '（注意：本对话未启用知识库，请勿提及“知识库”）'}
2. **区分内容**：如果附件中只包含很少的信息（如仅有一个日期），请不要编造该附件包含其他详细信息。
3. **如实回答**：如果附件内容与用户问题不直接相关，或者附件信息不足，请如实说明，并尝试利用其他参考资料（如搜索结果）来补充回答。

---
${contextParts.join('\n\n====================\n\n')}
---

用户问题:
`;
    }

    // 构建消息内容
    if (images && images.length > 0) {
      // 多模态消息构造
      const content: any[] = [];
      
      // 如果有上下文，先加 text
      if (contextPrompt) {
        content.push({ type: 'text', text: contextPrompt + message });
      } else {
        content.push({ type: 'text', text: message });
      }

      // 添加图片
      images.forEach(img => {
        content.push({
          type: 'image_url',
          image_url: {
            url: img // 假设是 URL 或 base64 data URI
          }
        });
      });
      
      finalMessage = content;
    } else {
      // 纯文本消息
      if (contextPrompt) {
        finalMessage = contextPrompt + message;
      }
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
