-- 创建通知表
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'system', 'audit_approved', 'audit_rejected'
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- 启用 RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 策略：用户只能查看自己的通知
CREATE POLICY "Users can view own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

-- 策略：用户可以标记自己的通知为已读 (UPDATE)
CREATE POLICY "Users can update own notifications" 
ON notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- 策略：仅管理员或系统可以插入通知 (通过 Service Role 或 Admin 角色)
-- 这里我们允许 authenticated 用户插入，但在业务逻辑中控制，或者只允许 admin
-- 简单起见，允许所有认证用户插入（例如触发某些事件），但通常是由后端逻辑插入
CREATE POLICY "Authenticated users can insert notifications" 
ON notifications FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');


-- 创建智能体版本/修订表 (用于存储修改审核中的数据)
CREATE TABLE agent_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  changes JSONB NOT NULL, -- 存储修改后的字段：name, description, system_prompt, avatar_url, config
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'rejected', 'draft')),
  admin_feedback TEXT, -- 管理员审核意见
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_agent_revisions_agent_id ON agent_revisions(agent_id);
CREATE INDEX idx_agent_revisions_creator_id ON agent_revisions(creator_id);
CREATE INDEX idx_agent_revisions_status ON agent_revisions(status);

-- 启用 RLS
ALTER TABLE agent_revisions ENABLE ROW LEVEL SECURITY;

-- 策略：用户可以查看自己智能体的修订版本
CREATE POLICY "Users can view own agent revisions" 
ON agent_revisions FOR SELECT 
USING (auth.uid() = creator_id);

-- 策略：管理员可以查看所有待审核的修订版本
CREATE POLICY "Admins can view pending revisions" 
ON agent_revisions FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- 策略：用户可以创建修订版本
CREATE POLICY "Users can create revisions" 
ON agent_revisions FOR INSERT 
WITH CHECK (auth.uid() = creator_id);

-- 策略：用户可以更新自己的修订版本 (例如重新提交)
CREATE POLICY "Users can update own revisions" 
ON agent_revisions FOR UPDATE 
USING (auth.uid() = creator_id);

-- 策略：管理员可以更新修订版本 (审核)
CREATE POLICY "Admins can update revisions" 
ON agent_revisions FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- 策略：用户可以删除自己的修订版本
CREATE POLICY "Users can delete own revisions" 
ON agent_revisions FOR DELETE 
USING (auth.uid() = creator_id);
