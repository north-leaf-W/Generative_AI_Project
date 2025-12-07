import { create } from 'zustand';
import { Session, Message, ApiResponse } from '../../shared/types';
import { API_ENDPOINTS, apiRequest, streamRequest } from '../config/api';

interface ChatState {
  sessions: Session[];
  currentSession: Session | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Actions
  fetchSessions: (agentId?: string, mode?: 'public' | 'dev') => Promise<void>;
  createSession: (agentId: string, title?: string, mode?: 'public' | 'dev') => Promise<Session | null>;
  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, message: string, agentId: string, onToken: (token: string) => void) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  setCurrentSession: (session: Session | null) => void;
  clearChat: () => void;
  clearError: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,

  reset: () => {
    set({
      sessions: [],
      currentSession: null,
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null
    });
  },

  fetchSessions: async (agentId?: string, mode?: 'public' | 'dev') => {
    set({ isLoading: true, error: null });
    
    try {
      let endpoint = agentId 
        ? API_ENDPOINTS.sessions.agent(agentId)
        : API_ENDPOINTS.sessions.my;

      if (mode) {
        endpoint += `?mode=${mode}`;
      }
      
      const response = await apiRequest<ApiResponse<Session[]>>(endpoint, {
        method: 'GET',
      });

      if (response.success && response.data) {
        set({ 
          sessions: response.data, 
          isLoading: false,
          error: null
        });
      } else {
        throw new Error(response.error || 'Failed to fetch sessions');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取会话列表失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
    }
  },

  createSession: async (agentId: string, title?: string, mode?: 'public' | 'dev') => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<Session>>(API_ENDPOINTS.sessions.create, {
        method: 'POST',
        body: JSON.stringify({ agentId, title, mode }),
      });

      if (response.success && response.data) {
        const newSession = response.data;
        set(state => ({ 
          sessions: [newSession, ...state.sessions],
          currentSession: newSession,
          isLoading: false,
          error: null
        }));
        return newSession;
      } else {
        throw new Error(response.error || 'Failed to create session');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建会话失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
      return null;
    }
  },

  fetchMessages: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<Message[]>>(
        API_ENDPOINTS.sessions.messages(sessionId), 
        { method: 'GET' }
      );

      if (response.success && response.data) {
        set({ 
          messages: response.data, 
          isLoading: false,
          error: null
        });
      } else {
        throw new Error(response.error || 'Failed to fetch messages');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取消息失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
    }
  },

  sendMessage: async (sessionId: string, message: string, agentId: string, onToken: (token: string) => void) => {
    set({ isStreaming: true, error: null });
    
    try {
      // 立即添加用户消息到本地状态
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        session_id: sessionId,
        user_id: '', // 将在服务器端设置
        role: 'user',
        content: message,
        created_at: new Date().toISOString()
      };
      
      set(state => ({
        messages: [...state.messages, userMessage]
      }));

      let aiResponse = '';
      
      await streamRequest(
        API_ENDPOINTS.chat.stream,
        { sessionId, message, agentId },
        (data) => {
          if (data.token) {
            aiResponse += data.token;
            onToken(data.token);
          }
        },
        (error) => {
          console.error('Stream error:', error);
          set({ error: error.message, isStreaming: false });
        },
        () => {
          // 流式响应完成，添加AI回复到本地状态
          if (aiResponse.trim()) {
            const aiMessage: Message = {
              id: `temp-${Date.now() + 1}`,
              session_id: sessionId,
              user_id: '', // 将在服务器端设置
              role: 'assistant',
              content: aiResponse.trim(),
              created_at: new Date().toISOString()
            };
            
            set(state => ({
              messages: [...state.messages, aiMessage],
              isStreaming: false
            }));
          } else {
            set({ isStreaming: false });
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '发送消息失败';
      set({ 
        isStreaming: false, 
        error: errorMessage 
      });
      throw error;
    }
  },

  deleteSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<null>>(
        API_ENDPOINTS.sessions.delete(sessionId), 
        { method: 'DELETE' }
      );

      if (response.success) {
        set(state => ({ 
          sessions: state.sessions.filter(s => s.id !== sessionId),
          currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
          messages: state.currentSession?.id === sessionId ? [] : state.messages,
          isLoading: false,
          error: null
        }));
      } else {
        throw new Error(response.error || 'Failed to delete session');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除会话失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
    }
  },

  setCurrentSession: (session: Session | null) => {
    set({ currentSession: session });
  },

  clearChat: () => {
    set({ currentSession: null, messages: [] });
  },

  clearError: () => {
    set({ error: null });
  },
}));
