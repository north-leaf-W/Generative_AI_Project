import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthResponse } from '../../shared/types';
import { API_ENDPOINTS, apiRequest } from '../config/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<'verified' | 'pending_verification'>;
  updateProfile: (data: { name?: string; avatar_url?: string }) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (password: string, token: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiRequest<AuthResponse>(API_ENDPOINTS.auth.login, {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          });

          const { token, user } = response;
          
          set({ 
            user, 
            token, 
            isLoading: false,
            error: null
          });
          
          // 保存token到localStorage
          localStorage.setItem('token', token);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '登录失败';
          set({ 
            isLoading: false, 
            error: errorMessage 
          });
          throw error;
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiRequest<any>(API_ENDPOINTS.auth.register, {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
          });
          if (response.requiresEmailConfirmation) {
            set({ isLoading: false });
            return 'pending_verification';
          }

          const { token, user } = response as AuthResponse;
          set({ user, token, isLoading: false, error: null });
          localStorage.setItem('token', token);
          return 'verified';
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '注册失败';
          set({ 
            isLoading: false, 
            error: errorMessage 
          });
          throw error;
        }
      },

      updateProfile: async (data: { name?: string; avatar_url?: string }) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiRequest<{ user: User }>(API_ENDPOINTS.auth.updateProfile, {
            method: 'PUT',
            body: JSON.stringify(data)
          });
          
          set(state => ({ 
            user: response.user,
            isLoading: false, 
            error: null 
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '更新个人资料失败';
          set({ 
            isLoading: false, 
            error: errorMessage 
          });
          throw error;
        }
      },

      changePassword: async (oldPassword: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiRequest<{ success: boolean }>(API_ENDPOINTS.auth.changePassword, {
            method: 'POST',
            body: JSON.stringify({ oldPassword, newPassword })
          });
          if (!response || (response as any).success === false) {
            throw new Error('修改密码失败');
          }
          set({ isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '修改密码失败';
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiRequest<{ success: boolean, message: string }>(API_ENDPOINTS.auth.forgotPassword, {
            method: 'POST',
            body: JSON.stringify({ email })
          });
          if (!response || response.success === false) {
            throw new Error('请求失败');
          }
          set({ isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '请求失败';
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

      resetPassword: async (password: string, token: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiRequest<{ success: boolean, message: string }>(API_ENDPOINTS.auth.resetPassword, {
            method: 'POST',
            body: JSON.stringify({ password, accessToken: token })
          });
          if (!response || response.success === false) {
            throw new Error('重置密码失败');
          }
          set({ isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '重置密码失败';
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

      logout: () => {
        set({ 
          user: null, 
          token: null, 
          error: null 
        });
        localStorage.removeItem('token');
      },

      checkAuth: async () => {
        const token = get().token || localStorage.getItem('token');
        
        if (!token) {
          // 确保状态被清除
          set({ user: null, token: null });
          return;
        }
        
        // 如果已经有用户信息且 token 没变，可以跳过检查（可选优化，取决于业务对实时性的要求）
        // 这里为了安全起见，我们还是验证一下，但可以加个防抖或状态标记

        set({ isLoading: true });
        
        try {
          // 先尝试恢复 token 到 state（如果只在 localStorage 里有）
          if (token && !get().token) {
             set({ token });
          }

          const response = await apiRequest<{ data: User }>(API_ENDPOINTS.auth.me, {
            method: 'GET',
          });

          set({ 
            user: response.data, 
            isLoading: false,
            error: null
          });
          
        } catch (error) {
          console.error('Auth check failed:', error);
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // 只有在明确的认证错误（401/403）时才清除 Token
          // 避免因为网络波动（Failed to fetch, ERR_ABORTED）导致用户意外登出
          if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Unauthorized')) {
            localStorage.removeItem('token');
            set({ 
              user: null, 
              token: null, 
              isLoading: false 
            });
          } else {
            // 网络错误或其他错误，保留 Token 和当前 User 状态（如果有）
            // 仅重置 isLoading
            set({ isLoading: false });
          }
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage', // localStorage中的键名
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token 
      }), // 只持久化user和token
    }
  )
);
