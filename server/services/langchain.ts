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
    const queryText = query; 

    // 扩大召回数量供 Rerank 使用
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
        match_count: initialLimit
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
    const docContents = documents.map((doc: any) => doc.content);
    
    console.log('[RAG] Re-ranking documents...');
    const rerankResults = await reranker.rerank(query, docContents, limit);
    
    const finalDocuments = rerankResults.map(result => {
      const originalDoc = documents[result.index];
      return {
        ...originalDoc,
        similarity: result.score,
        metadata: {
          ...originalDoc.metadata,
          rerank_score: result.score
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

// 新增：生成优化的搜索关键词
const generateSearchQuery = async (message: string, images?: string[]) => {
  try {
    // 使用轻量模型生成搜索关键词，避免占用太多资源
    const model = createDashScopeModel(process.env.DASHSCOPE_MODEL || 'qwen-turbo', { enableSearch: false });
    
    // 构建Prompt，包含附件/图片的判断逻辑
    const prompt = `根据以下用户输入内容，生成用于联网搜索的关键词：
1. 若内容中包含附件（如【附件：xxx】），则将附件内容与用户提的问题结合后生成关键词
2. 若包含图片（本次输入${images && images.length > 0 ? '包含' : '不包含'}图片），则结合图片相关意图生成关键词
3. 若没有附件和图片，则直接返回原问题作为关键词
4. 输出仅保留关键词文本，不要添加任何额外说明、引号或格式
例如:输入:“faker有几个冠军？”输出：“faker有几个冠军？”
输入："回答一下附件中的内容\n\n【附件：test.docx】\nFaker有几个冠军”，输出:"Faker有几个冠军"
用户输入：${message.slice(0, 500)}`;

    const response = await model.invoke([
      new HumanMessage(prompt)
    ]);

    // 提取并清洗生成的关键词
    const searchQuery = typeof response.content === 'string' 
      ? response.content.trim() 
      : String(response.content).trim();
    
    console.log(`[WebSearch] 原始消息: "${message.slice(0, 100)}..."`);
    console.log(`[WebSearch] 生成的搜索关键词: "${searchQuery}"`);
    
    // 兜底：如果生成的关键词为空，使用原始消息
    return searchQuery || message;
  } catch (error) {
    console.error('[WebSearch] 生成搜索关键词失败，使用原始消息:', error);
    return message;
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
  images?: string[]
) : Promise<string> => {
  try {
    // 如果有图片，强制使用多模态模型
    let modelName = undefined;
    if (images && images.length > 0) {
      modelName = process.env.DASHSCOPE_VL_MODEL || 'qwen-vl-max';
    }

    const model = createDashScopeModel(modelName);
    let aiResponse = '';
    const append = (t: string) => { aiResponse += t; };
    let resolveFn: (text: string) => void = () => {};
    const donePromise = new Promise<string>((resolve) => { resolveFn = (text: string) => resolve(text || aiResponse.trim()); });
    const streamHandler = createStreamHandler(res, append, resolveFn);

    // 处理上下文 (Web Search & RAG)
    let finalMessage: string | any[] = message;
    let contextParts: string[] = [];
    
    // Web Search - 修改后：先生成搜索关键词再搜索
    if (enableWebSearch) {
      try {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
          console.warn('TAVILY_API_KEY is not configured, skipping web search');
        } else {
          // 第一步：生成优化的搜索关键词
          const searchQuery = await generateSearchQuery(message, images);
          
          // 第二步：使用生成的关键词进行搜索
          console.log('Executing web search with Tavily for:', searchQuery);
          
          const searchTool = new TavilySearch({ 
            maxResults: 3,
            tavilyApiKey: apiKey
          });
          const searchResult = await searchTool.invoke({ query: searchQuery });
          
          if (searchResult) {
            console.log('Search results found');
            const searchContent = typeof searchResult === 'string' ? searchResult : JSON.stringify(searchResult, null, 2);
            contextParts.push(`【互联网搜索结果】:\n${searchContent}`);
            console.log(`${searchContent}`);
          }
        }
      } catch (error) {
        console.error('Web Search Error:', error);
      }
    }

    // RAG Search (保持不变)
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

    // 构建上下文Prompt (保持不变)
    let contextPrompt = '';
    if (contextParts.length > 0) {
      contextPrompt = `请基于以下提供的上下文信息回答用户的问题。
上下文可能包含来自互联网的搜索结果和本地知识库的检索内容。
如果上下文不包含答案，请说明你不知道，不要编造。

${contextParts.join('\n\n====================\n\n')}

用户问题:
`;
    }

    // 构建消息内容 (保持不变)
    if (images && images.length > 0) {
      const content: any[] = [];
      
      if (contextPrompt) {
        content.push({ type: 'text', text: contextPrompt + message });
      } else {
        content.push({ type: 'text', text: message });
      }

      images.forEach(img => {
        content.push({
          type: 'image_url',
          image_url: {
            url: img
          }
        });
      });
      
      finalMessage = content;
    } else {
      if (contextPrompt) {
        finalMessage = contextPrompt + message;
      }
    }

    // 创建系统提示词 (保持不变)
    const currentDate = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const systemPrompt = (agentPrompt || 'You are a helpful AI assistant.') + `\n\nCurrent System Time: ${currentDate}`;

    // 设置响应头 (保持不变)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // 调用AI模型 (保持不变)
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