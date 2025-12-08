import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, MessageSquare, Edit2, Trash2, Clock, Globe, Lock, UploadCloud, EyeOff, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useAgentsStore } from '../stores/agents';
import AgentCard from '../components/AgentCard';
import { Agent } from '../../shared/types';

const MyAgents: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { myAgents, isLoading, error, fetchMyAgents, updateAgentStatus, updateAgent } = useAgentsStore();
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchMyAgents();
  }, [user, navigate, fetchMyAgents]);

  const handlePublish = async (agent: Agent) => {
    if (window.confirm('确定要申请发布该智能体吗？发布后需等待管理员审核。')) {
      setProcessingId(agent.id);
      try {
        // 使用 updateAgent 接口并指定 action 为 'publish'，这样会触发后端的审核流程
        // 而不是直接调用 updateAgentStatus（该接口仅限管理员使用）
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
    }
  };

  const handleTakeDown = async (agent: Agent) => {
    if (window.confirm('确定要下架该智能体吗？下架后其他用户将无法看到。')) {
      setProcessingId(agent.id);
      try {
        await updateAgentStatus(agent.id, 'private');
        await fetchMyAgents();
      } finally {
        setProcessingId(null);
      }
    }
  };

  if (isLoading && myAgents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">我的智能体</h1>
            <p className="mt-2 text-gray-600">管理您创建的智能体，查看状态和详情</p>
          </div>
          <Link
            to="/agents/create"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            创建智能体
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-8">
            {error}
          </div>
        )}

        {myAgents.length === 0 ? (
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
              <div key={agent.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                 <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full inline-flex items-center ${
                          isPublic 
                            ? 'bg-green-100 text-green-700' 
                            : isPending || hasPendingRevision
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {isPublic ? <Globe className="w-3 h-3 mr-1" /> : isPending || hasPendingRevision ? <Clock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                          {isPublic ? '已发布' : (isPending ? '审核中' : (hasPendingRevision ? '修改审核中' : '已保存'))}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 mb-4">
                      <img
                        src={agent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=random`}
                        alt={agent.name}
                        className="w-12 h-12 rounded-full object-cover border border-gray-200"
                      />
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 line-clamp-1">{agent.name}</h3>
                        <p className="text-sm text-gray-500 line-clamp-1">{agent.category || '通用'}</p>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4 h-10">
                      {agent.description || '暂无描述'}
                    </p>
                 </div>
                 
                 <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <Link
                      to={`/chat/${agent.id}`}
                      state={{ mode: 'dev' }}
                      className="text-gray-600 hover:text-blue-600 font-medium text-sm flex items-center"
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      对话
                    </Link>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-3">
                      {/* 只有私有或已发布状态可以编辑，审核中不能编辑以免冲突 */}
                      {(!isPending && !hasPendingRevision) && (
                        <Link
                           to={`/agents/edit/${agent.id}`}
                           className="text-gray-600 hover:text-blue-600 font-medium text-sm flex items-center"
                           title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                      )}

                      {isPrivate && (
                        <button
                          onClick={() => handlePublish(agent)}
                          disabled={processingId === agent.id}
                          className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center disabled:opacity-50"
                        >
                          {processingId === agent.id ? (
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1" />
                          ) : (
                            <UploadCloud className="w-4 h-4 mr-1" />
                          )}
                          发布
                        </button>
                      )}

                      {isPublic && (
                        <button
                          onClick={() => handleTakeDown(agent)}
                          disabled={processingId === agent.id}
                          className="text-red-600 hover:text-red-700 font-medium text-sm flex items-center disabled:opacity-50"
                        >
                           {processingId === agent.id ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-1" />
                          ) : (
                            <EyeOff className="w-4 h-4 mr-1" />
                          )}
                          下架
                        </button>
                      )}
                      
                      {/* 如果有待审核的修改，显示提示 */}
                      {hasPendingRevision && (
                         <span className="text-yellow-600 text-xs flex items-center" title="您提交的修改正在审核中，审核通过前线上版本保持不变">
                            <Clock className="w-3 h-3 mr-1" />
                            修改审核中
                         </span>
                      )}
                    </div>
                 </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAgents;