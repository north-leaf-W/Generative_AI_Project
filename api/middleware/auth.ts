import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

// 扩展Express的Request类型以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

// 验证JWT中间件
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: '请先登录' 
      });
    }

    const user = verifyToken(token);
    if (!user) {
      return res.status(403).json({ 
        success: false, 
        error: '登录已过期，请重新登录' 
      });
    }

    // 验证用户是否仍然存在且活跃
    const { data: dbUser, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('id', user.id)
      .single();

    if (error || !dbUser) {
      return res.status(403).json({ 
        success: false, 
        error: '用户不存在' 
      });
    }

    req.user = dbUser;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
};

// 可选的认证中间件（不强制要求认证）
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const user = verifyToken(token);
      if (user) {
        const { data: dbUser } = await supabaseAdmin
          .from('users')
          .select('id, email, name')
          .eq('id', user.id)
          .single();

        if (dbUser) {
          req.user = dbUser;
        }
      }
    }

    next();
  } catch (error) {
    // 可选认证失败时不阻止请求
    next();
  }
};