import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/langchain.js';
import { ApiResponse, ChatRequest, Message } from '../../shared/types.js';

const router = express.Router();

// 流式聊天接口
router.post('/stream', authenticateToken, async (req, res) => {
  try {
    const { sessionId, message, agentId }: ChatRequest = req.body;
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
        agents!inner(name, system_prompt)
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
    const systemPrompt = session.agents.system_prompt || '你是一个 helpful AI assistant';

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
    const aiResponse = await generateAIResponse(message, systemPrompt, messageHistory, res);

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
