import { create } from 'zustand';
import { Agent, ApiResponse, CreateAgentRequest } from '../../shared/types';
import { API_ENDPOINTS, apiRequest } from '../config/api';

interface AgentsState {
  agents: Agent[];
  myAgents: Agent[];
  myFavorites: Agent[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchAgents: (tag?: string, sort?: 'hot' | 'new' | 'hot_asc' | 'new_asc') => Promise<void>;
  fetchMyAgents: () => Promise<void>;
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (agent: Agent) => Promise<boolean>;
  fetchAgent: (id: string) => Promise<Agent | null>;
  createAgent: (data: CreateAgentRequest) => Promise<Agent | null>;
  fetchPendingAgents: () => Promise<void>; // 新增
  updateAgentStatus: (id: string, status: 'public' | 'private' | 'pending', isRevision?: boolean, revisionId?: string) => Promise<boolean>; // 修改
  updateAgent: (id: string, data: Partial<Agent>, action?: 'save' | 'publish') => Promise<{ success: boolean; message?: string }>; // 修改
  deleteAgent: (id: string) => Promise<boolean>; // 新增
  clearError: () => void;
  pendingAgents: Agent[]; // 新增
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  myAgents: [],
  myFavorites: [],
  pendingAgents: [], // 新增
  isLoading: true, // 初始为加载中
  error: null,

  fetchAgents: async (tag?: string, sort?: 'hot' | 'new' | 'hot_asc' | 'new_asc') => {
    set({ isLoading: true, error: null });
    
    try {
      let url = API_ENDPOINTS.agents.list;
      const params = new URLSearchParams();
      
      if (tag && tag !== '全部') {
        params.append('tag', tag);
      }
      
      if (sort) {
        params.append('sort', sort);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await apiRequest<ApiResponse<Agent[]>>(url, {
        method: 'GET',
      });

      if (response.success && response.data) {
        // console.log('Fetched agents:', response.data); // Debug: Check if favorites_count is present
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

  fetchFavorites: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiRequest<ApiResponse<Agent[]>>(API_ENDPOINTS.agents.favorites, {
        method: 'GET',
      });
      if (response.success && response.data) {
        set({ 
          myFavorites: response.data, 
          isLoading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Fetch favorites error', error);
      set({ isLoading: false });
    }
  },

  toggleFavorite: async (agent: Agent) => {
    // Ensure we use the latest state from the store
    const currentAgent = get().agents.find(a => a.id === agent.id) || 
                        get().myFavorites.find(a => a.id === agent.id) || 
                        get().myAgents.find(a => a.id === agent.id) || 
                        agent;
                        
    const isFav = currentAgent.is_favorited;
    const method = isFav ? 'DELETE' : 'POST';
    
    // Optimistic update
    const updateList = (list: Agent[]) => list.map(a => a.id === agent.id ? { ...a, is_favorited: !isFav } : a);
    
    set(state => ({
      agents: updateList(state.agents),
      myAgents: updateList(state.myAgents),
      myFavorites: isFav 
        ? state.myFavorites.filter(a => a.id !== agent.id) 
        : [...state.myFavorites, { ...currentAgent, is_favorited: true }]
    }));

    try {
      const response = await apiRequest(API_ENDPOINTS.agents.favorite(agent.id), { method });
      if (!response.success) throw new Error(response.error);
      return true;
    } catch (error) {
      console.error('Toggle favorite failed', error);
      // Revert
      const revertList = (list: Agent[]) => list.map(a => a.id === agent.id ? { ...a, is_favorited: isFav } : a);
      set(state => ({
        agents: revertList(state.agents),
        myAgents: revertList(state.myAgents),
        myFavorites: isFav 
          ? [...state.myFavorites, { ...currentAgent, is_favorited: true }] 
          : state.myFavorites.filter(a => a.id !== agent.id)
      }));
      return false;
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

  deleteAgent: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiRequest<ApiResponse<void>>(API_ENDPOINTS.agents.delete(id), {
        method: 'DELETE',
      });

      if (response.success) {
        set((state) => ({
          myAgents: state.myAgents.filter(a => a.id !== id),
          agents: state.agents.filter(a => a.id !== id),
          isLoading: false,
          error: null
        }));
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete agent');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除智能体失败';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
      return false;
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