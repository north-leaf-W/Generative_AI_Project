import express from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';
import { ApiResponse, Agent, CreateAgentRequest } from '../../shared/types.js';

const router = express.Router();

import { sendNotification } from './notifications.js';

// 获取所有智能体列表（公开+我的）
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // 构建查询
    let query = supabase
      .from('agents')
      .select('*')
      .eq('is_active', true);
      
    // 如果已登录，使用 OR 条件：公开的 OR 我创建的
    // 由于 supabase js sdk 的 OR 语法限制，这里我们简化逻辑：
    // 如果未登录，只查 public
    // 如果已登录，我们依靠 RLS (Row Level Security) 来过滤
    // 但是服务端使用的是 service role key (supabaseAdmin) 还是 anon key (supabase)?
    // config/supabase.ts 导出的是 supabase (anon) 和 supabaseAdmin (service)
    // 这里应该使用 supabase (anon) 配合 RLS，或者手动构建查询条件
    
    // 为了利用 RLS，我们需要传递用户 token，但这里是后端接口
    // 简单的做法是：
    // 1. 查找 status = 'public'
    // 2. 如果有 userId，查找 creator_id = userId
    // 3. 合并结果
    
    const { data: publicAgents, error: publicError } = await supabase
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'public')
      .order('created_at', { ascending: true });
      
    if (publicError) throw publicError;
    
    let allAgents = publicAgents || [];
    
    if (userId) {
      // 获取用户角色
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    
    const isAdmin = userData?.role === 'admin';

    // 获取我的智能体
    const { data: myAgents, error: myError } = await supabase
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });
      
    if (myError) throw myError;

    // 检查我的智能体是否有待审核的修改
    const myAgentIds = (myAgents || []).map(a => a.id);
    if (myAgentIds.length > 0) {
      const { data: revisions } = await supabase
        .from('agent_revisions')
        .select('agent_id')
        .in('agent_id', myAgentIds)
        .eq('status', 'pending');
        
      if (revisions && revisions.length > 0) {
        const revisionMap = new Set(revisions.map(r => r.agent_id));
        (myAgents || []).forEach(agent => {
          if (revisionMap.has(agent.id)) {
            (agent as any).has_pending_revision = true;
          }
        });
      }
    }
    
    // 合并并去重
    const publicIds = new Set(allAgents.map(a => a.id));
    const newMyAgents = (myAgents || []).filter(a => !publicIds.has(a.id));
    allAgents = [...newMyAgents, ...allAgents];
  }

  const response: ApiResponse<Agent[]> = {
      success: true,
      data: allAgents
    };

    res.json(response);
  } catch (error: any) {
    console.error('Get agents error:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to fetch agents: ${error.message || 'Internal server error'}`
    });
  }
});

