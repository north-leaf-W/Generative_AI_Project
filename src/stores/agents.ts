import { create } from 'zustand';
import { Agent, ApiResponse, CreateAgentRequest } from '../../shared/types';
import { API_ENDPOINTS, apiRequest } from '../config/api';

interface AgentsState {
  agents: Agent[];
  myAgents: Agent[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchAgents: () => Promise<void>;
  fetchMyAgents: () => Promise<void>;
  fetchAgent: (id: string) => Promise<Agent | null>;
  createAgent: (data: CreateAgentRequest) => Promise<Agent | null>;
  fetchPendingAgents: () => Promise<void>; // 新增
  updateAgentStatus: (id: string, status: 'public' | 'private' | 'pending', isRevision?: boolean, revisionId?: string) => Promise<boolean>; // 修改
  updateAgent: (id: string, data: Partial<Agent>, action?: 'save' | 'publish') => Promise<{ success: boolean; message?: string }>; // 修改
  clearError: () => void;
  pendingAgents: Agent[]; // 新增
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  myAgents: [],
  pendingAgents: [], // 新增
  isLoading: true, // 初始为加载中
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<Agent[]>>(API_ENDPOINTS.agents.list, {
        method: 'GET',
      });

      if (response.success && response.data) {
        set({ 
          agents: response.data, 
          isLoading: false,
          error: null
        });
      } else {
        throw new Error(response.error || 'Failed to fetch agents');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取智能体列表失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
    }
  },

  fetchMyAgents: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<Agent[]>>(API_ENDPOINTS.agents.my, {
        method: 'GET',
      });

      if (response.success && response.data) {
        set({ 
          myAgents: response.data, 
          isLoading: false,
          error: null
        });
      } else {
        throw new Error(response.error || 'Failed to fetch my agents');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取我的智能体列表失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
    }
  },

  fetchPendingAgents: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<Agent[]>>(API_ENDPOINTS.agents.pending, {
        method: 'GET',
      });

      if (response.success && response.data) {
        set({ 
          pendingAgents: response.data, 
          isLoading: false,
          error: null
        });
      } else {
        throw new Error(response.error || 'Failed to fetch pending agents');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取待审核智能体列表失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
    }
  },

  updateAgentStatus: async (id: string, status: 'public' | 'private' | 'pending', isRevision?: boolean, revisionId?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<Agent>>(API_ENDPOINTS.agents.updateStatus(id), {
        method: 'PATCH',
        body: JSON.stringify({ status, isRevision, revisionId }),
      });

      if (response.success) {
        set((state) => ({
          // 更新 pendingAgents 列表
          pendingAgents: state.pendingAgents.filter(a => isRevision ? (a as any).revision_id !== revisionId : a.id !== id),
          // 如果是 public，可能需要添加到 agents 列表 (如果是新发布的)
          // 简化起见，让用户刷新或自动重新获取
          isLoading: false,
          error: null
        }));
        // 重新获取列表以保持同步
        get().fetchPendingAgents();
        get().fetchAgents();
        return true;
      } else {
        throw new Error(response.error || 'Failed to update agent status');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新智能体状态失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
      return false;
    }
  },

  updateAgent: async (id: string, data: Partial<Agent>, action: 'save' | 'publish' = 'save') => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<Agent>>(API_ENDPOINTS.agents.update(id), {
        method: 'PATCH',
        body: JSON.stringify({ ...data, action }),
      });

      if (response.success) {
        set({ 
          isLoading: false,
          error: null
        });
        // 重新获取我的智能体
        await get().fetchMyAgents();
        return { success: true, message: response.message };
      } else {
        throw new Error(response.error || 'Failed to update agent');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新智能体失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
      return { success: false, message: errorMessage };
    }
  },

  createAgent: async (data: CreateAgentRequest) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<Agent>>(API_ENDPOINTS.agents.create, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success && response.data) {
        // 创建成功后刷新我的智能体列表，并将其添加到公共列表中（如果是自己的，在首页也能看到）
        const newAgent = response.data;
        const { myAgents, agents } = get();
        
        set({
          myAgents: [newAgent, ...myAgents],
          agents: [newAgent, ...agents], // 乐观更新
          isLoading: false,
          error: null
        });
        
        return newAgent;
      } else {
        throw new Error(response.error || 'Failed to create agent');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建智能体失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
      return null;
    }
  },

  fetchAgent: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<Agent>>(API_ENDPOINTS.agents.detail(id), {
        method: 'GET',
      });

      if (response.success && response.data) {
        set({ 
          isLoading: false,
          error: null
        });
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to fetch agent');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取智能体详情失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
      return null;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));