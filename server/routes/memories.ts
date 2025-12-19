import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// 获取记忆列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { data: memories, error } = await supabaseAdmin
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: memories });
  } catch (error: any) {
    console.error('Fetch memories error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手动添加记忆
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { content, category } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('memories')
      .insert({
        user_id: userId,
        content,
        category: category || 'manual',
        source: 'manual'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error details:', error);
      throw error;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Add memory error (Full):', error);
    res.status(500).json({ success: false, error: error.message || 'Unknown server error' });
  }
});

// 删除记忆
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete memory error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新记忆
router.patch('/:id', authenticateToken, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { content, category } = req.body;
  
      const updates: any = { updated_at: new Date().toISOString() };
      if (content) updates.content = content;
      if (category) updates.category = category;
  
      const { data, error } = await supabaseAdmin
        .from('memories')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
  
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Update memory error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

export default router;
