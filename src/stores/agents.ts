import { create } from 'zustand';
import { Agent, ApiResponse } from '../../shared/types';
import { API_ENDPOINTS, apiRequest } from '../config/api';

interface AgentsState {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchAgents: () => Promise<void>;
  fetchAgent: (id: string) => Promise<Agent | null>;
  clearError: () => void;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  isLoading: false,
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