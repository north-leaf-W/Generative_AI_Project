import { create } from 'zustand';
import { Session, Message, ApiResponse } from '../../shared/types';
import { API_ENDPOINTS, apiRequest, streamRequest } from '../config/api';

interface ChatState {
  sessions: Session[];
  currentSession: Session | null;
  messages: Message[];
  messageCache: Record<string, Message[]>; // 添加消息缓存
  isLoading: boolean;
  isStreaming: boolean;
  streamingSessionId: string | null;
  error: string | null;
  
  // Actions
  fetchSessions: (agentId?: string, mode?: 'public' | 'dev') => Promise<void>;
  createSession: (agentId: string, title?: string, mode?: 'public' | 'dev') => Promise<Session | null>;
  updateSession: (sessionId: string, updates: Partial<Session>) => Promise<Session | null>;
  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, message: string, agentId: string, onToken: (token: string) => void, webSearch?: boolean) => Promise<void>;
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
  messageCache: {},
  isLoading: false,
  isStreaming: false,
  streamingSessionId: null,
  error: null,

  reset: () => {
    set({
      sessions: [],
      currentSession: null,
      messages: [],
      messageCache: {},
      isLoading: false,
      isStreaming: false,
      streamingSessionId: null,
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

  updateSession: async (sessionId: string, updates: Partial<Session>) => {
    // 乐观更新
    set(state => ({
      sessions: state.sessions.map(s => s.id === sessionId ? { ...s, ...updates } : s),
      currentSession: state.currentSession?.id === sessionId ? { ...state.currentSession, ...updates } : state.currentSession
    }));

    try {
      const response = await apiRequest<ApiResponse<Session>>(
        API_ENDPOINTS.sessions.update(sessionId), 
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );

      if (response.success && response.data) {
        const updatedSession = response.data;
        set(state => ({ 
          sessions: state.sessions.map(s => s.id === sessionId ? updatedSession : s),
          currentSession: state.currentSession?.id === sessionId ? updatedSession : state.currentSession,
        }));
        return updatedSession;
      } else {
        // 回滚
        // 实际上这里需要重新 fetch 比较好，简化起见这里先抛出错误
        throw new Error(response.error || 'Failed to update session');
      }
    } catch (error) {
      console.error('Update session error:', error);
      // 可以在这里回滚状态或者显示错误提示
      return null;
    }
  },

  fetchMessages: async (sessionId: string) => {
    // 检查缓存
    const state = get();
    if (state.messageCache[sessionId]) {
      set({ 
        messages: state.messageCache[sessionId], 
        error: null 
      });
      // 即使有缓存，也可以在后台静默刷新，或者直接返回
      // 这里选择直接返回，除非需要实时同步
      return; 
    }

    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<Message[]>>(
        API_ENDPOINTS.sessions.messages(sessionId), 
        { method: 'GET' }
      );

      if (response.success && response.data) {
        set(state => ({ 
          messages: response.data,
          messageCache: { ...state.messageCache, [sessionId]: response.data }, // 更新缓存
          isLoading: false,
          error: null
        }));
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

  sendMessage: async (sessionId: string, message: string, agentId: string, onToken: (token: string) => void, webSearch?: boolean) => {
    set({ isStreaming: true, streamingSessionId: sessionId, error: null });
    
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
      
      set(state => {
        const newMessages = [...state.messages, userMessage];
        return {
          messages: newMessages,
          messageCache: { ...state.messageCache, [sessionId]: newMessages }
        };
      });

      let aiResponse = '';
      
      await streamRequest(
        API_ENDPOINTS.chat.stream,
        { sessionId, message, agentId, webSearch },
        (data) => {
          if (data.error) {
            throw new Error(data.error);
          }
          if (data.token) {
            aiResponse += data.token;
            onToken(data.token);
          }
        },
        (error) => {
          console.error('Stream error:', error);
          
          // 如果当前流式会话ID不匹配（例如切换了Agent），不做任何操作
          if (get().streamingSessionId !== sessionId) return;

          // 如果已经切换了会话（同一个Agent内），停止流式状态但不显示错误
          if (get().currentSession?.id !== sessionId) {
            set({ isStreaming: false, streamingSessionId: null });
            return;
          }
          set({ error: error.message, isStreaming: false, streamingSessionId: null });
        },
        () => {
          // 如果当前流式会话ID不匹配（例如切换了Agent），不做任何操作
          if (get().streamingSessionId !== sessionId) return;

          // 如果已经切换了会话（同一个Agent内），停止流式状态但不更新消息
          if (get().currentSession?.id !== sessionId) {
            set({ isStreaming: false, streamingSessionId: null });
            return;
          }

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
            
            set(state => {
              const newMessages = [...state.messages, aiMessage];
              return {
                messages: newMessages,
                messageCache: { ...state.messageCache, [sessionId]: newMessages },
                isStreaming: false,
                streamingSessionId: null
              };
            });
          } else {
            set({ isStreaming: false, streamingSessionId: null });
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '发送消息失败';
      set({ 
        isStreaming: false, 
        streamingSessionId: null,
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
    // 仅清空当前会话引用和显示的消息，但不清空缓存
    set({ currentSession: null, messages: [] });
  },

  clearError: () => {
    set({ error: null });
  },
}));
