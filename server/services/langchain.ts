import { ChatOpenAI } from "@langchain/openai";
import { Response } from 'express';
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { TavilySearch } from "@langchain/tavily";

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

// 生成AI回复
export const generateAIResponse = async (
  message: string,
  agentPrompt: string,
  messageHistory: Array<{ role: string; content: string }>,
  res: Response,
  enableWebSearch: boolean = false
) : Promise<string> => {
  try {
    const model = createDashScopeModel();
    let aiResponse = '';
    const append = (t: string) => { aiResponse += t; };
    let resolveFn: (text: string) => void = () => {};
    const donePromise = new Promise<string>((resolve) => { resolveFn = (text: string) => resolve(text || aiResponse.trim()); });
    const streamHandler = createStreamHandler(res, append, resolveFn);

    // 处理联网搜索
    let finalMessage = message;
    if (enableWebSearch) {
      try {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
          console.warn('TAVILY_API_KEY is not configured, skipping web search');
          // 可选：发送警告给前端
          // res.write(`data: ${JSON.stringify({ type: 'warning', content: 'Web search is enabled but TAVILY_API_KEY is missing.' })}\n\n`);
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
            finalMessage = `Context from web search:\n${searchContent}\n\nUser Question:\n${message}`;
          }
        }
      } catch (error) {
        console.error('Web Search Error:', error);
        // 搜索失败不中断流程，继续使用原始消息
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
