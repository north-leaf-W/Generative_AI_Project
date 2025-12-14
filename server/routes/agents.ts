import express from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';
import { ApiResponse, Agent, CreateAgentRequest } from '../../shared/types.js';
import { sendNotification } from './notifications.js';

const router = express.Router();

// Helper to get favorites map
async function getFavoritesMap(userId: string) {
  const { data } = await supabaseAdmin
    .from('favorites')
    .select('agent_id')
    .eq('user_id', userId);
  const set = new Set<string>();
  if (data) data.forEach((f: any) => set.add(f.agent_id));
  return set;
}

// 获取所有智能体列表（公开+我的）
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // Check if user is admin
    let isAdmin = false;
    if (userId) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      if (user?.role === 'admin') isAdmin = true;
    }

    // 构建查询
    // 方案优化：使用数据库视图 `public_agents_with_counts` 直接获取包含收藏数的智能体列表
    // 这样可以利用数据库的高效聚合能力，避免在后端进行大量数据的内存计算
    let query = supabase
      .from('public_agents_with_counts')
      .select('*');
      
    if (req.query.tag) {
      // tags 是数组，使用 contains
      query = query.contains('tags', [req.query.tag]);
    }

    // 排序逻辑优化
    // 'hot': 按收藏数降序 (默认)
    // 'hot_asc': 按收藏数升序
    // 'new': 按创建时间降序
    // 'new_asc': 按创建时间升序
    
    // 默认按创建时间降序 (new)
    let sortOrder: 'asc' | 'desc' = 'desc';
    let sortField = 'created_at';
    
    if (req.query.sort === 'new_asc') {
        sortOrder = 'asc';
    } else if (req.query.sort === 'hot_asc') {
        // 如果是按热度升序，为了稳定，先按时间升序获取数据，然后在内存中排序
        sortOrder = 'asc'; 
    }
    
    // 无论如何，先从数据库按时间排序获取数据，保证基准稳定性
    query = query.order('created_at', { ascending: sortOrder === 'asc' });
      
    const { data: publicAgents, error: publicError } = await query;
      
    if (publicError) throw publicError;
    
    // 视图已经包含了 favorites_count 字段，直接使用
    let allAgents: Agent[] = (publicAgents || []).map((agent: any) => ({
      ...agent,
      favorites_count: agent.favorites_count || 0
    }));

    // 内存排序处理热度
    if (req.query.sort === 'hot') {
        allAgents.sort((a: any, b: any) => {
            const countDiff = (b.favorites_count || 0) - (a.favorites_count || 0);
            if (countDiff !== 0) return countDiff;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    } else if (req.query.sort === 'hot_asc') {
        allAgents.sort((a: any, b: any) => {
            const countDiff = (a.favorites_count || 0) - (b.favorites_count || 0);
            if (countDiff !== 0) return countDiff;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
    }
    
    // 填充作者信息
    if (allAgents.length > 0) {
      const creatorIds = [...new Set(allAgents.map(a => a.creator_id).filter(id => id))];
      
      if (creatorIds.length > 0) {
        const { data: creators } = await supabaseAdmin
          .from('users')
          .select('id, name')
          .in('id', creatorIds);
          
        if (creators) {
          const creatorMap = new Map(creators.map(c => [c.id, c]));
          allAgents = allAgents.map(agent => ({
            ...agent,
            creator: agent.creator_id ? creatorMap.get(agent.creator_id) : undefined
          }));
        }
      }
    }

    // 如果是管理员，检查待审核版本
    if (isAdmin && allAgents.length > 0) {
      const agentIds = allAgents.map(a => a.id);
      const { data: revisions } = await supabaseAdmin
        .from('agent_revisions')
        .select('agent_id')
        .in('agent_id', agentIds)
        .eq('status', 'pending');
        
      if (revisions && revisions.length > 0) {
        const revisionSet = new Set(revisions.map(r => r.agent_id));
        allAgents = allAgents.map(agent => ({
          ...agent,
          has_pending_revision: revisionSet.has(agent.id)
        }));
      }
    }
    
    // 如果已登录，检查收藏状态
    if (userId) {
      try {
        const favoritesMap = await getFavoritesMap(userId);
        allAgents = allAgents.map(agent => ({
          ...agent,
          is_favorited: favoritesMap.has(agent.id)
        }));
      } catch (err) {
        console.warn('Failed to fetch favorites', err);
      }
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

// 收藏智能体
router.post('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    
    // Check if agent exists
    const { data: agent } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single();
      
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    
    // Use supabaseAdmin to bypass RLS
    const { error } = await supabaseAdmin
      .from('favorites')
      .insert({ user_id: userId, agent_id: agentId });
      
    if (error) {
      // Ignore duplicate key error
      if (error.code !== '23505') throw error;
    }
    
    res.json({ success: true, message: 'Favorited' });
  } catch (error: any) {
    console.error('Add favorite error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 取消收藏智能体
router.delete('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    
    // Use supabaseAdmin to bypass RLS
    const { error } = await supabaseAdmin
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('agent_id', agentId);
      
    if (error) throw error;
    
    res.json({ success: true, message: 'Unfavorited' });
  } catch (error: any) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取“我的智能体”列表
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const { data: agents, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('creator_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 检查是否有待审核的修改
    const agentIds = (agents || []).map(a => a.id);
    if (agentIds.length > 0) {
      // 使用 supabaseAdmin 绕过 RLS，因为标准 supabase 客户端可能没有用户上下文
      const { data: revisions } = await supabaseAdmin
        .from('agent_revisions')
        .select('agent_id, status')
        .in('agent_id', agentIds)
        .in('status', ['pending', 'rejected']);
        
      if (revisions && revisions.length > 0) {
        const pendingMap = new Set(revisions.filter(r => r.status === 'pending').map(r => r.agent_id));
        const rejectedMap = new Set(revisions.filter(r => r.status === 'rejected').map(r => r.agent_id));

        (agents || []).forEach(agent => {
          if (pendingMap.has(agent.id)) {
            (agent as any).has_pending_revision = true;
          }
          if (rejectedMap.has(agent.id)) {
            (agent as any).has_rejected_revision = true;
          }
        });
      }
    }
    
    // Add is_favorited info (even for own agents)
    const favoritesMap = await getFavoritesMap(userId);
    const agentsWithFav = (agents || []).map(agent => ({
      ...agent,
      is_favorited: favoritesMap.has(agent.id)
    }));

    const response: ApiResponse<Agent[]> = {
      success: true,
      data: agentsWithFav
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
    const { name, description, system_prompt, avatar_url, status, tags }: CreateAgentRequest & { tags?: string[] } = req.body;

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
      config: {},
      tags: tags || []
    };

    // 使用 supabaseAdmin 绕过 RLS 插入
    const { data, error } = await supabaseAdmin
      .from('agents')
      .insert(newAgent)
      .select()
      .single();

    if (error) throw error;

    // 如果状态为 pending (待审核)，通知所有管理员
    if (finalStatus === 'pending') {
      const { data: admins } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'admin');
        
      if (admins && admins.length > 0) {
        for (const admin of admins) {
          await sendNotification(
            admin.id,
            'system',
            '新智能体待审核',
            `用户提交了新的智能体 "${name}" 申请发布，请前往后台审核。`
          );
        }
      }
    }

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

    const { data: agents, error } = await supabaseAdmin
      .from('agents')
      .select('*, creator:users!creator_id(name, email)') // 关联查询创建者信息，指定外键以避免歧义
      .eq('status', 'pending')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 同时获取待审核的修订版本
    const { data: revisions, error: revisionError } = await supabaseAdmin
      .from('agent_revisions')
      .select('*, agent:agents(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
      
    if (revisionError) throw revisionError;

    const pendingRevisions = (revisions || []).map(r => ({
      ...r.agent, // 基础数据使用原始 agent 数据
      id: r.agent_id, // 确保 ID 正确
      revision_id: r.id,
      status: 'pending_revision', // 覆盖状态
      created_at: r.created_at, // 使用修订版的创建时间
      creator: { name: 'Unknown', email: '' },
      original_agent: r.agent, // 保存原始 agent 信息用于对比
      ...r.changes // 展开修改内容，覆盖原始值
    }));

    // 获取 revision 的 creator 信息
    if (pendingRevisions.length > 0) {
      for (const rev of pendingRevisions) {
         const { data: creator } = await supabaseAdmin.from('users').select('name, email').eq('id', (revisions?.find(r => r.id === rev.revision_id) as any).creator_id).single();
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

// 获取用户收藏的智能体列表
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const { data: favorites, error } = await supabaseAdmin
      .from('favorites')
      .select('agent_id')
      .eq('user_id', userId);

    if (error) throw error;
    
    if (!favorites || favorites.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const agentIds = favorites.map(f => f.agent_id);
    
    // 获取智能体详情
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from('agents')
      .select('*')
      .in('id', agentIds)
      .eq('is_active', true);
      
    if (agentsError) throw agentsError;
    
    // 标记为已收藏
    const result = (agents || []).map(agent => ({
      ...agent,
      is_favorited: true
    }));
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Get favorites error:', error);
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

    // Check if user is admin
    let isAdmin = false;
    if (userId) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      if (user?.role === 'admin') isAdmin = true;
    }

    // 权限检查：如果是公开的，或者是拥有者，或者是管理员，则允许访问
    const isOwner = userId && agent.creator_id === userId;
    const isPublic = agent.status === 'public';

    if (!isPublic && !isOwner && !isAdmin) {
       return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized access to private agent' 
      });
    }
    
    // Check favorite status
    if (userId) {
      const favoritesMap = await getFavoritesMap(userId);
      (agent as any).is_favorited = favoritesMap.has(agent.id);
    }
    
    // 如果是创建者，检查是否有草稿版本的修订
    if (isOwner) {
      const { data: draftRevision } = await supabaseAdmin
        .from('agent_revisions')
        .select('*')
        .eq('agent_id', id)
        .in('status', ['draft', 'pending', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (draftRevision) {
        (agent as any).draft_revision = draftRevision;
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

// 删除智能体
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 检查权限
    const { data: agent, error: fetchError } = await supabaseAdmin
      .from('agents')
      .select('creator_id, status, avatar_url')
      .eq('id', id)
      .single();

    if (fetchError || !agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const { data: user } = await supabaseAdmin.from('users').select('role').eq('id', userId).single();
    const isAdmin = user?.role === 'admin';

    if (agent.creator_id !== userId && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Unauthorized to delete this agent' });
    }

    // 执行删除
    // 如果智能体有头像且存储在 agent-avatars 桶中，尝试删除
    if (agent.avatar_url && agent.avatar_url.includes('agent-avatars')) {
      try {
        const urlParts = agent.avatar_url.split('/');
        // 假设 URL 格式类似 .../agent-avatars/user_id/filename
        const fileName = urlParts.pop();
        const userIdPart = urlParts.pop(); // user_id
        
        if (fileName && userIdPart) {
          const filePath = `${userIdPart}/${fileName}`;
          await supabaseAdmin.storage
            .from('agent-avatars')
            .remove([filePath]);
          console.log(`Deleted avatar for agent ${id}: ${filePath}`);
        }
      } catch (err) {
        console.error('Failed to delete avatar:', err);
        // 删除头像失败不阻止删除智能体
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('agents')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Agent deleted successfully' });

  } catch (error: any) {
    console.error('Delete agent error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新智能体（用户操作）
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, system_prompt, avatar_url, config, tags, action = 'save' } = req.body; // action: 'save' | 'publish'
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
      const { data: user } = await supabaseAdmin.from('users').select('role').eq('id', userId).single();
      const isAdmin = user?.role === 'admin';

      if (currentAgent.creator_id !== userId && !isAdmin) {
        return res.status(403).json({ success: false, error: '无权修改此智能体' });
      }

      // 3. 根据状态处理
      // 如果是管理员修改任何状态的智能体，且 action 是 publish，直接更新并发布，跳过审核
      if (isAdmin && action === 'publish') {
         const updateData: any = {};
         if (name !== undefined) updateData.name = name;
         if (description !== undefined) updateData.description = description;
         if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
         if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
         if (config !== undefined) updateData.config = config;
         if (tags !== undefined) updateData.tags = tags;
         
         // 强制设为 public
         updateData.status = 'public';
         
         const { data: updatedAgent, error: updateError } = await supabaseAdmin
           .from('agents')
           .update(updateData)
           .eq('id', id)
           .select()
           .single();
           
         if (updateError) throw updateError;
         
         // 如果有相关的 pending revision，将其标记为 approved 或 deleted 以清除状态
         await supabaseAdmin
            .from('agent_revisions')
            .update({ status: 'approved' })
            .eq('agent_id', id)
            .eq('status', 'pending');
            
         return res.json({ success: true, message: '智能体已直接发布（管理员权限）', data: updatedAgent });
      }

      if (currentAgent.status === 'public') {
        // 如果是已发布的智能体，创建修订版本
        const changes: any = {};
        if (name !== undefined) changes.name = name;
        if (description !== undefined) changes.description = description;
        if (system_prompt !== undefined) changes.system_prompt = system_prompt;
        if (avatar_url !== undefined) changes.avatar_url = avatar_url;
        if (config !== undefined) changes.config = config;
        if (tags !== undefined) changes.tags = tags;

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
             // 通知管理员
             const { data: admins } = await supabaseAdmin.from('users').select('id').eq('role', 'admin');
             if (admins) {
               for (const admin of admins) {
                 await sendNotification(admin.id, 'system', '智能体修改待审核', `用户提交了智能体 "${currentAgent.name}" 的修改申请，请前往后台审核。`);
               }
             }
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
             // 通知管理员
             const { data: admins } = await supabaseAdmin.from('users').select('id').eq('role', 'admin');
             if (admins) {
               for (const admin of admins) {
                 await sendNotification(admin.id, 'system', '智能体修改待审核', `用户提交了智能体 "${currentAgent.name}" 的修改申请，请前往后台审核。`);
               }
             }
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
        if (tags !== undefined) updateData.tags = tags;
        
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
          // 通知管理员
          const { data: admins } = await supabaseAdmin.from('users').select('id').eq('role', 'admin');
          if (admins) {
            for (const admin of admins) {
              await sendNotification(admin.id, 'system', '新智能体待审核', `用户提交了智能体 "${updatedAgent.name}" 申请发布，请前往后台审核。`);
            }
          }
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

      // 获取智能体名称用于通知
      const { data: agentData } = await supabaseAdmin
        .from('agents')
        .select('name')
        .eq('id', id)
        .single();
      const agentName = agentData?.name || '智能体';

      if (status === 'public') {
        // 批准修订：应用更改到 agent 表，并将 revision 状态设为 approved (或删除)
        // 1. 获取修订内容
        const { data: revision } = await supabaseAdmin
          .from('agent_revisions')
          .select('*')
          .eq('id', revisionId)
          .single();
          
        if (!revision) return res.status(404).json({ success: false, error: '修订版本不存在' });

        // 2. 更新 agent
        const { error: updateError } = await supabaseAdmin
          .from('agents')
          .update(revision.changes)
          .eq('id', id);
          
        if (updateError) throw updateError;

        // 3. 删除 revision (或者标记为 approved，这里选择删除以保持 clean)
        await supabaseAdmin.from('agent_revisions').delete().eq('id', revisionId);
        
        // 4. 发送通知
        await sendNotification(
          revision.creator_id, 
          'audit_approved', 
          '智能体修改审核通过', 
          `您的智能体 "${agentName}" 的修改已通过审核并发布上线。`
        );
        
        return res.json({ success: true, message: '审核通过，修改已应用' });
      } else if (status === 'private') { // 这里的 private 意味着拒绝
         // 拒绝修订
         const { data: revision } = await supabaseAdmin
          .from('agent_revisions')
          .update({ status: 'rejected' })
          .eq('id', revisionId)
          .select()
          .single();

         if (revision) {
            await sendNotification(
              revision.creator_id, 
              'audit_rejected', 
              '智能体修改审核未通过', 
              `您的智能体 "${agentName}" 的修改审核未通过。`
            );
         }
         
         return res.json({ success: true, message: '审核已拒绝' });
      }
    } else {
      // 处理普通状态更新 (发布/拒绝/下架)
      // 先获取当前状态，以便判断是拒绝还是下架
      const { data: currentAgent, error: fetchError } = await supabaseAdmin
        .from('agents')
        .select('status, name, creator_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // 使用 supabaseAdmin 绕过 RLS 限制
      const { data: agent, error } = await supabaseAdmin
        .from('agents')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // 发送通知
      if (status === 'public') {
        await sendNotification(agent.creator_id, 'audit_approved', '智能体审核通过', `您的智能体 "${agent.name}" 已通过审核并发布上线。`);
      } else if (status === 'private') { 
         if (currentAgent.status === 'pending') {
            // 审核拒绝
            await sendNotification(agent.creator_id, 'audit_rejected', '智能体审核未通过', `您的智能体 "${agent.name}" 审核未通过，已转为私有状态。`);
         } else if (currentAgent.status === 'public') {
            // 管理员下架
            await sendNotification(agent.creator_id, 'system', '智能体已下架', `您的智能体 "${agent.name}" 已被管理员下架，转为私有状态。如有疑问请联系管理员。`);
         }
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
