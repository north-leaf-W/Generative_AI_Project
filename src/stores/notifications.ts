import { create } from 'zustand';
import { Notification, ApiResponse } from '../../shared/types';
import { API_ENDPOINTS, apiRequest } from '../config/api';

interface NotificationsState {
  notifications: Notification[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  unreadCount: number;
  
  // Actions
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<boolean>;
  clearError: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  isLoading: true, // 初始为加载中，避免空数据闪烁
  isInitialized: false,
  error: null,
  unreadCount: 0,

  fetchNotifications: async () => {
    // 如果已经初始化过，不再显示全屏loading，避免闪烁
    if (!get().isInitialized) {
      set({ isLoading: true, error: null });
    } else {
      set({ error: null });
    }
    
    try {
      const response = await apiRequest<ApiResponse<Notification[]>>(API_ENDPOINTS.notifications.list, {
        method: 'GET',
      });

      if (response.success && response.data) {
        const unreadCount = response.data.filter(n => !n.is_read).length;
        set({ 
          notifications: response.data, 
          unreadCount,
          isLoading: false,
          isInitialized: true,
          error: null
        });
      } else {
        throw new Error(response.error || 'Failed to fetch notifications');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取通知列表失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
    }
  },

  markAsRead: async (id: string) => {
    try {
      const response = await apiRequest(API_ENDPOINTS.notifications.read(id), {
        method: 'PATCH',
      });

      if (response.success) {
        const notifications = get().notifications.map(n => 
          n.id === id ? { ...n, is_read: true } : n
        );
        const unreadCount = notifications.filter(n => !n.is_read).length;
        
        set({ 
          notifications,
          unreadCount
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
