import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle, XCircle, RefreshCw, AlertTriangle, MessageSquare, FileText, EyeOff, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useAgentsStore } from '../stores/agents';
import { Agent } from '../../shared/types';
import ConfirmationModal from '../components/ConfirmationModal';
import Loading from '../components/Loading';

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

  const getChangeSummary = (agent: any) => {
    if (agent.status !== 'pending_revision' || !agent.original_agent) return [];
    
    const changes: { label: string; field: string; oldValue: any; newValue: any }[] = [];
    const original = agent.original_agent;
    
    // Name
    if (agent.name !== original.name) {
      changes.push({ label: '名称修改', field: 'name', oldValue: original.name, newValue: agent.name });
    }
    // Description
    if (agent.description !== original.description) {
      changes.push({ label: '描述修改', field: 'description', oldValue: original.description, newValue: agent.description });
    }
    // System Prompt
    if (agent.system_prompt !== original.system_prompt) {
      changes.push({ label: '提示词修改', field: 'system_prompt', oldValue: original.system_prompt, newValue: agent.system_prompt });
    }
    // Avatar
    if (agent.avatar_url !== original.avatar_url) {
      changes.push({ label: '头像修改', field: 'avatar_url', oldValue: original.avatar_url, newValue: agent.avatar_url });
    }
    // Categories (Tags)
    const originalTags = original.tags || [];
    const currentTags = agent.tags || [];
    const sortedOriginal = [...originalTags].sort().join(',');
    const sortedCurrent = [...currentTags].sort().join(',');
    
    if (sortedOriginal !== sortedCurrent) {
      changes.push({ label: '类别修改', field: 'tags', oldValue: originalTags, newValue: currentTags });
    }

    return changes;
  };

  const handleApprove = (agent: Agent) => {
    const isRevision = (agent as any).status === 'pending_revision';
    const revisionId = (agent as any).revision_id;
    
    setModalConfig({
      isOpen: true,
      title: isRevision ? '确认通过修改' : '确认发布智能体',
      message: isRevision ? '确认通过该智能体的修改申请？修改将立即生效。' : '确认通过该智能体的发布申请？通过后将显示在广场。',
      type: 'success',
      onConfirm: async () => {
        try {
          const success = await updateAgentStatus(agent.id, 'public', isRevision, revisionId);
          if (!success) {
             throw new Error('Operation failed');
          }
        } catch (err) {
          console.error('Approve error:', err);
          alert('操作失败。该智能体可能已被用户删除。');
          fetchPendingAgents();
        }
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
        try {
          const success = await updateAgentStatus(agent.id, 'private', isRevision, revisionId);
          if (!success) {
             throw new Error('Operation failed');
          }
        } catch (err) {
          console.error('Reject error:', err);
          alert('操作失败。该智能体可能已被用户删除。');
          fetchPendingAgents();
        }
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
        <Loading size="lg" />
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
                   const changes = isRevision ? getChangeSummary(agent) : [];
                   
                   return (
                  <li key={isRevision ? (agent as any).revision_id : agent.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="relative flex-shrink-0">
                          <img
                            src={agent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=random`}
                            alt={agent.name}
                            className="w-16 h-16 rounded-full object-cover border border-gray-200"
                          />
                          {isRevision && changes.some(c => c.field === 'avatar_url') && (
                            <div className="absolute -bottom-1 -right-1 bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded-full border border-yellow-200 font-bold shadow-sm">
                              改
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Header Line: Name + Status + Change Labels */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-bold text-gray-900">{agent.name}</h4>
                            
                            {isRevision ? (
                              <>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  修改审核
                                </span>
                                {changes.map((change, idx) => (
                                  <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                                    {change.label}
                                  </span>
                                ))}
                              </>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                新发布
                              </span>
                            )}
                          </div>

                          {/* Categories */}
                          <div className="flex flex-wrap gap-1">
                             {(agent.tags || []).map((tag, i) => (
                               <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                 {tag}
                               </span>
                             ))}
                          </div>
                          
                          {/* Description */}
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {agent.description || '无描述'}
                          </p>

                          {/* Meta Info */}
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">
                              ID: {agent.id.slice(0, 8)}...
                            </span>
                            <span>
                              创建者: {(agent as any).creator?.name || '未知'}
                            </span>
                            <span>
                              提交时间: {new Date(agent.created_at).toLocaleString()}
                            </span>
                          </div>

                          {/* Comparison Section for Revisions */}
                          {isRevision && changes.length > 0 && (
                            <div className="mt-4 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 flex items-center gap-2">
                                <RefreshCw className="w-3 h-3" />
                                修改详情对比
                              </div>
                              <div className="divide-y divide-gray-100">
                                {changes.map((change, idx) => (
                                  <div key={idx} className="p-3 text-sm">
                                    <div className="text-xs text-gray-500 mb-2 font-medium flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                      {change.label}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
                                      {/* Before */}
                                      <div className="bg-red-50 p-3 rounded-md text-red-900 border border-red-100 min-h-[60px]">
                                        <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1 font-bold">Before</div>
                                        {change.field === 'avatar_url' ? (
                                           <img src={change.oldValue} className="w-12 h-12 rounded-lg object-cover bg-white" />
                                        ) : change.field === 'tags' ? (
                                           <div className="flex flex-wrap gap-1">
                                             {change.oldValue.map((t: string) => <span key={t} className="px-1.5 py-0.5 bg-white rounded text-xs border border-red-200">{t}</span>)}
                                           </div>
                                        ) : (
                                           <div className="whitespace-pre-wrap break-words text-sm">{change.oldValue || '(空)'}</div>
                                        )}
                                      </div>
                                      
                                      {/* Arrow */}
                                      <div className="hidden md:flex justify-center items-center h-full pt-6 text-gray-300">
                                        <ArrowRight className="w-5 h-5" />
                                      </div>

                                      {/* After */}
                                      <div className="bg-green-50 p-3 rounded-md text-green-900 border border-green-100 min-h-[60px]">
                                        <div className="text-[10px] text-green-500 uppercase tracking-wider mb-1 font-bold">After</div>
                                        {change.field === 'avatar_url' ? (
                                           <img src={change.newValue} className="w-12 h-12 rounded-lg object-cover bg-white" />
                                        ) : change.field === 'tags' ? (
                                           <div className="flex flex-wrap gap-1">
                                             {change.newValue.map((t: string) => <span key={t} className="px-1.5 py-0.5 bg-white rounded text-xs border border-green-200">{t}</span>)}
                                           </div>
                                        ) : (
                                           <div className="whitespace-pre-wrap break-words text-sm">{change.newValue || '(空)'}</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* System Prompt for New Agents (or if not changed in revision) */}
                          {(!isRevision || !changes.some(c => c.field === 'system_prompt')) && (
                             <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                               <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200/60">
                                 <span className="text-xs text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1.5">
                                   <FileText className="w-3.5 h-3.5" />
                                   System Prompt (完整提示词)
                                 </span>
                                 <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                                   {agent.system_prompt?.length || 0} chars
                                 </span>
                               </div>
                               <div className="max-h-[500px] overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-mono bg-white p-4 rounded-lg border border-slate-100 selection:bg-blue-100 selection:text-blue-900">
                                 {agent.system_prompt}
                               </div>
                             </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => handleApprove(agent)}
                          className="flex items-center justify-center space-x-1 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors w-24 border border-green-200 shadow-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>通过</span>
                        </button>
                        <button
                          onClick={() => handleReject(agent)}
                          className="flex items-center justify-center space-x-1 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors w-24 border border-red-200 shadow-sm"
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
                      <div className="flex items-center space-x-4 flex-1">
                        <img
                          src={agent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=random`}
                          alt={agent.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-medium text-gray-900 truncate">{agent.name}</h4>
                            {agent.tags && agent.tags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
                                {tag}
                              </span>
                            ))}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                             <span className="font-mono">ID: {agent.id.slice(0, 8)}...</span>
                             <span>•</span>
                             <span className="truncate max-w-[150px]">
                               作者: <span className="text-gray-700">{agent.creator?.name || '未知'}</span>
                             </span>
                             
                             <div className="flex items-center gap-2 ml-2">
                               <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100">
                                 已上架
                               </span>
                               {agent.has_pending_revision && (
                                 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-100">
                                   <RefreshCw className="w-3 h-3 mr-1" />
                                   新版本审核中
                                 </span>
                               )}
                             </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
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