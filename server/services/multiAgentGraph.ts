import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { createDashScopeModel } from "./langchain.js";
import { createClient } from '@supabase/supabase-js';
import { supabase } from "../config/supabase.js";

// Define the state interface
interface MultiAgentState {
  messages: BaseMessage[];
  selectedAgentId?: string;
  agentResponse?: string;
}

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
}

// Fetch available agents (excluding advanced ones)
async function getAvailableAgents(): Promise<AgentInfo[]> {
  const { data: agents, error } = await supabase
    .from('agents')
    .select('id, name, description, system_prompt, tags')
    .eq('status', 'public')
    .eq('is_active', true);

  if (error || !agents) {
    console.error("Error fetching agents:", error);
    return [];
  }

  // Filter out advanced agents
  // Logic: Exclude if tags contains "高级智能体"
  // Also check if tags is null/undefined
  return agents.filter(a => {
    const tags = a.tags || [];
    return !tags.includes('高级智能体');
  }).map(a => ({
    id: a.id,
    name: a.name,
    description: a.description || "No description provided.",
    system_prompt: a.system_prompt
  }));
}

// Supervisor Node
async function supervisorNode(state: MultiAgentState, config?: any): Promise<Partial<MultiAgentState>> {
  const agents = await getAvailableAgents();
  
  const systemPrompt = `你是一个智能对话平台的总控路由助手。你的任务是根据用户的输入，从现有的智能体列表中选择最合适的一个来回答用户的问题。

现有智能体列表：
${agents.map((a, i) => `${i + 1}. [${a.name}]: ${a.description}`).join('\n')}

请分析用户的意图：
1. 如果用户的问题明显适合某个特定智能体，请返回该智能体的名称。
2. 如果用户的问题比较通用，或者没有合适的特定智能体，或者是在闲聊/打招呼，请返回 "DEFAULT"。

请严格按照以下 JSON 格式输出，不要包含其他内容：
{
  "reasoning": "你的分析过程",
  "selected_agent_name": "智能体名称 或 DEFAULT"
}`;

  const model = createDashScopeModel();
  
  // Get the last user message
  const lastMessage = state.messages[state.messages.length - 1];
  
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    lastMessage
  ]);

  const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  
  let selectedAgentId = "DEFAULT";
  try {
    // Try to parse JSON. Some LLMs might wrap in markdown code blocks.
    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanContent);
    const agentName = parsed.selected_agent_name;
    
    if (agentName && agentName !== "DEFAULT") {
      const found = agents.find(a => a.name === agentName);
      if (found) {
        selectedAgentId = found.id;
      }
    }
  } catch (e) {
    console.warn("Failed to parse supervisor response:", content);
    // Fallback to default
  }

  return { selectedAgentId };
}

// Build the graph for Routing only
const routingWorkflow = new StateGraph<MultiAgentState>({
    channels: {
        messages: {
            reducer: (a: BaseMessage[], b: BaseMessage[]) => a.concat(b),
            default: () => [],
        },
        selectedAgentId: {
            reducer: (a: string | undefined, b: string | undefined) => b ?? a,
            default: () => undefined,
        },
        agentResponse: {
            reducer: (a: string | undefined, b: string | undefined) => b ?? a,
            default: () => undefined,
        }
    }
})
  .addNode("supervisor", supervisorNode)
  .addEdge(START, "supervisor")
  .addEdge("supervisor", END);

export const routingGraph = routingWorkflow.compile();

export async function getAgentSystemPrompt(agentId: string): Promise<string> {
    if (agentId === "DEFAULT") return "你是一个乐于助人的AI助手。";
    
    const { data: agent } = await supabase
      .from('agents')
      .select('system_prompt')
      .eq('id', agentId)
      .single();
      
    return agent?.system_prompt || "你是一个乐于助人的AI助手。";
}
