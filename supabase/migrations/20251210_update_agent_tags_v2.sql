-- Migration: 20251210_update_agent_tags_v2.sql

-- 1. Update '通用' and '效率' to '效率工具' (Base priority)
UPDATE agents
SET tags = ARRAY['效率工具']
WHERE tags @> ARRAY['通用'] OR tags @> ARRAY['效率'];

-- 2. Update '生活' to '生活方式'
UPDATE agents
SET tags = ARRAY['生活方式']
WHERE tags @> ARRAY['生活'];

-- 3. Update '创作' to '文本创作'
UPDATE agents
SET tags = ARRAY['文本创作']
WHERE tags @> ARRAY['创作'];

-- 4. Update '教育' to '学习教育'
UPDATE agents
SET tags = ARRAY['学习教育']
WHERE tags @> ARRAY['教育'];

-- 5. Update '编程' to '代码助手' (High priority)
UPDATE agents
SET tags = ARRAY['代码助手']
WHERE tags @> ARRAY['编程'];

-- 6. Ensure any remaining empty tags get a default (Optional, but good for consistency if strict mode is desired)
-- UPDATE agents SET tags = ARRAY['效率工具'] WHERE tags IS NULL OR array_length(tags, 1) IS NULL;
