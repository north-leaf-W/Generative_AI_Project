import express from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { generateToken, hashPassword, verifyPassword } from '../utils/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { LoginRequest, RegisterRequest, ApiResponse, AuthResponse, User } from '../../shared/types.js';

const router = express.Router();

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { email, password, name }: RegisterRequest = req.body;

    // 验证输入
    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        error: '请输入邮箱、密码和姓名' 
      });
    }

    // 检查邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: '邮箱格式无效' 
      });
    }

    // 检查密码长度
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: '密码长度至少为6位' 
      });
    }

    // 检查邮箱是否已被注册（查询 public.users 表）
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: '该邮箱已被注册，请直接登录' 
      });
    }

    // 交由 Supabase Auth 处理重复邮箱校验

    // 使用 Supabase Auth 注册（将触发邮箱验证）
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });

    if (signUpError) {
      // 如果 Supabase 返回用户已存在的错误
      if (signUpError.message.includes('already registered') || signUpError.status === 422) {
        return res.status(400).json({ success: false, error: '该邮箱已被注册，请直接登录' });
      }
      
      console.error('Supabase signUp error:', signUpError);
      return res.status(500).json({ success: false, error: '创建用户失败' });
    }

    const authUser = signUpData.user;
    if (!authUser) {
      return res.status(500).json({ success: false, error: '创建用户失败' });
    }

    // 清理应用侧旧数据：如果存在相同邮箱但不同id的遗留记录，先移除
    const { data: legacyUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .neq('id', authUser.id);

    if (legacyUsers && legacyUsers.length > 0) {
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('email', email)
        .neq('id', authUser.id);
    }

    // 在应用侧用户表创建/更新资料（保留密码哈希以兼容旧数据）
    const hashedPassword = await hashPassword(password);
    const { data: profile, error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authUser.id,
        email,
        password_hash: hashedPassword,
        name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select('id, email, name, role, created_at, updated_at')
      .single();

    if (upsertError || !profile) {
      console.error('Profile upsert error:', upsertError);
      return res.status(500).json({ success: false, error: '创建用户资料失败' });
    }

    // 若项目开启邮箱验证，注册不会返回 session，需要提示用户验证邮箱
    const requiresEmailConfirmation = !signUpData.session;
    if (requiresEmailConfirmation) {
      return res.status(201).json({
        requiresEmailConfirmation: true,
        user: profile
      });
    }

    // 未开启邮箱验证则直接签发应用JWT
    const token = generateToken({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    });

    return res.status(201).json({ token, user: profile });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { email, password }: LoginRequest = req.body;

    // 验证输入
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: '请输入邮箱和密码' 
      });
    }

    // 邮箱格式校验
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: '邮箱格式不正确' });
    }

    // 直接尝试登录
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      // 处理特定错误
      if (signInError.message.includes('Email not confirmed')) {
        return res.status(403).json({ 
          success: false, 
          error: '邮箱未验证，请前往邮箱完成验证', 
          requiresEmailConfirmation: true 
        });
      }
      
      // 其他登录错误（密码错误、用户不存在等）
      return res.status(401).json({ success: false, error: '账号或密码错误' });
    }

    if (!signInData?.user) {
      return res.status(401).json({ success: false, error: '账号或密码错误' });
    }

    // 获取/创建应用侧用户资料
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('id, email, name, avatar_url, role, created_at, updated_at')
      .eq('id', signInData.user.id)
      .single();

    let profile = userProfile;
    if (!profile) {
      // 检查是否存在相同邮箱但 ID 不同的残留记录
      const { data: conflictUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (conflictUser) {
        // 删除残留记录，避免唯一性约束冲突
        await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', conflictUser.id);
      }

      // 如果没有用户资料，使用邮箱前缀作为默认名称
      const defaultName = email.split('@')[0] || 'User';
      const { data: created, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: signInData.user.id,
          email,
          name: signInData.user.user_metadata?.name || defaultName,
          password_hash: '', // 兼容性字段：对于第三方/手动创建的用户，不需要在本地存密码哈希
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id, email, name, avatar_url, role, created_at, updated_at')
        .single();

      if (createError) {
        console.error('Auto create user profile failed:', createError);
        return res.status(500).json({ success: false, error: '服务器内部错误：创建用户资料失败' });
      }

      profile = created!;
    }

    // 生成JWT令牌
    const token = generateToken({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    });

    return res.json({ token, user: profile });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: '用户未认证' 
      });
    }

    // 从数据库获取用户信息
    const { data: dbUser, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, avatar_url, role, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error || !dbUser) {
      return res.status(404).json({ 
        success: false, 
        error: '用户不存在' 
      });
    }

    const response: ApiResponse<User> = {
      success: true,
      data: dbUser
    };

    res.json(response);
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
});

