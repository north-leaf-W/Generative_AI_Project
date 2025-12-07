// 用户类型
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// 智能体类型
export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  system_prompt?: string;
  config?: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

// 会话类型
export interface Session {
  id: string;
  user_id: string;
  agent_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

// 消息类型
export interface Message {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 认证相关类型
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface UpdateProfileRequest {
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// 聊天相关类型
export interface ChatRequest {
  sessionId: string;
  message: string;
  agentId: string;
}

export interface ChatResponse {
  message: string;
  done?: boolean;
}

export interface CreateSessionRequest {
  agentId: string;
  title?: string;
}