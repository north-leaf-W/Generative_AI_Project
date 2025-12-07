-- 开启 RLS (行级安全)
-- 注意：此脚本专门用于在已有数据库上启用安全策略

-- 1. 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 2. 用户表策略
-- 删除旧策略（如果存在），防止报错
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- 创建新策略
CREATE POLICY "Users can view their own profile" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON users FOR UPDATE 
  USING (auth.uid() = id);

-- 3. 智能体表策略
DROP POLICY IF EXISTS "Agents are viewable by everyone" ON agents;

CREATE POLICY "Agents are viewable by everyone" 
  ON agents FOR SELECT 
  USING (true);

-- 4. 会话表策略
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON sessions;

CREATE POLICY "Users can view their own sessions" 
  ON sessions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" 
  ON sessions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" 
  ON sessions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" 
  ON sessions FOR DELETE 
  USING (auth.uid() = user_id);

-- 5. 消息表策略
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;

CREATE POLICY "Users can view their own messages" 
  ON messages FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" 
  ON messages FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
