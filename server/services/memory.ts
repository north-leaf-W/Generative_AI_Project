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

/**
 * 整理和去重用户的记忆
 * @param userId 用户ID
 * @param execute 是否直接执行（false 为预览模式）
 */
export const consolidateMemories = async (userId: string, execute: boolean = false) => {
    try {
        // 1. 获取所有活跃记忆
        const { data: memories, error } = await supabaseAdmin
            .from('memories')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: false }); // 最新的在前

        if (error || !memories || memories.length === 0) {
            return { success: false, message: 'No memories to consolidate' };
        }

        if (memories.length < 2) {
             return { success: true, message: 'Too few memories to consolidate' };
        }

        // 2. 构建 Prompt
        const memoriesText = memories.map((m, i) => `[ID:${m.id}] [${m.category}] ${m.content}`).join('\n');
        
        const systemPrompt = `你是一个专业的记忆整理助手。你的任务是整理用户的长期记忆库。

当前记忆列表：
${memoriesText}

请执行以下操作：
1. **深度去重**：仔细检查所有记忆，即使措辞略有不同（如"用户是大三学生"和"用户目前在上大三"），只要表达的是同一个意思，必须合并。
2. **信息整合**：将分散的相关信息合并为一条完整的描述。例如：
   - "用户叫王枫"
   - "用户是青岛理工大学的学生"
   - "用户是软件工程专业的"
   -> 合并为： "用户是青岛理工大学软件工程专业的大三学生，名字叫王枫。"
3. **保留独特项但不要包含在输出中**：对于那些没有重复、不需要合并或修改的记忆，请**不要**包含在返回结果中（既不放入 to_delete 也不放入 to_add）。只返回发生了**变化**（被合并、被修改、被删除）的项。
4. **删除冲突/过时项**：如果发现矛盾，优先保留看起来更新或更详细的信息。
5. **修正人称**：将所有内容统一转换为**第三人称**（"用户..."）。

重要：请务必找出所有语义重复的项！不要漏掉任何显而易见的重复。
如果发现有重复或可合并的项，请务必生成 'to_delete' 和 'to_add'。
只返回**受影响**的记忆。如果一条记忆不需要任何改变，请忽略它。

输出格式要求：
返回一个 JSON 对象，包含两个数组：
- "to_delete": [需要删除的原始记忆ID列表] (被合并的旧记忆ID都应该在这里)
- "to_add": [{"content": "新记忆内容", "category": "分类"}] (合并后的新记忆)

示例返回：
{
  "to_delete": ["id1", "id2", "id3"],
  "to_add": [
    {"content": "用户叫王枫，是软件工程专业的大三学生。", "category": "fact"}
  ]
}`;

        const model = createDashScopeModel(process.env.DASHSCOPE_MODEL || 'qwen-plus'); // 使用更强的模型进行推理
        const response = await model.invoke([new SystemMessage(systemPrompt)]);
        
        const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        
        console.log('[Consolidate Debug] LLM Response:', content);

        // 3. 解析结果
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanContent);
        
        const { to_delete, to_add } = result;

        // 如果只是预览，返回涉及的原始记忆和建议的新记忆
        if (!execute) {
            const originalMemories = memories.filter(m => to_delete.includes(m.id));
            return { 
                success: true, 
                preview: true,
                original: originalMemories,
                generated: to_add 
            };
        }

        // 4. 执行数据库操作 (仅当 execute=true 时调用，或者由另一个函数调用)
        // 软删除旧记忆
        if (to_delete && to_delete.length > 0) {
            await supabaseAdmin
                .from('memories')
                .update({ is_active: false })
                .in('id', to_delete);
        }

        // 添加新记忆
        if (to_add && to_add.length > 0) {
            const newMemories = to_add.map((m: any) => ({
                user_id: userId,
                content: m.content,
                category: m.category || 'general',
                source: 'consolidation', // 标记来源为整理
                is_active: true
            }));
            
            await supabaseAdmin.from('memories').insert(newMemories);
        }

        return { success: true, deleted: to_delete?.length || 0, added: to_add?.length || 0 };

    } catch (error) {
        console.error('Consolidate memories error:', error);
        throw error;
    }
};

/**
 * 执行记忆整理（前端确认后）
 */
export const executeConsolidation = async (userId: string, deleteIds: string[], newMemories: any[]) => {
    try {
        // 软删除旧记忆
        if (deleteIds && deleteIds.length > 0) {
            await supabaseAdmin
                .from('memories')
                .update({ is_active: false })
                .in('id', deleteIds)
                .eq('user_id', userId); // 确保只能删自己的
        }

        // 添加新记忆
        if (newMemories && newMemories.length > 0) {
            const inserts = newMemories.map((m: any) => ({
                user_id: userId,
                content: m.content,
                category: m.category || 'general',
                source: 'consolidation',
                is_active: true
            }));
            
            await supabaseAdmin.from('memories').insert(inserts);
        }

        return { success: true };
    } catch (error) {
        console.error('Execute consolidation error:', error);
        throw error;
    }
};
export const getUserMemories = async (userId: string, limit: number = 20): Promise<string> => {
    try {
        const { data: memories, error } = await supabaseAdmin
            .from('memories')
            .select('content, category')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Fetch memories error:', error);
            return "";
        }

        if (!memories || memories.length === 0) return "";

        // Format memories
        const memoryText = memories.map(m => `- [${m.category}] ${m.content}`).join('\n');
        return `\n\n关于用户的记忆信息:\n${memoryText}\n`;
    } catch (error) {
        console.error('Get user memories error:', error);
        return "";
    }
};
