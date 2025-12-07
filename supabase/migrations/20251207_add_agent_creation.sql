-- 增加智能体创建者和审核状态字段
ALTER TABLE agents 
ADD COLUMN creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN status VARCHAR(20) DEFAULT 'private' CHECK (status IN ('private', 'pending', 'public')),
ADD COLUMN category VARCHAR(50) DEFAULT 'general';

-- 创建索引以优化查询
CREATE INDEX idx_agents_creator_id ON agents(creator_id);
CREATE INDEX idx_agents_status ON agents(status);

-- 启用 RLS（如果尚未启用）
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- 删除旧的智能体查看策略（如果存在）
DROP POLICY IF EXISTS "Agents are viewable by everyone" ON agents;

-- 创建新的智能体查看策略
-- 允许用户查看：
-- 1. 状态为 'public' 的智能体（已上架）
-- 2. 自己创建的智能体（无论状态如何）
CREATE POLICY "Users can view public or own agents" 
ON agents FOR SELECT 
USING (
  status = 'public' 
  OR 
  (auth.uid() = creator_id)
);

-- 创建智能体插入策略
-- 允许认证用户创建智能体
-- 强制 creator_id 必须为当前用户
CREATE POLICY "Users can create agents" 
ON agents FOR INSERT 
WITH CHECK (
  auth.uid() = creator_id
);

-- 创建智能体更新策略
-- 允许用户更新自己创建的智能体
CREATE POLICY "Users can update own agents" 
ON agents FOR UPDATE 
USING (
  auth.uid() = creator_id
);

-- 创建智能体删除策略
-- 允许用户删除自己创建的智能体
CREATE POLICY "Users can delete own agents" 
ON agents FOR DELETE 
USING (
  auth.uid() = creator_id
);

-- 如果需要支持头像上传，需要创建存储桶（Storage Bucket）
-- 注意：Supabase Storage 的 SQL 操作通常需要扩展或直接在 Dashboard 配置，
-- 这里提供 RLS 策略假设 bucket 'avatars' 已经存在。
-- 你需要在 Supabase Dashboard -> Storage 创建一个名为 'agent-avatars' 的 bucket，并设为 Public。

-- 即使在 SQL 中无法直接创建 Bucket，我们可以设置 Storage 的 RLS 策略
-- 假设 storage.objects 表存在（这是 Supabase Storage 的内部表）

-- 允许认证用户上传头像到 agent-avatars 桶
-- CREATE POLICY "Users can upload agent avatars"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'agent-avatars' AND
--   auth.role() = 'authenticated'
-- );

-- 允许任何人查看 agent-avatars 桶中的文件
-- CREATE POLICY "Anyone can view agent avatars"
-- ON storage.objects FOR SELECT
-- USING ( bucket_id = 'agent-avatars' );