// 获取“我的智能体”列表
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('creator_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 检查是否有待审核的修改
    const agentIds = (agents || []).map(a => a.id);
    if (agentIds.length > 0) {
      const { data: revisions } = await supabase
        .from('agent_revisions')
        .select('agent_id')
        .in('agent_id', agentIds)
        .eq('status', 'pending');
        
      if (revisions && revisions.length > 0) {
        const revisionMap = new Set(revisions.map(r => r.agent_id));
        (agents || []).forEach(agent => {
          if (revisionMap.has(agent.id)) {
            (agent as any).has_pending_revision = true;
          }
        });
      }
    }

    const response: ApiResponse<Agent[]> = {
      success: true,
      data: agents || []
    };

    res.json(response);
  } catch (error: any) {
    console.error('Get my agents error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

// 创建智能体
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, description, system_prompt, avatar_url, status }: CreateAgentRequest = req.body;

    if (!name || !system_prompt) {
      return res.status(400).json({
        success: false,
        error: 'Name and system prompt are required'
      });
    }

    // 检查是否为管理员
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    // 如果请求 public 且非管理员，强制改为 pending
    let finalStatus: 'public' | 'private' | 'pending' | undefined = status;
    if (status === 'public' && user?.role !== 'admin') {
      finalStatus = 'pending';
    }

    const newAgent = {
      name,
      description,
      system_prompt,
      avatar_url,
      creator_id: userId,
      status: finalStatus || 'private', // 默认为 private
      is_active: true,
      config: {}
    };

    // 使用 supabaseAdmin 绕过 RLS 插入，或者确保 RLS 允许插入
    // 这里使用 supabaseAdmin 确保操作成功，因为我们自己在代码里控制了 creator_id
    const { data, error } = await supabaseAdmin
      .from('agents')
      .insert(newAgent)
      .select()
      .single();

    if (error) throw error;

    const response: ApiResponse<Agent> = {
      success: true,
      data: data
    };

    res.status(201).json(response);

  } catch (error: any) {
    console.error('Create agent error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

// 获取待审核智能体（仅管理员）
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // 检查管理员权限
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
      
    if (user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: '需要管理员权限' });
    }

    const { data: agents, error } = await supabase
      .from('agents')
      .select('*, creator:users(name, email)') // 关联查询创建者信息
      .eq('status', 'pending')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 同时获取待审核的修订版本
    const { data: revisions, error: revisionError } = await supabase
      .from('agent_revisions')
      .select('*, agent:agents(name, status)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
      
    if (revisionError) throw revisionError;

    // 将 revisions 转换为统一的格式返回，或者分别返回
    // 这里我们简单地将 revision 视为一种特殊的 "pending agent"
    const pendingRevisions = (revisions || []).map(r => ({
      id: r.agent_id, // 使用 agent_id 作为标识，但在操作时需要区分是 revision
      revision_id: r.id,
      name: r.agent.name,
      description: '修改审核',
      status: 'pending_revision',
      created_at: r.created_at,
      creator: { name: 'Unknown', email: '' } // 暂不关联 creator，或者需要 join
    }));

    // 获取 revision 的 creator 信息
    if (pendingRevisions.length > 0) {
      for (const rev of pendingRevisions) {
         // 这里可以优化查询，暂时循环查
         const { data: creator } = await supabase.from('users').select('name, email').eq('id', (revisions?.find(r => r.id === rev.revision_id) as any).creator_id).single();
         if (creator) rev.creator = creator;
      }
    }

    res.json({
      success: true,
      data: [...(agents || []), ...pendingRevisions]
    });
  } catch (error: any) {
    console.error('Get pending agents error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个智能体详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // 使用 admin 客户端获取，然后手动检查权限
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

    // 权限检查：如果是公开的，或者是拥有者，则允许访问
    const isOwner = userId && agent.creator_id === userId;
    const isPublic = agent.status === 'public';

    if (!isPublic && !isOwner) {
       return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized access to private agent' 
      });
    }
    
    // 如果是创建者，检查是否有草稿版本的修订
    if (isOwner) {
      const { data: draftRevision } = await supabaseAdmin
        .from('agent_revisions')
        .select('*')
        .eq('agent_id', id)
        .in('status', ['draft', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (draftRevision) {
        (agent as any).draft_revision = draftRevision;
        // 自动合并草稿内容用于预览（可选，或者前端处理）
        // 这里为了保持一致性，仅附加 draft_revision 对象，前端决定是否显示预览内容
      }
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

// 更新智能体（用户操作）
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, system_prompt, avatar_url, config, action = 'save' } = req.body; // action: 'save' | 'publish'
    const userId = req.user!.id;

    // 使用 admin 客户端以绕过 RLS (因为我们已经手动检查了 creator_id)
    const { data: currentAgent, error: fetchError } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentAgent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

      // 2. 检查权限
      if (currentAgent.creator_id !== userId) {
        return res.status(403).json({ success: false, error: '无权修改此智能体' });
      }

      // 3. 根据状态处理
      if (currentAgent.status === 'public') {
        // 如果是已发布的智能体，创建修订版本
        const changes: any = {};
        if (name !== undefined) changes.name = name;
        if (description !== undefined) changes.description = description;
        if (system_prompt !== undefined) changes.system_prompt = system_prompt;
        if (avatar_url !== undefined) changes.avatar_url = avatar_url;
        if (config !== undefined) changes.config = config;

        const targetStatus = action === 'publish' ? 'pending' : 'draft';
        let revisionStatus = targetStatus;
        
        // 查找现有的非 rejected 修订
        const { data: existingRevision } = await supabaseAdmin
          .from('agent_revisions')
          .select('id, status')
          .eq('agent_id', id)
          .in('status', ['pending', 'draft'])
          .maybeSingle(); 

        if (existingRevision) {
          let newStatus = existingRevision.status;
          if (action === 'publish') {
            newStatus = 'pending';
          }
 
          await supabaseAdmin
            .from('agent_revisions')
            .update({ changes, updated_at: new Date().toISOString(), status: newStatus })
            .eq('id', existingRevision.id);
            
           if (newStatus === 'pending') {
             return res.json({ success: true, message: '修改已提交审核' });
           } else {
             return res.json({ success: true, message: '修改已保存为草稿' });
           }
        } else {
          // 创建新修订版本
          await supabaseAdmin
            .from('agent_revisions')
            .insert({
              agent_id: id,
              creator_id: userId,
              changes,
              status: revisionStatus
            });
            
           if (revisionStatus === 'pending') {
             return res.json({ success: true, message: '修改已提交审核' });
           } else {
             return res.json({ success: true, message: '修改已保存为草稿' });
           }
        }
      } else {
        // 如果是 private/pending
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
        if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
        if (config !== undefined) updateData.config = config;
        
        // 如果 action 是 publish，且当前是 private，则改为 pending
        if (action === 'publish' && currentAgent.status === 'private') {
           updateData.status = 'pending';
        }
        
        const { data: updatedAgent, error: updateError } = await supabaseAdmin
          .from('agents')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
          
        if (updateError) throw updateError;
        
        if (updateData.status === 'pending') {
          return res.json({ success: true, message: '智能体已提交审核', data: updatedAgent });
        }
        
        return res.json({ success: true, message: '保存成功', data: updatedAgent });
      }
    } catch (error: any) {
      console.error('Update agent error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

// 审核智能体（仅管理员）
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.id;

    if (!['public', 'private', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态' });
    }

    // 检查是否是修订版本审核
    const isRevision = req.body.isRevision; // 前端需传递此标志

    // 检查管理员权限
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
      
    if (user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: '需要管理员权限' });
    }

    if (isRevision) {
      // 处理修订版本审核
      const revisionId = req.body.revisionId;
      if (!revisionId) return res.status(400).json({ success: false, error: '缺少修订版本ID' });

      if (status === 'public') {
        // 批准修订：应用更改到 agent 表，并将 revision 状态设为 approved (或删除)
        // 1. 获取修订内容
        const { data: revision } = await supabase
          .from('agent_revisions')
          .select('*')
          .eq('id', revisionId)
          .single();
          
        if (!revision) return res.status(404).json({ success: false, error: '修订版本不存在' });

        // 2. 更新 agent
        const { error: updateError } = await supabase
          .from('agents')
          .update(revision.changes)
          .eq('id', id);
          
        if (updateError) throw updateError;

        // 3. 删除 revision (或者标记为 approved，这里选择删除以保持 clean)
        await supabase.from('agent_revisions').delete().eq('id', revisionId);
        
        // 4. 发送通知
        await sendNotification(revision.creator_id, 'audit_approved', '智能体修改审核通过', `您的智能体修改已通过审核并发布上线。`);
        
        return res.json({ success: true, message: '审核通过，修改已应用' });
      } else if (status === 'private') { // 这里的 private 意味着拒绝
         // 拒绝修订
         const { data: revision } = await supabase
          .from('agent_revisions')
          .update({ status: 'rejected' })
          .eq('id', revisionId)
          .select()
          .single();

         if (revision) {
            await sendNotification(revision.creator_id, 'audit_rejected', '智能体修改审核未通过', `您的智能体修改审核未通过。`);
         }
         
         return res.json({ success: true, message: '审核已拒绝' });
      }
    } else {
      // 处理新智能体审核
      const { data: agent, error } = await supabase
        .from('agents')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // 发送通知
      if (status === 'public') {
        await sendNotification(agent.creator_id, 'audit_approved', '智能体审核通过', `您的智能体 "${agent.name}" 已通过审核并发布上线。`);
      } else if (status === 'private') { // 拒绝转为 private
         await sendNotification(agent.creator_id, 'audit_rejected', '智能体审核未通过', `您的智能体 "${agent.name}" 审核未通过，已转为私有状态。`);
      }

      res.json({
        success: true,
        data: agent
      });
    }
  } catch (error: any) {
    console.error('Update agent status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;