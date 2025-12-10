-- 1. 为 agents 表添加 tags 字段
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 创建索引以加速标签搜索
CREATE INDEX IF NOT EXISTS idx_agents_tags ON agents USING GIN (tags);

-- 2. 创建 favorites 表
CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, agent_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- 启用 RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- 策略：用户可以查看自己的收藏
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
CREATE POLICY "Users can view own favorites" 
ON favorites FOR SELECT 
USING (auth.uid() = user_id);

-- 策略：用户可以添加收藏
DROP POLICY IF EXISTS "Users can add favorites" ON favorites;
CREATE POLICY "Users can add favorites" 
ON favorites FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 策略：用户可以删除自己的收藏
DROP POLICY IF EXISTS "Users can delete own favorites" ON favorites;
CREATE POLICY "Users can delete own favorites" 
ON favorites FOR DELETE 
USING (auth.uid() = user_id);

-- 3. 更新现有智能体的标签
UPDATE agents SET tags = ARRAY['通用'] WHERE name = 'AI助手';
UPDATE agents SET tags = ARRAY['编程', '效率'] WHERE name = '代码专家';
UPDATE agents SET tags = ARRAY['教育', '生活'] WHERE name = '学习导师';
UPDATE agents SET tags = ARRAY['创作', '生活'] WHERE name = '创意写手';
