import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Sparkles, Users, Zap, Search, FileText, Database, Code, Cpu, Layers, Brain, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import AgentCard from '../components/AgentCard';
import Loading from '../components/Loading';
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
  const { user } = useAuthStore();
  const { homeAgents, isLoading, error, fetchHomeAgents, fetchFavorites } = useAgentsStore();

  useEffect(() => {
    fetchHomeAgents(); // 获取热门智能体 (使用独立的首页数据源)
  }, [fetchHomeAgents]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user, fetchFavorites]);

  const features = [
    {
      icon: <Database className="w-6 h-6 text-blue-500" />,
      title: 'RAG 知识引擎',
      description: '基于混合检索（向量+关键词）与双路召回技术，融合私有知识库与实时互联网信息，提供精准、可信的专业回答。'
    },
    {
      icon: <FileText className="w-6 h-6 text-purple-500" />,
      title: '多模态交互',
      description: '支持上传图片、PDF、Word 等多种格式文件，AI 能够深度解析文档内容并进行图文混合对话。'
    },
    {
      icon: <Zap className="w-6 h-6 text-yellow-500" />,
      title: '流式极速响应',
      description: '采用 Server-Sent Events (SSE) 技术，实现打字机式的实时流式输出，让对话如行云流水般自然。'
    },
    {
      icon: <Users className="w-6 h-6 text-green-500" />,
      title: '智能体生态',
      description: '内置多种角色设定的 AI 智能体，支持自定义创建、审核发布与全生命周期管理，打造丰富的智能体社区。'
    },
    {
      icon: <Code className="w-6 h-6 text-pink-500" />,
      title: 'Markdown 增强',
      description: '完美支持代码高亮、表格渲染、数学公式等 Markdown 语法，为开发者和学术用户提供极致的阅读体验。'
    },
    {
      icon: <Sparkles className="w-6 h-6 text-indigo-500" />,
      title: '沉浸式体验',
      description: '采用现代化 Glassmorphism 设计风格，配合 Framer Motion 丝滑动画与趣味跟随交互，细节之处见真章。'
    }
  ];

  const techStack = [
    { name: 'React 18', icon: <Code className="w-5 h-5" /> },
    { name: 'LangChain', icon: <Layers className="w-5 h-5" /> },
    { name: 'Supabase', icon: <Database className="w-5 h-5" /> },
    { name: 'DashScope', icon: <Cpu className="w-5 h-5" /> },
  ];

  // 避免闪烁：仅当没有数据且正在加载时才显示 Loading
  // 如果 homeAgents 已经有数据（缓存），即使在后台更新也不显示 Loading
  const shouldShowLoading = isLoading && homeAgents.length === 0;

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loading size="lg" text="加载智能体中..." />
      </div>
    );
  }

  if (error && homeAgents.length === 0) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => fetchHomeAgents()}
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
            下一代 AI
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ml-4">
              多智能体平台
            </span>
          </motion.h1>
          <motion.div
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: 0.1 }}
             className="flex justify-center gap-3 mb-8"
          >
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center">
              <Database className="w-3 h-3 mr-1" /> RAG 增强
            </span>
            <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex items-center">
              <FileText className="w-3 h-3 mr-1" /> 多模态支持
            </span>
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold flex items-center">
              <Sparkles className="w-3 h-3 mr-1" /> 混合检索
            </span>
          </motion.div>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed"
          >
            融合前沿的 RAG 技术与多模态交互能力，连接私有知识与互联网信息。
            <br className="hidden md:block" />
            体验自然流畅的流式对话，探索无限可能的智能体生态。
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
            <h2 className="text-3xl font-bold text-gray-900 mb-4">热门智能体</h2>
            <p className="text-lg text-gray-600 mb-8">探索最受欢迎的AI智能体</p>
          </motion.div>
          
          {homeAgents.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无可用智能体</h3>
              <p className="text-gray-600">请稍后再试或联系管理员</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {homeAgents.slice(0, 8).map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
              
              <div className="mt-12 text-center">
                <button
                  onClick={() => navigate('/square')}
                  className="px-8 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-50 transition-colors border border-blue-200 shadow-sm hover:shadow-md"
                >
                  查看更多智能体
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Innovative Features Section */}
      <section className="py-20 relative z-10 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">前沿创新</h2>
            <p className="text-lg text-gray-600">突破性的 AI 协作与记忆能力</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Multi-Agent Platform */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-8 md:p-12 shadow-xl cursor-pointer"
              onClick={() => navigate('/multi-agent')}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 transform group-hover:scale-110 transition-transform duration-700" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 group-hover:bg-white/30 transition-colors">
                  <Layers className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">综合对话平台</h3>
                <p className="text-blue-100 mb-8 leading-relaxed text-lg">
                  智能意图识别与任务调度引擎。系统会自动分析您的需求，调度最合适的专家智能体协同工作，为您提供一站式的复杂问题解决方案。
                </p>
                <div className="flex items-center text-white font-medium group-hover:translate-x-2 transition-transform">
                  立即体验 <ArrowRight className="w-5 h-5 ml-2" />
                </div>
              </div>
            </motion.div>

            {/* Memory Mechanism */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-500 to-pink-600 text-white p-8 md:p-12 shadow-xl cursor-pointer"
              onClick={() => navigate(user ? '/memory-center' : '/login')}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 transform group-hover:scale-110 transition-transform duration-700" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 group-hover:bg-white/30 transition-colors">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">长期记忆进化</h3>
                <p className="text-purple-100 mb-8 leading-relaxed text-lg">
                  具备成长性的记忆中枢。自动沉淀对话精华，构建您的专属知识图谱。随着使用时间的增加，AI 将越发了解您的偏好与习惯。
                </p>
                <div className="flex items-center text-white font-medium group-hover:translate-x-2 transition-transform">
                  探索记忆 <ArrowRight className="w-5 h-5 ml-2" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative z-10 bg-gradient-to-b from-transparent to-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">核心能力</h2>
            <p className="text-lg text-gray-600">全方位赋能的 AI 对话体验</p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-left p-8 rounded-2xl glass hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/50"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-16 relative z-10 border-t border-gray-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-8">Powered By Modern Tech Stack</p>
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
                {techStack.map((tech, index) => (
                    <div key={index} className="flex items-center gap-2 text-gray-600 font-semibold text-lg">
                        {tech.icon}
                        <span>{tech.name}</span>
                    </div>
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
