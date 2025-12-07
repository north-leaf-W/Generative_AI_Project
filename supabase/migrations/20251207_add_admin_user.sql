DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
  v_email TEXT := 'admin@example.com';
  v_password_hash TEXT := '$2a$10$xix2Z.VUYJ3NS./YHrdtHes9aM3R4ADz/DuhSCTNVeOJtaBTR2f9e'; -- 密码: asdfghjkl;'
BEGIN
  -- 1. 尝试在 auth.users 中创建用户 (这是 Supabase Auth 的核心表，用于登录验证)
  -- 检查是否存在
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      v_password_hash,
      now(), -- 设置为已验证邮箱
      '{"provider":"email","providers":["email"]}',
      '{"name":"Admin"}',
      now(),
      now(),
      '',
      ''
    );
  ELSE
    -- 获取现有用户的 ID
    SELECT id INTO new_user_id FROM auth.users WHERE email = v_email;
    -- 更新密码确保可以使用新密码登录
    UPDATE auth.users 
    SET encrypted_password = v_password_hash, updated_at = now()
    WHERE id = new_user_id;
  END IF;

  -- 2. 插入或更新 public.users (这是应用侧的用户资料表)
  INSERT INTO public.users (id, email, password_hash, name, role)
  VALUES (
    new_user_id,
    v_email,
    v_password_hash,
    'Admin',
    'admin'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    role = 'admin',
    updated_at = now();

  -- 3. 将4个初始智能体的创建者设置为该管理员，并确保状态为 public
  UPDATE public.agents
  SET 
    creator_id = new_user_id,
    status = 'public'
  WHERE name IN ('AI助手', '代码专家', '学习导师', '创意写手');
  
END $$;
