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
  updateProfile: (name: string) => Promise<void>;
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

      updateProfile: async (name: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiRequest<{ user: User }>(API_ENDPOINTS.auth.updateProfile, {
            method: 'PUT',
            body: JSON.stringify({ name })
          });
          
          set(state => ({ 
            user: response.user,
            isLoading: false,
            error: null
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '更新个人信息失败';
          set({ isLoading: false, error: errorMessage });
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
          return;
        }

        set({ isLoading: true });
        
        try {
          const response = await apiRequest<{ data: User }>(API_ENDPOINTS.auth.me, {
            method: 'GET',
          });

          set({ 
            user: response.data, 
            isLoading: false,
            error: null
          });
          
        } catch (error) {
          // Token无效或过期
          localStorage.removeItem('token');
          set({ 
            user: null, 
            token: null, 
            isLoading: false 
          });
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
