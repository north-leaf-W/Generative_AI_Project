import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle, MessageSquare, FileText, EyeOff } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useAgentsStore } from '../stores/agents';
import { Agent } from '../../shared/types';
import ConfirmationModal from '../components/ConfirmationModal';

const AdminAgents: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    pendingAgents, 
    agents, 
    isLoading, 
    error, 
    fetchPendingAgents, 
    fetchAgents, 
    updateAgentStatus,
    clearError
  } = useAgentsStore();
  
  const [activeTab, setActiveTab] = useState<'pending' | 'manage'>('pending');
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
    if (user.role !== 'admin') {
      navigate('/');
      return;
    }
    clearError();
    fetchPendingAgents();
    fetchAgents();
  }, [user, navigate, fetchPendingAgents, fetchAgents, clearError]);

  const handleApprove = (agent: Agent) => {
    const isRevision = (agent as any).status === 'pending_revision';
    const revisionId = (agent as any).revision_id;
    
    setModalConfig({
      isOpen: true,
      title: isRevision ? '确认通过修改' : '确认发布智能体',
      message: isRevision ? '确认通过该智能体的修改申请？修改将立即生效。' : '确认通过该智能体的发布申请？通过后将显示在广场。',
      type: 'success',
      onConfirm: async () => {
        await updateAgentStatus(agent.id, 'public', isRevision, revisionId);
      },
    });
  };

  const handleReject = (agent: Agent) => {
    const isRevision = (agent as any).status === 'pending_revision';
    const revisionId = (agent as any).revision_id;

    setModalConfig({
      isOpen: true,
      title: isRevision ? '确认拒绝修改' : '确认拒绝申请',
      message: isRevision ? '确认拒绝该修改申请？' : '确认拒绝并转为私有状态？',
      type: 'danger',
      onConfirm: async () => {
        await updateAgentStatus(agent.id, 'private', isRevision, revisionId);
      },
    });
  };

  const handleTakeDown = (id: string) => {
    setModalConfig({
      isOpen: true,
      title: '确认下架',
      message: '确认下架该智能体？下架后用户将无法在广场看到它，但持有者仍可在"我的智能体"中看到。',
      type: 'warning',
      onConfirm: async () => {
        await updateAgentStatus(id, 'private');
        fetchAgents();
      },
    });
  };

  if (isLoading && pendingAgents.length === 0 && agents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // 过滤出公共智能体用于管理（不包括待审核的）
  const publicAgents = agents.filter(a => a.status === 'public');

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-blue-600" />
              智能体管理后台
            </h1>
            <p className="mt-2 text-gray-600">审核申请与管理线上智能体</p>
          </div>
          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'pending' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              待审核 ({pendingAgents.length})
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'manage' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              已上架 ({publicAgents.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-8">
            {error}
          </div>
        )}

        {activeTab === 'pending' ? (
          pendingAgents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">没有待审核的申请</h3>
              <p className="text-gray-500">所有新智能体和修改申请都已处理完毕</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {pendingAgents.map((agent) => {
                   const isRevision = (agent as any).status === 'pending_revision';
                   return (
                  <li key={isRevision ? (agent as any).revision_id : agent.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <img
                          src={agent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=random`}
                          alt={agent.name}
                          className="w-12 h-12 rounded-full object-cover border border-gray-200"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-medium text-gray-900">{agent.name}</h4>
                            {isRevision && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <RefreshCw className="w-3 h-3 mr-1" />
                                修改审核
                              </span>
                            )}
                            {!isRevision && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                新发布
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2 max-w-2xl">
                            {agent.description || '无描述'}
                          </p>
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                              ID: {agent.id}
                            </span>
                            <span>
                              创建者: {(agent as any).creator?.name || '未知'} ({(agent as any).creator?.email})
                            </span>
                            <span>
                              提交时间: {new Date(agent.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-3 bg-gray-50 p-3 rounded-lg text-sm text-gray-700 font-mono">
                            <span className="text-xs text-gray-400 block mb-1">System Prompt:</span>
                            {agent.system_prompt}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleApprove(agent)}
                          className="flex items-center space-x-1 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>通过</span>
                        </button>
                        <button
                          onClick={() => handleReject(agent)}
                          className="flex items-center space-x-1 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>拒绝</span>
                        </button>
                      </div>
                    </div>
                  </li>
                )})} 
              </ul>
            </div>
          )
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             {publicAgents.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-gray-500">暂无已上架的智能体</p>
                </div>
             ) : (
              <ul className="divide-y divide-gray-200">
                {publicAgents.map((agent) => (
                  <li key={agent.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img
                          src={agent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=random`}
                          alt={agent.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        />
                        <div>
                          <h4 className="text-base font-medium text-gray-900">{agent.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs text-gray-500">ID: {agent.id}</span>
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                               已上架
                             </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                         <button
                          onClick={() => navigate(`/chat/${agent.id}`, { state: { from: '/admin/agents' } })}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="进入对话"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => navigate(`/agents/edit/${agent.id}`, { state: { from: '/admin/agents', readonly: true } })}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleTakeDown(agent.id)}
                          className="flex items-center space-x-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
                        >
                          <EyeOff className="w-4 h-4" />
                          <span>下架</span>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
             )}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div>
  );
};

export default AdminAgents;