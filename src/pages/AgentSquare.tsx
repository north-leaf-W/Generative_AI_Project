import React, { useEffect } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import AgentCard from '../components/AgentCard';
import Loading from '../components/Loading';
import { useAuthStore } from '../stores/auth';
import { useAgentsStore } from '../stores/agents';

// 临时硬编码理工助手的数据，后续应该从后端获取
const ADVANCED_AGENTS = [
  {
    id: 'advanced-polytechnic-assistant', // 这个 ID 需要与后端实际创建的 Agent ID 匹配，或者我们这里先假装展示
    name: '理工助手 (RAG增强版)',
    description: '专为理工学子打造的智能助手。基于RAG技术，内置信控学院政策文件、教务处通知等私有知识库，能够准确回答关于保研、体测、综测等具体问题。',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=polytechnic',
    tags: ['高级智能体', '校园助手', 'RAG'],
    is_advanced: true, // 标记为高级智能体
  }
];

const AgentSquare: React.FC = () => {
  const { user, checkAuth } = useAuthStore();
  const { agents, isLoading, error, fetchAgents, fetchFavorites } = useAgentsStore();
  const [activeTag, setActiveTag] = React.useState('全部');

  const tags = ['全部', '高级智能体', '效率工具', '文本创作', '学习教育', '代码助手', '生活方式', '游戏娱乐', '角色扮演'];

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user, fetchFavorites]);

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
  };

  const filteredAgents = React.useMemo(() => {
    let allAgents = [...agents];
    
    // 如果是"全部"或"高级智能体"，我们把硬编码的理工助手加进去显示（仅作展示用，实际点击交互需要真实ID）
    // 注意：这里只是前端展示层面的 Hack，实际逻辑中应该在数据库创建这个 Agent 并通过 API 返回
    // 为了演示效果，我们先不合并 ADVANCED_AGENTS 到普通列表，而是单独渲染一个板块
    
    if (activeTag === '全部') return agents;
    return agents.filter(agent => agent.tags && agent.tags.includes(activeTag));
  }, [agents, activeTag]);

  if (isLoading && agents.length === 0) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loading size="lg" text="加载智能体中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => fetchAgents()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent overflow-hidden">
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">智能体广场</h2>
            <p className="text-lg text-gray-600 mb-8">浏览我们所有的AI智能体</p>
            
            {/* 标签筛选 */}
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeTag === tag
                      ? 'bg-blue-600 text-white shadow-md transform scale-105'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </motion.div>
          
          {/* 高级智能体板块 (仅在"全部"或"高级智能体"标签下显示) */}
          {(activeTag === '全部' || activeTag === '高级智能体') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="flex items-center mb-6">
                <Sparkles className="w-6 h-6 text-yellow-500 mr-2" />
                <h3 className="text-2xl font-bold text-gray-900">高级智能体</h3>
                <span className="ml-3 px-3 py-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded-full">
                  RAG 增强
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {/* 这里我们需要从数据库中获取真实的理工助手 Agent。
                     为了演示，如果数据库里还没创建，您可以手动创建一个 Agent 并给它打上 "高级智能体" 的 Tag。
                     下面的代码会过滤出所有带有 "高级智能体" Tag 的 Agent 显示在这里。
                 */}
                 {agents.filter(a => a.tags?.includes('高级智能体')).length > 0 ? (
                    agents.filter(a => a.tags?.includes('高级智能体')).map((agent) => (
                      <AgentCard key={agent.id} agent={agent} />
                    ))
                 ) : (
                   // 如果没有真实的，显示一个占位提示卡片，引导用户去创建
                   <div className="col-span-full bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                     <p className="text-yellow-800">
                       还没有检测到高级智能体。请在后台创建一个智能体，并添加 "高级智能体" 标签，且在 Config 中开启 RAG。
                     </p>
                   </div>
                 )}
              </div>
            </motion.div>
          )}

          {activeTag !== '高级智能体' && (
            <>
              <div className="flex items-center mb-6">
                <MessageSquare className="w-6 h-6 text-blue-500 mr-2" />
                <h3 className="text-2xl font-bold text-gray-900">
                  {activeTag === '全部' ? '所有智能体' : activeTag}
                </h3>
              </div>

              {filteredAgents.filter(a => !a.tags?.includes('高级智能体')).length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                  <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无可用智能体</h3>
                  <p className="text-gray-600">该分类下暂无智能体</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredAgents.filter(a => !a.tags?.includes('高级智能体')).map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </section>
    </div>
  );
};

export default AgentSquare;
