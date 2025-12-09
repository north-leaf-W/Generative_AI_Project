import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Sparkles, Users, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import AgentCard from '../components/AgentCard';
import { useAuthStore } from '../stores/auth';
import { useAgentsStore } from '../stores/agents';

interface FloatingElementProps {
  delay?: number;
  x?: number | string;
  y?: number | string;
  className?: string;
}

const FloatingElement = ({ delay = 0, x = 0, y = 0, className = '' }: FloatingElementProps) => (
  <motion.div
    animate={{ 
      y: [0, -20, 0],
      x: [0, 10, 0],
      rotate: [0, 5, -5, 0]
    }}
    transition={{ 
      duration: 5,
      delay,
      repeat: Infinity,
      ease: "easeInOut" 
    }}
    className={`absolute rounded-2xl ${className}`}
    style={{ left: x, top: y }}
  />
);

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuthStore();
  const { agents, isLoading, error, fetchAgents } = useAgentsStore();

  useEffect(() => {
    checkAuth();
    fetchAgents();
  }, [checkAuth, fetchAgents]);

  const features = [
    {
      icon: <Sparkles className="w-6 h-6 text-blue-500" />,
      title: '智能对话',
      description: '基于先进的AI技术，提供自然流畅的对话体验'
    },
    {
      icon: <Users className="w-6 h-6 text-purple-500" />,
      title: '多智能体',
      description: '不同类型的AI智能体，满足各种对话需求'
    },
    {
      icon: <Zap className="w-6 h-6 text-green-500" />,
      title: '实时响应',
      description: '流式输出技术，实现秒级响应和实时对话'
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载智能体中...</p>
        </div>
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
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <FloatingElement className="w-24 h-24 bg-blue-400/20 blur-xl" x="10%" y="20%" delay={0} />
          <FloatingElement className="w-32 h-32 bg-purple-400/20 blur-xl" x="80%" y="10%" delay={2} />
          <FloatingElement className="w-16 h-16 bg-pink-400/20 blur-xl" x="15%" y="60%" delay={1} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 tracking-tight"
          >
            与AI智能体
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ml-4">
              智能对话
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed"
          >
            体验下一代AI对话技术，与专业的智能体进行自然流畅的交流，
            获得智能化的问答服务和个性化的对话体验。
          </motion.p>
          
          {!user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-50 transition-colors border border-blue-200"
              >
                立即登录
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
              >
                免费注册
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Agents Section */}
      <section id="agents-section" className="py-20 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">可用智能体</h2>
            <p className="text-lg text-gray-600">选择您想要对话的AI智能体</p>
          </motion.div>
          
          {agents.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无可用智能体</h3>
              <p className="text-gray-600">请稍后再试或联系管理员</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">平台特色</h2>
            <p className="text-lg text-gray-600">为什么选择我们的AI对话平台</p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-8 rounded-2xl glass hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-white/50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm backdrop-blur-sm">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {user && (
        <section className="py-20 relative z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="glass rounded-[2.5rem] p-12 text-center overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-600/10 pointer-events-none" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4 relative z-10">开始您的AI对话之旅</h2>
              <p className="text-xl text-gray-600 mb-8 relative z-10">
                选择一个智能体，开始您的第一次对话
              </p>
              <button
                onClick={() => document.getElementById('agents-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="relative z-10 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                立即开始
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;
