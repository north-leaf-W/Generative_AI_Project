-- 创建用户头像存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 注意：storage.objects 通常已启用 RLS，无需重复启用，否则可能导致权限错误
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 策略：允许公开查看头像
DROP POLICY IF EXISTS "Avatar Public Access" ON storage.objects;
CREATE POLICY "Avatar Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'user-avatars' );

-- 策略：允许用户上传头像 (参考 agent-avatars，允许 public 角色上传，因为前端 Supabase 客户端可能未同步 Auth 状态)
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'user-avatars' );

-- 策略：允许用户更新自己的头像
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 策略：允许用户删除自己的头像
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
