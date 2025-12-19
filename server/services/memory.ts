import { createDashScopeModel } from './langchain.js';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { supabaseAdmin } from '../config/supabase.js';

/**
 * 提取对话中的关键记忆
 * @param userId 用户ID
 * @param userMessage 用户消息
 * @param assistantMessage 助手回复
 * @param source 来源 (chat / multi-agent)
 */
export const extractMemoryFromConversation = async (
  userId: string,
  userMessage: string,
  assistantMessage: string,
  source: string = 'chat'
) => {
  try {
    // 只有当对话内容足够长时才进行提取，避免浪费 token
    if (userMessage.length < 10 && assistantMessage.length < 10) {
      return;
    }

    // 默认使用 qwen-turbo，兼顾速度和成本。对于记忆提取任务足够胜任。
    // 如果需要更强的推理能力，可以考虑 qwen-plus
    const model = createDashScopeModel(process.env.DASHSCOPE_MODEL || 'qwen-turbo');
    
    const systemPrompt = `你是一个专业的记忆提取助手。你的任务是从用户的对话中提取关键信息，并对其进行分类。

请遵循以下规则：
1. 只提取**关于用户**的关键信息（如职业、爱好、偏好、计划、特定要求等）。
2. 忽略闲聊、问候或通用知识问答。
3. 如果没有发现值得记录的用户信息，请返回空数组 []。
4. 返回格式必须是合法的 JSON 数组，每个元素包含 content (内容) 和 category (分类)。
5. 分类可选值：
   - "preference": 用户喜好、偏好 (如：喜欢吃辣、偏好Python)
   - "fact": 事实信息 (如：名字叫王枫、住在上海)
   - "work": 工作相关 (如：程序员、正在做项目)
   - "general": 其他通用信息
6. 提取的内容应该是简洁的陈述句，直接陈述事实，不要包含"用户说"。

示例输入：
用户："我喜欢用 Python 编程，不喜欢 Java。"

示例输出：
[
  { "content": "用户偏好使用 Python 编程，不喜欢 Java。", "category": "preference" }
]

示例输入：
用户："帮我把这个翻成英文。"

示例输出：
[]
`;

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(`用户：${userMessage}\nAI：${assistantMessage}`)
    ]);

    const content = typeof response.content === 'string' ? response.content : String(response.content);
    
    // 尝试解析 JSON
    let memories: { content: string; category: string }[] = [];
    try {
        // 有时候模型可能包裹在 Markdown 代码块中，尝试清理
        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        if (jsonStr === 'NONE' || !jsonStr) return;
        
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
            memories = parsed;
        }
    } catch (e) {
        console.warn('[Memory] Failed to parse JSON response, falling back to text mode:', content);
        // 降级处理：如果解析失败，假设整段文本是一条通用记忆（如果不为空）
        if (content && content !== 'NONE') {
             memories = [{ content: content, category: 'general' }];
        }
    }
    
    for (const memory of memories) {
      if (!memory.content) continue;
      
      // 存入数据库
      console.log(`[Memory] Saving memory for user ${userId}: ${memory.content} [${memory.category}]`);
      await supabaseAdmin.from('memories').insert({
        user_id: userId,
        content: memory.content.trim(),
        category: memory.category || 'general',
        source: source
      });
    }

  } catch (error) {
    console.error('[Memory] Extract memory error:', error);
  }
};
