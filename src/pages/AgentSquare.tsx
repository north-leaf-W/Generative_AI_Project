import React, { useEffect } from 'react';
import { MessageSquare, Sparkles, ChevronDown, Filter } from 'lucide-react';
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

type SortOption = 'new' | 'new_asc' | 'hot' | 'hot_asc';

const AgentSquare: React.FC = () => {
  const { user } = useAuthStore();
  const { agents, isLoading, error, fetchAgents, fetchFavorites, currentSort: storeSort, currentTag: storeTag } = useAgentsStore();
  
  // 初始化时优先使用 Store 中的状态，避免重复加载
  const [activeTag, setActiveTag] = React.useState(storeTag || '全部');
  const [currentSort, setCurrentSort] = React.useState<SortOption>(storeSort || 'new');
  const [isSortOpen, setIsSortOpen] = React.useState(false);

  // 移除 '高级智能体' 标签
  const tags = ['全部', '效率工具', '文本创作', '学习教育', '代码助手', '生活方式', '游戏娱乐', '角色扮演'];

  const sortOptions = [
    { value: 'new', label: '最新发布 (降序)' },
    { value: 'new_asc', label: '最新发布 (升序)' },
    { value: 'hot', label: '最受欢迎 (降序)' },
    { value: 'hot_asc', label: '最受欢迎 (升序)' },
  ];

  // 修改：仅在组件挂载或 store 中没有数据时加载一次，之后切换标签不再请求后端
  useEffect(() => {
    // 只有当 agents 为空时才去加载（或者你可以加一个强制刷新的按钮供用户手动刷新）
    // 为了保证数据新鲜度，这里我们还是加载一次，但不依赖 activeTag 和 currentSort
    // fetchAgents('全部', 'new'); // 移除这行，避免组件初始化时重复请求
  }, []); // 依赖项移除 activeTag 和 currentSort，实现一次性加载

  // 确保在组件挂载时检查一次数据，如果没有数据则加载
  useEffect(() => {
    if (agents.length === 0) {
        fetchAgents('全部', 'new');
    }
  }, [agents.length, fetchAgents]);

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
  };

  const handleSortChange = (sort: SortOption) => {
    setCurrentSort(sort);
    setIsSortOpen(false);
  };

  // 前端筛选和排序逻辑
  const filteredAgents = React.useMemo(() => {
    // 1. 筛选
    let result = [...agents];
    if (activeTag !== '全部') {
      result = result.filter(agent => agent.tags && agent.tags.includes(activeTag));
    }
    
    // 2. 排序
    result.sort((a, b) => {
      if (currentSort === 'hot') {
        // 最受欢迎（降序）
        const diff = (b.favorites_count || 0) - (a.favorites_count || 0);
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (currentSort === 'hot_asc') {
        // 最受欢迎（升序）
        const diff = (a.favorites_count || 0) - (b.favorites_count || 0);
        if (diff !== 0) return diff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (currentSort === 'new_asc') {
        // 最新发布（升序）
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        // 最新发布（降序） - 默认
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [agents, activeTag, currentSort]);

  // 优化加载体验：仅当正在加载且没有有效数据时显示Loading
  const shouldShowLoading = isLoading && agents.length === 0;

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
          </motion.div>
          
          {/* 高级智能体板块 (始终显示，但根据标签筛选内容) */}
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
                {shouldShowLoading ? (
                  // Loading 状态：显示骨架屏或 Loading 组件
                  <div className="col-span-full py-12 flex justify-center items-center">
                    <Loading size="md" text="正在加载高级智能体..." />
                  </div>
                ) : (
                  <>
                    {/* 筛选出高级智能体，同时应用当前的 activeTag 筛选（如果是"全部"，则显示所有高级智能体） */}
                    {(() => {
                        const advancedAgents = agents.filter(a => a.tags?.includes('高级智能体'));
                        // 如果选了特定标签，高级智能体也应该参与筛选吗？
                        // 用户需求："选择除了“全部”以外的标签时，还是会把高级智能体板块给隐藏掉，这不对"
                        // -> 这意味着高级智能体板块应该始终显示，且内容应该是"高级智能体"的集合，不应该被 activeTag 过滤掉，或者应该被过滤？
                        // 通常"高级置顶"意味着它们不受普通筛选影响，或者是受影响但板块保留。
                        // 根据"高级智能体不参与筛选和排序"的描述，这里应该始终显示所有高级智能体。
                        const displayAgents = advancedAgents; 

                        if (displayAgents.length > 0) {
                            return displayAgents.map((agent) => (
                                <AgentCard key={agent.id} agent={agent} />
                            ));
                        } else {
                            return (
                                <div className="col-span-full bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                                    <p className="text-yellow-800">
                                    还没有检测到高级智能体。请在后台创建一个智能体，并添加 "高级智能体" 标签，且在 Config 中开启 RAG。
                                    </p>
                                </div>
                            );
                        }
                    })()}
                  </>
                )}
            </div>
          </motion.div>

          {/* 筛选和排序区域 - 移至高级智能体下方 */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm sticky top-20 z-40 backdrop-blur-xl bg-white/80">
              <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                <span className="text-sm font-medium text-gray-500 whitespace-nowrap">筛选：</span>
                <div className="flex gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        activeTag === tag
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* 排序下拉菜单 */}
              <div className="relative min-w-[160px] flex-shrink-0">
                <button
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-between shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span>{sortOptions.find(opt => opt.value === currentSort)?.label}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSortOpen && (
                  <div className="absolute top-full right-0 mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSortChange(option.value as SortOption)}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                          currentSort === option.value ? 'text-blue-600 bg-blue-50/50 font-medium' : 'text-gray-600'
                        }`}
                      >
                        {option.label}
                        {currentSort === option.value && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
          </div>

          {activeTag !== '高级智能体' && (
            <div className="relative min-h-[300px]"> {/* 确保有最小高度，防止 Loading 时高度坍塌 */}
              <div className="flex items-center mb-6">
                <MessageSquare className="w-6 h-6 text-blue-500 mr-2" />
                <h3 className="text-2xl font-bold text-gray-900">
                  {activeTag === '全部' ? '更多智能体' : activeTag}
                </h3>
              </div>
              
              {/* 如果没有智能体且不在加载中 */}
              {filteredAgents.filter(a => !a.tags?.includes('高级智能体')).length === 0 && !isLoading ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                  <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无可用智能体</h3>
                  <p className="text-gray-600">该分类下暂无智能体</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-opacity duration-300">
                  {filteredAgents.filter(a => !a.tags?.includes('高级智能体')).map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </section>
    </div>
  );
};

export default AgentSquare;
