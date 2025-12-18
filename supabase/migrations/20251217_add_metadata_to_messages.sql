-- 给 messages 表添加 metadata 字段，用于存储额外信息（如回答的智能体ID、名称、头像等）
ALTER TABLE messages ADD COLUMN metadata JSONB DEFAULT '{}';

-- 允许 sessions 表的 agent_id 为 NULL（如果之前是 NOT NULL 的话，虽然默认是 nullable，显式确认一下总是好的）
ALTER TABLE sessions ALTER COLUMN agent_id DROP NOT NULL;
