// 用户类型
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role?: 'user' | 'admin';
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
  creator_id?: string;
  status?: 'private' | 'pending' | 'public';
  category?: string;
  tags?: string[];
  creator?: {
    name: string;
    email?: string;
  };
  has_pending_revision?: boolean; // 前端辅助字段，表示是否有待审核的修改
  is_favorited?: boolean; // 前端辅助字段，表示是否已收藏
}

// 智能体修订版本
export interface AgentRevision {
  id: string;
  agent_id: string;
  creator_id: string;
  changes: Partial<Agent>; // 存储变更的字段
  status: 'pending' | 'rejected' | 'draft';
  admin_feedback?: string;
  created_at: string;
  updated_at: string;
}

// 通知类型
export interface Notification {
  id: string;
  user_id: string;
  type: 'system' | 'audit_approved' | 'audit_rejected';
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  system_prompt: string;
  avatar_url?: string;
  tags?: string[];
  status?: 'private' | 'public'; // 用户只能请求 private 或 public（实际上可能是 pending）
}

// 会话类型
export interface Session {
  id: string;
  user_id: string;
  agent_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  mode: 'public' | 'dev'; // 区分公开环境和开发环境
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
  message?: string;
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
  webSearch?: boolean;
}

export interface ChatResponse {
  message: string;
  done?: boolean;
}

export interface CreateSessionRequest {
  agentId: string;
  title?: string;
  mode?: 'public' | 'dev';
}