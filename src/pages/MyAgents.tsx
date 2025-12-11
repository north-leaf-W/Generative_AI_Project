import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, MessageSquare, Edit2, Clock, Globe, Lock, UploadCloud, EyeOff, Star, LayoutGrid, Trash2 } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useAgentsStore } from '../stores/agents';
import AgentCard from '../components/AgentCard';
import { Agent } from '../../shared/types';
import { motion } from 'framer-motion';
import Loading from '../components/Loading';

const MyAgents: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { myAgents, myFavorites, isLoading, error, fetchMyAgents, fetchFavorites, updateAgentStatus, updateAgent, deleteAgent } = useAgentsStore();
  const [activeTab, setActiveTab] = useState<'created' | 'favorites'>('created');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchMyAgents();
    fetchFavorites();
  }, [user, navigate, fetchMyAgents, fetchFavorites]);

  const handlePublish = (e: React.MouseEvent, agent: Agent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalConfig({
      isOpen: true,
      title: '申请发布',
      message: '确定要申请发布该智能体吗？发布后需等待管理员审核。',
      type: 'info',
      onConfirm: async () => {
        setProcessingId(agent.id);
        try {
          const result = await updateAgent(agent.id, {}, 'publish');
          if (result.success) {
             await fetchMyAgents();
          } else {
             alert(result.message || '发布申请提交失败');
          }
        } catch (err) {
           console.error('Publish error:', err);
           alert('发布申请提交失败，请重试');
        } finally {
          setProcessingId(null);
        }
      },
    });
  };

  const handleTakeDown = (e: React.MouseEvent, agent: Agent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalConfig({
      isOpen: true,
      title: '确认下架',
      message: '确定要下架该智能体吗？下架后其他用户将无法看到。',
      type: 'warning',
      onConfirm: async () => {
        setProcessingId(agent.id);
        try {
          await updateAgentStatus(agent.id, 'private');
          await fetchMyAgents();
        } finally {
          setProcessingId(null);
        }
      },
    });
  };

  const handleDelete = (e: React.MouseEvent, agent: Agent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalConfig({
      isOpen: true,
      title: '确认删除',
      message: '确定要删除该智能体吗？删除后无法恢复。如果该智能体已发布或正在审核中，也将一并删除。',
      type: 'danger',
      onConfirm: async () => {
        setProcessingId(agent.id);
        try {
          const success = await deleteAgent(agent.id);
          if (success) {
            // deleteAgent store action already updates the list
          } else {
             alert('删除失败，请重试');
          }
        } catch (err) {
           console.error('Delete error:', err);
           alert('删除失败，请重试');
        } finally {
          setProcessingId(null);
        }
      },
    });
  };

  if (isLoading && myAgents.length === 0 && myFavorites.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading size="lg" text="加载我的智能体..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">我的智能体</h1>
            <p className="mt-2 text-gray-600">管理您创建和收藏的智能体</p>
          </div>
          <Link
            to="/agents/create"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            创建智能体
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 mb-8 w-fit">
          <button
            onClick={() => setActiveTab('created')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'created'
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            我创建的
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs">
              {myAgents.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'favorites'
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Star className="w-4 h-4 mr-2" />
            我的收藏
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs">
              {myFavorites.length}
            </span>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-8">
            {error}
          </div>
        )}

        {activeTab === 'created' ? (
          myAgents.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">还没有创建智能体</h3>
              <p className="text-gray-500 mb-6">创建一个属于您的专属 AI 助手吧</p>
              <Link
                to="/agents/create"
                className="text-blue-600 font-medium hover:text-blue-700 flex items-center justify-center"
              >
                立即创建
                <span aria-hidden="true" className="ml-1">&rarr;</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myAgents.map((agent) => {
              const isPending = agent.status === 'pending';
              const isPublic = agent.status === 'public';
              const isPrivate = agent.status === 'private';
              const hasPendingRevision = (agent as any).has_pending_revision;

              return (
              <motion.div
                key={agent.id}
                whileHover={{ y: -2 }}
                transition={{ type: "tween", duration: 0.2 }}
                className="bg-white rounded-2xl shadow-sm hover:shadow-lg border border-gray-200 overflow-hidden flex flex-col transition-all duration-300"
                onClick={() => navigate(`/chat/${agent.id}`, { state: { mode: 'dev' } })}
              >
                 <div className="p-6 flex-1 cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-3">
                         <div className="relative">
                            <img
                              src={agent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=random`}
                              alt={agent.name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                            />
                            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                                isPublic ? 'bg-green-500' : isPending || hasPendingRevision ? 'bg-yellow-500' : 'bg-gray-500'
                            }`} />
                         </div>
                         <div>
                            <h3 className="text-lg font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600">{agent.name}</h3>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {agent.tags && agent.tags.length > 0 ? (
                                    agent.tags.slice(0, 2).map((tag, index) => (
                                        <span key={index} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-md border border-blue-100 font-medium">
                                            {tag}
                                        </span>
                                    ))
                                ) : (
                                    <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[10px] rounded-md border border-gray-100 font-medium">
                                        {agent.category || '通用'}
                                    </span>
                                )}
                            </div>
                         </div>
                      </div>
                      
                      <span 
                        className={`px-2 py-0.5 text-[10px] font-medium rounded-full inline-flex items-center ${
                          isPublic 
                            ? 'bg-green-50 text-green-700 border border-green-100' 
                            : isPending || hasPendingRevision
                            ? 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                            : 'bg-gray-50 text-gray-700 border border-gray-100'
                        }`}
                        title={hasPendingRevision ? "您提交的修改正在审核中，审核通过前线上版本保持不变" : undefined}
                      >
                          {isPublic && hasPendingRevision 
                            ? '已发布，新版本审核中' 
                            : isPublic 
                              ? '已发布' 
                              : (isPending ? '审核中' : (hasPendingRevision ? '修改审核中' : '已保存'))
                          }
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm line-clamp-2 mb-2 h-10 leading-relaxed">
                      {agent.description || '暂无描述'}
                    </p>
                 </div>
                 
                 <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-gray-400 font-medium flex items-center">
                        <MessageSquare className="w-3.5 h-3.5 mr-1" />
                        点击卡片调试
                    </span>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2">
                      {/* 始终显示编辑按钮，方便用户修改 */}
                      <Link
                         to={`/agents/edit/${agent.id}`}
                         className="text-gray-500 hover:text-blue-600 transition-colors p-1.5 hover:bg-blue-50 rounded-full"
                         title="编辑"
                         onClick={(e) => e.stopPropagation()}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>

                      <button
                        onClick={(e) => handleDelete(e, agent)}
                        disabled={processingId === agent.id}
                        className="text-gray-500 hover:text-red-600 transition-colors p-1.5 hover:bg-red-50 rounded-full"
                        title="删除"
                      >
                         {processingId === agent.id ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                      </button>

                      {isPrivate && (
                        <button
                          onClick={(e) => handlePublish(e, agent)}
                          disabled={processingId === agent.id}
                          className="text-blue-600 hover:text-blue-700 font-medium text-xs flex items-center disabled:opacity-50 px-2 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                        >
                          {processingId === agent.id ? (
                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1" />
                          ) : (
                            <UploadCloud className="w-3 h-3 mr-1" />
                          )}
                          发布
                        </button>
                      )}

                      {isPublic && (
                        <button
                          onClick={(e) => handleTakeDown(e, agent)}
                          disabled={processingId === agent.id}
                          className="text-red-600 hover:text-red-700 font-medium text-xs flex items-center disabled:opacity-50 px-2 py-1 bg-red-50 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
                        >
                           {processingId === agent.id ? (
                            <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-1" />
                          ) : (
                            <EyeOff className="w-3 h-3 mr-1" />
                          )}
                          下架
                        </button>
                      )}
                      
                      {/* 如果有待审核的修改，显示提示 - 已合并到右上角状态显示 */}
                    </div>
                 </div>
              </motion.div>
            )})} 
          </div>
          )
        ) : null}

        {/* 收藏列表 */}
        {activeTab === 'favorites' && (
          myFavorites.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">还没有收藏智能体</h3>
              <p className="text-gray-500 mb-6">在智能体广场发现并收藏您喜欢的智能体</p>
              <Link
                to="/"
                className="text-blue-600 font-medium hover:text-blue-700 flex items-center justify-center"
              >
                去探索
                <span aria-hidden="true" className="ml-1">&rarr;</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myFavorites.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )
        )}
        
        {modalConfig.isOpen && (
           <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
             <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
               <h3 className="text-lg font-bold text-gray-900 mb-2">{modalConfig.title}</h3>
               <p className="text-gray-600 mb-6">{modalConfig.message}</p>
               <div className="flex justify-end gap-3">
                 <button 
                   onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                   className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                 >
                   取消
                 </button>
                 <button
                   onClick={() => {
                     modalConfig.onConfirm();
                     setModalConfig(prev => ({ ...prev, isOpen: false }));
                   }}
                   className={`px-4 py-2 text-white rounded-lg font-medium ${
                     modalConfig.type === 'danger' ? 'bg-red-500 hover:bg-red-600' :
                     modalConfig.type === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600' :
                     'bg-blue-500 hover:bg-blue-600'
                   }`}
                 >
                   确定
                 </button>
               </div>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default MyAgents;
