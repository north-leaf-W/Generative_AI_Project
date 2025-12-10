
import express from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';
import { ApiResponse, Notification } from '../../shared/types.js';

const router = express.Router();

// 获取我的通知列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    // 使用 supabaseAdmin 绕过 RLS，确保用户能看到自己的通知
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: notifications || []
    });
  } catch (error: any) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// 标记通知为已读
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true
    });
  } catch (error: any) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// 标记所有通知为已读
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    res.json({
      success: true
    });
  } catch (error: any) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// 删除单条通知
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true
    });
  } catch (error: any) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// 清空所有通知
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true
    });
  } catch (error: any) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// 内部帮助函数：发送通知 (不通过 HTTP 暴露，但在同一文件中导出供其他模块使用)
export const sendNotification = async (userId: string, type: 'system' | 'audit_approved' | 'audit_rejected', title: string, content: string) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        content
      });
  } catch (error) {
    console.error('Send notification error:', error);
  }
};

export default router;
