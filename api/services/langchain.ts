import { ChatOpenAI } from "@langchain/openai";
import { Response } from 'express';
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

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
    openAIApiKey: apiKey,
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
  res: Response
) : Promise<string> => {
  try {
    const model = createDashScopeModel();
    let aiResponse = '';
    const append = (t: string) => { aiResponse += t; };
    let resolveFn: (text: string) => void = () => {};
    const donePromise = new Promise<string>((resolve) => { resolveFn = (text: string) => resolve(text || aiResponse.trim()); });
    const streamHandler = createStreamHandler(res, append, resolveFn);

    // 创建系统提示词
    const systemPrompt = agentPrompt || 'You are a helpful AI assistant.';

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
      new HumanMessage(message)
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
        error: 'AI service error',
        timestamp: new Date().toISOString()
      };
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      res.write('data: [ERROR]\n\n');
      res.end();
    } catch (streamError) {
      console.error('Error writing error response:', streamError);
    }
    return '';
  }
};
