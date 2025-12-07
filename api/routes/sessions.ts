import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';
import { ApiResponse, Session, Message, CreateSessionRequest } from '../../shared/types.js';

const router = express.Router();

// 创建新会话
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { agentId, title, mode = 'public' }: CreateSessionRequest = req.body;
    const userId = req.user!.id;

    if (!agentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Agent ID is required' 
      });
    }

    // 验证智能体是否存在且活跃
    const { data: agent } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('is_active', true)
      .single();

    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found or inactive' 
      });
    }

    // 生成会话标题（如果未提供）
    const sessionTitle = title || `与智能体的新对话`;

    // 创建会话
    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        user_id: userId,
        agent_id: agentId,
        title: sessionTitle,
        mode,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error || !session) {
      console.error('Database error during session creation:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create session' 
      });
    }

    const response: ApiResponse<Session> = {
      success: true,
      data: session
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// 获取用户的会话列表
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const mode = (req.query.mode as string) || 'public';

    let query = supabaseAdmin
      .from('sessions')
      .select(`
        *,
        agents!inner(name, description, avatar_url)
      `)
      .eq('user_id', userId)
      .eq('agents.is_active', true)
      .eq('mode', mode);

    const { data: sessions, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch sessions' 
      });
    }

    const response: ApiResponse<Session[]> = {
      success: true,
      data: sessions || []
    };

    res.json(response);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// 获取特定智能体的会话列表
router.get('/agent/:agentId', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user!.id;
    const mode = (req.query.mode as string) || 'public';

    let query = supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('mode', mode);

    const { data: sessions, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch sessions' 
      });
    }

    const response: ApiResponse<Session[]> = {
      success: true,
      data: sessions || []
    };

    res.json(response);
  } catch (error) {
    console.error('Get agent sessions error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// 获取会话详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .select(`
        *,
        agents!inner(name, description, avatar_url, system_prompt)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }

    const response: ApiResponse<Session> = {
      success: true,
      data: session
    };

    res.json(response);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// 获取会话的消息历史
router.get('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 验证会话是否属于当前用户
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('id', id)
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
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch messages' 
      });
    }

    const response: ApiResponse<Message[]> = {
      success: true,
      data: messages || []
    };

    res.json(response);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// 删除会话
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 验证会话是否属于当前用户
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }

    // 删除会话（级联删除相关消息）
    const { error } = await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to delete session' 
      });
    }

    const response: ApiResponse<null> = {
      success: true,
      data: null
    };

    res.json(response);
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;