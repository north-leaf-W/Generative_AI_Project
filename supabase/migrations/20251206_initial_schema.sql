-- 创建用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- 授权访问
GRANT SELECT ON users TO anon;
GRANT ALL PRIVILEGES ON users TO authenticated;

-- 创建智能体表
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  system_prompt TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入测试智能体
INSERT INTO agents (name, description, avatar_url, system_prompt) VALUES
('AI助手', '通用型AI助手，可以回答各种问题', 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=A%20friendly%20AI%20assistant%20avatar%2C%20modern%20minimalist%20design%2C%20blue%20gradient%20background%2C%20circular%20icon%2C%20clean%20and%20professional&image_size=square', '你是一个 helpful AI assistant'),
('代码专家', '专业的编程助手，擅长代码相关的问题', 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=A%20code%20expert%20avatar%2C%20programming%20theme%2C%20green%20gradient%20background%2C%20circular%20icon%2C%20code%20symbols%20and%20brackets%2C%20modern%20tech%20design&image_size=square', '你是一个专业的编程助手，擅长各种编程语言'),
('学习导师', '教育辅导专家，帮助用户学习新知识', 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=An%20educational%20tutor%20avatar%2C%20warm%20and%20friendly%20design%2C%20orange%20gradient%20background%2C%20circular%20icon%2C%20books%20and%20learning%20symbols%2C%20inspiring%20and%20approachable&image_size=square', '你是一个耐心的学习导师，擅长解释复杂的概念'),
('创意写手', '创意写作助手，协助用户进行内容创作', 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=A%20creative%20writing%20assistant%20avatar%2C%20artistic%20design%2C%20purple%20gradient%20background%2C%20circular%20icon%2C%20pen%20and%20paper%20elements%2C%20inspiring%20creative%20atmosphere&image_size=square', '你是一个有创意的写作助手，擅长各种文体创作');

-- 授权访问
GRANT SELECT ON agents TO anon;
GRANT ALL PRIVILEGES ON agents TO authenticated;

-- 创建会话表
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  title VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_agent_id ON sessions(agent_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);

-- 授权访问
GRANT SELECT ON sessions TO anon;
GRANT ALL PRIVILEGES ON sessions TO authenticated;

-- 创建消息表
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at ASC);

-- 授权访问
GRANT SELECT ON messages TO anon;
GRANT ALL PRIVILEGES ON messages TO authenticated;
