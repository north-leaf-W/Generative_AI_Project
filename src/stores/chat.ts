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
  sendMessage: (sessionId: string, message: string, agentId: string, onToken: (token: string) => void, webSearch?: boolean, enableRAG?: boolean, images?: string[], files?: { name: string; content: string }[]) => Promise<void>;
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
          messages: [], // 确保创建新会话时清空消息列表，防止旧消息残留
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

  sendMessage: async (sessionId: string, message: string, agentId: string, onToken: (token: string) => void, webSearch?: boolean, enableRAG?: boolean, images?: string[], files?: { name: string; content: string }[]) => {
    // 即使切换了会话，我们也允许后台继续接收数据，但不更新 UI 的 streamingSessionId
    set({ isStreaming: true, streamingSessionId: sessionId, error: null });
    
    try {
      // 立即添加用户消息到本地状态
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        session_id: sessionId,
        user_id: '', // 将在服务器端设置
        role: 'user',
        content: message, 
        images: images, // 存储图片以便在UI显示
        files: files, // 存储文件以便在UI显示
        created_at: new Date().toISOString()
      };
      
      // TODO: 如果需要支持图片在 UI 上显示，应该扩展 Message 类型或 content 格式
      // 目前后端处理 images 参数，但前端 Message 类型只有 content: string
      // 我们可以在 content 中附加一个特殊的标记或 JSON，或者在 Chat.tsx 中渲染时做处理
      // 简单起见，我们假设 images 会被后端处理，而前端在这里只展示文本
      // 如果用户上传了图片，我们可以临时追加到 content 里给用户看（如果是 base64 会太长）
      // 更好的做法是：UI 组件负责显示"正在发送图片..."，或者我们约定一种 markdown 格式

      set(state => {
        // 安全检查：确保我们是在正确的消息列表上追加
        // 只有当 messages 不为空，且其 sessionId 与当前发送消息的 sessionId 一致时，才使用 messages 作为基准
        // 否则（比如刚刚新建会话，但 fetchMessages 还没回来，或者残留了旧消息），应该从缓存或者空数组开始
        let baseMessages: Message[] = [];
        
        if (state.messages.length > 0 && state.messages[0].session_id === sessionId) {
            baseMessages = state.messages;
        } else if (state.messageCache[sessionId]) {
            baseMessages = state.messageCache[sessionId];
        }

        const newMessages = [...baseMessages, userMessage];
        // 即使切换了会话，也要更新对应会话的缓存，这样切回来时能看到
        const updatedCache = { ...state.messageCache };
        // 如果缓存中已有该会话消息，追加；如果没有，初始化
        if (updatedCache[sessionId]) {
            // 检查最后一条消息是否已经存在（防止重复添加）
            const lastMsg = updatedCache[sessionId][updatedCache[sessionId].length - 1];
            if (lastMsg?.id !== userMessage.id) {
                 updatedCache[sessionId] = [...updatedCache[sessionId], userMessage];
            }
        } else {
            updatedCache[sessionId] = [userMessage];
        }

        // 仅当当前显示的会话是发送消息的会话时，才更新 messages
        if (state.currentSession?.id === sessionId) {
            return {
                messages: newMessages,
                messageCache: updatedCache
            };
        } else {
            return {
                messageCache: updatedCache
            };
        }
      });

      let aiResponse = '';
      
      await streamRequest(
        API_ENDPOINTS.chat.stream,
        { sessionId, message, agentId, webSearch, enableRAG, images, files },
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
          
          // 如果当前流式会话ID匹配，才更新 store 的 error 状态
          if (get().streamingSessionId === sessionId) {
             set({ error: error.message, isStreaming: false, streamingSessionId: null });
          }
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
            
            set(state => {
              // 更新缓存中的消息列表
              const updatedCache = { ...state.messageCache };
              const sessionMessages = updatedCache[sessionId] || [];
              
              // 检查是否已经添加过该消息（通过 ID 或内容判断，防止重复）
              const lastMsg = sessionMessages[sessionMessages.length - 1];
              if (lastMsg?.role !== 'assistant' || lastMsg?.content !== aiMessage.content) {
                  updatedCache[sessionId] = [...sessionMessages, aiMessage];
              }

              // 如果当前显示的正是该会话，则同时更新 messages 状态
              if (state.currentSession?.id === sessionId) {
                  return {
                    messages: updatedCache[sessionId], // 使用缓存中的完整列表
                    messageCache: updatedCache,
                    isStreaming: false,
                    streamingSessionId: null
                  };
              } else {
                  // 如果已经切换走了，只更新缓存，不更新 messages
                  // 并且如果当前 store 认为正在流式传输的还是这个 session，则清除流式状态
                  if (state.streamingSessionId === sessionId) {
                      return {
                          messageCache: updatedCache,
                          isStreaming: false,
                          streamingSessionId: null
                      };
                  } else {
                      return {
                          messageCache: updatedCache
                      };
                  }
              }
            });
          } else {
            // 如果响应为空，仅在需要时清除流式状态
            if (get().streamingSessionId === sessionId) {
                set({ isStreaming: false, streamingSessionId: null });
            }
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '发送消息失败';
      if (get().streamingSessionId === sessionId) {
          set({ 
            isStreaming: false, 
            streamingSessionId: null,
            error: errorMessage 
          });
      }
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
