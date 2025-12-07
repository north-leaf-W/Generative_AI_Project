import express from 'express';
import { supabase } from '../config/supabase.js';
import { optionalAuth } from '../middleware/auth.js';
import { ApiResponse, Agent } from '../../shared/types.js';

const router = express.Router();

// 获取所有智能体列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { data: agents, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database error details:', JSON.stringify(error, null, 2));
      return res.status(500).json({ 
        success: false, 
        error: `Failed to fetch agents: ${error.message}` 
      });
    }

    const response: ApiResponse<Agent[]> = {
      success: true,
      data: agents || []
    };

    res.json(response);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// 获取单个智能体详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: agent, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }

    const response: ApiResponse<Agent> = {
      success: true,
      data: agent
    };

    res.json(response);
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;