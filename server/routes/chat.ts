import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse, generateSessionTitle } from '../services/langchain.js';
import { ApiResponse, ChatRequest, Message } from '../../shared/types.js';

const router = express.Router();

// 流式聊天接口
router.post('/stream', authenticateToken, async (req, res) => {
  try {
    const { sessionId, message, agentId, webSearch, enableRAG: enableRAGParam }: ChatRequest = req.body;
    const userId = req.user!.id;

    // 验证输入
    if (!sessionId || !message || !agentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session ID, message, and agent ID are required' 
      });
    }

    // 验证会话是否属于当前用户且包含正确的智能体
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select(`
        *,
        agents!inner(id, name, system_prompt, creator_id, config)
      `)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found or unauthorized' 
      });
    }

    // 保存用户消息到数据库
    const { data: insertedMessage, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (messageError || !insertedMessage) {
      console.error('Failed to save user message:', messageError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save message' 
      });
    }

    // 获取AI智能体的系统提示词
    let systemPrompt = session.agents.system_prompt || '你是一个 helpful AI assistant';

    // 如果是开发模式且当前用户是创建者，尝试使用最新的草稿或审核中的配置（调试模式）
    if (session.mode === 'dev' && session.agents.creator_id === userId) {
      const { data: revision } = await supabaseAdmin
        .from('agent_revisions')
        .select('changes')
        .eq('agent_id', agentId)
        .in('status', ['draft', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (revision && revision.changes && revision.changes.system_prompt) {
        systemPrompt = revision.changes.system_prompt;
        // 可以考虑在日志或响应头中标记使用了调试配置
        console.log(`Using draft/pending prompt for agent ${agentId} (Owner Debug Mode)`);
      }
    }

    // 获取历史消息用于上下文（排除刚刚插入的当前消息）
    const { data: historyMessages } = await supabaseAdmin
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .neq('id', insertedMessage.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // 将历史消息反转为正序（从旧到新）
    const messageHistory = (historyMessages || []).reverse();

    // 生成AI回复（流式），并在完成后保存
    // 检查是否是"理工助手" (假设前端会传某种标记，或者根据 ID 判断)
    // 优先使用请求参数中的 enableRAG，如果没有则回退到 agent 配置
    const configEnableRAG = session.agents.config && (session.agents.config as any).rag_enabled;
    const enableRAG = enableRAGParam !== undefined ? enableRAGParam : configEnableRAG;

    console.log(`[Chat] Session: ${sessionId}, Agent: ${agentId}`);
    console.log(`[Chat] RAG Status - Param: ${enableRAGParam}, Config: ${configEnableRAG}, Final: ${enableRAG}`);

    const aiResponse = await generateAIResponse(message, systemPrompt, messageHistory, res, webSearch, enableRAG);

    try {
      if (aiResponse && aiResponse.trim()) {
        await supabaseAdmin
          .from('messages')
          .insert({
            session_id: sessionId,
            user_id: userId,
            role: 'assistant',
            content: aiResponse.trim(),
            created_at: new Date().toISOString()
          });
      }
      await supabaseAdmin
        .from('sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      // 检查是否需要生成标题（仅当历史消息为空时，即这是第一轮对话）
      if (messageHistory.length === 0) {
        // 异步生成标题，不阻塞响应
        generateSessionTitle(message, aiResponse.trim()).then(async (newTitle) => {
          if (newTitle && newTitle !== '新的对话') {
            await supabaseAdmin
              .from('sessions')
              .update({ title: newTitle })
              .eq('id', sessionId);
          }
        }).catch(err => console.error('Failed to auto-generate title:', err));
      }
    } catch (e) {
      console.error('Post-stream save error:', e);
    }

  } catch (error) {
    console.error('Chat stream error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// 获取聊天历史（非流式，用于调试或备用）
router.get('/history/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.id;

    // 验证会话是否属于当前用户
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch chat history' 
      });
    }

    const response: ApiResponse<Message[]> = {
      success: true,
      data: messages || []
    };

    res.json(response);
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;
