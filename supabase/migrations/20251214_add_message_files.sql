-- 给 messages 表添加 files 字段
ALTER TABLE messages
ADD COLUMN files JSONB DEFAULT '[]';

-- files 字段结构示例:
-- [
--   { "name": "document.pdf", "content": "extracted text content..." }
-- ]
