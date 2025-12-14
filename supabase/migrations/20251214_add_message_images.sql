-- 给 messages 表添加 images 字段
ALTER TABLE messages
ADD COLUMN images TEXT[];

-- 更新索引（可选，如果需要查询图片字段）
-- CREATE INDEX idx_messages_images ON messages USING GIN(images);
