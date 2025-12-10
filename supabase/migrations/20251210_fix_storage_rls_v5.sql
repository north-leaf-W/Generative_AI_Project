-- 确保 agent-avatars bucket 存在且是 public 的
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('agent-avatars', 'agent-avatars', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 1048576,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

-- 删除旧策略以避免冲突
DROP POLICY IF EXISTS "Public Read agent-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert agent-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update agent-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete agent-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Buckets" ON storage.buckets;

-- 1. 允许公开访问 bucket 信息 (这是上传的前提)
CREATE POLICY "Public Access Buckets"
ON storage.buckets FOR SELECT
USING ( true );

-- 2. 允许公开读取 agent-avatars 中的文件
CREATE POLICY "Public Read agent-avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'agent-avatars' );

-- 3. 允许认证用户上传文件
-- 使用 TO authenticated 限制角色
-- WITH CHECK 确保只能上传到 agent-avatars
CREATE POLICY "Authenticated Insert agent-avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'agent-avatars' );

-- 4. 允许用户修改自己的文件
-- 假设文件路径格式为: userId/filename
-- 使用 storage.foldername(name)[1] 获取路径的第一部分（即 userId）并与当前用户 ID 比较
CREATE POLICY "Authenticated Update agent-avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( 
  bucket_id = 'agent-avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text 
);

-- 5. 允许用户删除自己的文件
CREATE POLICY "Authenticated Delete agent-avatars"
ON storage.objects FOR DELETE
TO authenticated
USING ( 
  bucket_id = 'agent-avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text 
);
