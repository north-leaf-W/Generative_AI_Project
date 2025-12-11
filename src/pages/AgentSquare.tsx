import React, { useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import AgentCard from '../components/AgentCard';
import Loading from '../components/Loading';
import { useAuthStore } from '../stores/auth';
import { useAgentsStore } from '../stores/agents';

const AgentSquare: React.FC = () => {
  const { user, checkAuth } = useAuthStore();
  const { agents, isLoading, error, fetchAgents, fetchFavorites } = useAgentsStore();
  const [activeTag, setActiveTag] = React.useState('全部');

  const tags = ['全部', '效率工具', '文本创作', '学习教育', '代码助手', '生活方式', '游戏娱乐', '角色扮演'];

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
          
          {filteredAgents.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无可用智能体</h3>
              <p className="text-gray-600">请稍后再试或联系管理员</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AgentSquare;
