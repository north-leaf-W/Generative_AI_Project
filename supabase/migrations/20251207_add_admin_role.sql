-- 添加用户角色字段
ALTER TABLE users 
ADD COLUMN role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- 创建索引
CREATE INDEX idx_users_role ON users(role);

-- 更新 RLS 策略以支持管理员权限

-- 管理员可以查看所有智能体
CREATE POLICY "Admins can view all agents" 
ON agents FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 管理员可以更新所有智能体
CREATE POLICY "Admins can update all agents" 
ON agents FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 管理员可以删除所有智能体
CREATE POLICY "Admins can delete all agents" 
ON agents FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 既然我们修改了 users 表，也需要确保 users 表的 RLS 允许读取 role
-- 假设 users 表已经有 "Users can view own profile" 策略
-- 我们需要允许管理员查看所有用户资料（如果需要的话，比如审核界面显示创建者名字）

CREATE POLICY "Admins can view all user profiles" 
ON users FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE u.id = auth.uid() 
    AND u.role = 'admin'
  )
);

-- 将某个特定用户设置为管理员（示例，请替换为实际的 ID 或 Email）
-- UPDATE users SET role = 'admin' WHERE email = 'your_admin_email@example.com';
