const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// API 端点配置
export const API_ENDPOINTS = {
  auth: {
    login: `${API_BASE_URL}/auth/login`,
    register: `${API_BASE_URL}/auth/register`,
    me: `${API_BASE_URL}/auth/me`,
    updateProfile: `${API_BASE_URL}/auth/update-profile`,
    changePassword: `${API_BASE_URL}/auth/change-password`,
    forgotPassword: `${API_BASE_URL}/auth/forgot-password`,
    resetPassword: `${API_BASE_URL}/auth/reset-password`,
  },
  agents: {
    list: `${API_BASE_URL}/agents`,
    my: `${API_BASE_URL}/agents/my`,
    create: `${API_BASE_URL}/agents`,
    detail: (id: string) => `${API_BASE_URL}/agents/${id}`,
    pending: `${API_BASE_URL}/agents/pending`,
    updateStatus: (id: string) => `${API_BASE_URL}/agents/${id}/status`,
    update: (id: string) => `${API_BASE_URL}/agents/${id}`, // 新增更新接口
    delete: (id: string) => `${API_BASE_URL}/agents/${id}`, // 删除接口
    favorites: `${API_BASE_URL}/agents/favorites`, // 获取收藏列表
    favorite: (id: string) => `${API_BASE_URL}/agents/${id}/favorite`, // 收藏/取消收藏
  },
  sessions: {
    create: `${API_BASE_URL}/sessions`,
    my: `${API_BASE_URL}/sessions/my`,
    agent: (agentId: string) => `${API_BASE_URL}/sessions/agent/${agentId}`,
    detail: (id: string) => `${API_BASE_URL}/sessions/${id}`,
    messages: (id: string) => `${API_BASE_URL}/sessions/${id}/messages`,
    update: (id: string) => `${API_BASE_URL}/sessions/${id}`,
    delete: (id: string) => `${API_BASE_URL}/sessions/${id}`,
  },
  chat: {
    stream: `${API_BASE_URL}/chat/stream`,
    upload: `${API_BASE_URL}/chat/upload`, // Add upload endpoint
    history: (sessionId: string) => `${API_BASE_URL}/chat/history/${sessionId}`,
  },
  notifications: {
    list: `${API_BASE_URL}/notifications`,
    read: (id: string) => `${API_BASE_URL}/notifications/${id}/read`,
    readAll: `${API_BASE_URL}/notifications/read-all`,
    delete: (id: string) => `${API_BASE_URL}/notifications/${id}`,
    clear: `${API_BASE_URL}/notifications`,
  },
  ai: {
    optimizePrompt: `${API_BASE_URL}/ai/optimize-prompt`,
  },
} as const;

// API 工具函数
export const apiRequest = async <T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = localStorage.getItem('token');
  
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  // Only set Content-Type if body is not FormData and not already set
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMessage = errorData?.error || `HTTP error! status: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
};

// 流式请求
export const streamRequest = async (
  url: string,
  data: any,
  onMessage: (data: any) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void
) => {
  const token = localStorage.getItem('token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not available');
  }

  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        onComplete?.();
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') {
            onComplete?.();
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            onMessage(parsed);
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Stream error'));
  } finally {
    reader.releaseLock();
  }
};