// 更新用户信息
router.put('/update-profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, avatar_url } = req.body as { name?: string; avatar_url?: string };

    if ((!name || name.trim().length === 0) && !avatar_url) {
      return res.status(400).json({ success: false, error: '没有需要更新的内容' });
    }

    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (name && name.trim().length > 0) {
      updates.name = name;
    }

    if (avatar_url !== undefined) {
      updates.avatar_url = avatar_url;
    }

    // 在更新前，获取当前用户的旧头像 URL
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, name, avatar_url, role, created_at, updated_at')
      .single();

    if (error || !user) {
      console.error('Update profile error:', error);
      return res.status(500).json({ success: false, error: '更新个人资料失败' });
    }

    // 如果头像更新成功，且旧头像存在且属于 Supabase Storage (user-avatars bucket)，则删除旧文件
    if (
      avatar_url !== undefined && 
      currentUser?.avatar_url && 
      currentUser.avatar_url !== avatar_url &&
      currentUser.avatar_url.includes('/storage/v1/object/public/user-avatars/')
    ) {
      try {
        // 提取路径: .../user-avatars/user_id/filename
        const path = currentUser.avatar_url.split('/user-avatars/')[1];
        if (path) {
          console.log(`Deleting old avatar for user ${userId}: ${path}`);
          const { error: deleteError } = await supabaseAdmin.storage
            .from('user-avatars')
            .remove([path]);
          
          if (deleteError) {
            console.warn('Failed to delete old avatar:', deleteError);
          }
        }
      } catch (e) {
        console.warn('Exception while deleting old avatar:', e);
      }
    }

    // 同时也更新 Supabase Auth metadata (如果修改了名字)
    if (name) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { name }
      });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 修改密码
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: '请输入旧密码和新密码' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码长度至少为6位' });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    // 通过 Supabase Auth 校验旧密码
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPassword });
    if (signInError) {
      return res.status(401).json({ success: false, error: '旧密码不正确' });
    }

    // 使用服务角色更新 Supabase Auth 密码
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (updateError) {
      console.error('Update password error:', updateError);
      return res.status(500).json({ success: false, error: '更新密码失败' });
    }

    // 可选：同步应用侧更新时间
    await supabaseAdmin
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', userId);

    return res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 忘记密码 - 发送重置邮件
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: '请输入邮箱地址' });
    }

    // 检查用户是否存在（可选，根据安全策略决定是否暴露用户存在性）
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (!user) {
      return res.status(404).json({ success: false, error: '该邮箱未注册' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${frontendUrl}/reset-password`,
    });

    if (error) {
      console.error('Reset password error:', error);
      return res.status(500).json({ success: false, error: '发送重置邮件失败，请稍后重试' });
    }

    res.json({ success: true, message: '重置密码邮件已发送，请查收' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 重置密码 - 使用token设置新密码
router.post('/reset-password', async (req, res) => {
  try {
    const { password, accessToken } = req.body;
    
    if (!password || !accessToken) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ success: false, error: '密码长度至少为6位' });
    }

    // 验证 accessToken 获取用户
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({ success: false, error: '重置链接无效或已过期，请重新申请' });
    }

    // 更新密码
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: password
    });

    if (updateError) {
      console.error('Update password error:', updateError);
      return res.status(500).json({ success: false, error: '重置密码失败' });
    }
    
    // 同步更新 updated_at
    await supabaseAdmin
        .from('users')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', user.id);

    res.json({ success: true, message: '密码重置成功，请使用新密码登录' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

export default router;
