import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Send, Menu, Plus, Trash2, User, Bot, Loader2, ArrowLeft, ChevronsLeft, X, AlertCircle, Star, Globe } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useChatStore } from '../stores/chat';
import { useAgentsStore } from '../stores/agents';
import { Agent, Session, Message } from '../../shared/types';
import { AnimatePresence, motion } from 'framer-motion';
import PixelAgents from '../components/PixelAgents';
import ConfirmationModal from '../components/ConfirmationModal';

const Chat: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = (location.state as { mode?: 'public' | 'dev' })?.mode || 'public';
  const { user } = useAuthStore();
  const { agents, myAgents, fetchAgents, fetchAgent, toggleFavorite } = useAgentsStore();
  const { 
    sessions, 
    currentSession, 
    messages, 
    isLoading, 
    isStreaming,
    fetchSessions, 
    createSession, 
    fetchMessages, 
    sendMessage, 
    deleteSession, 
    setCurrentSession,
    clearChat,
    reset
  } = useChatStore();

  const [inputMessage, setInputMessage] = useState('');
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentLoading, setAgentLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [pendingNew, setPendingNew] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [localAgent, setLocalAgent] = useState<Agent | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentAgent = localAgent || agents.find(agent => agent.id === agentId) || myAgents.find(agent => agent.id === agentId);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化聊天数据
  useEffect(() => {
    if (!agentId || !user) {
      navigate('/login');
      return;
    }

    const initChat = async () => {
      clearChat();
      setPendingNew(false);
      setSessionsLoading(true);
      // 获取该智能体的会话列表
      await fetchSessions(agentId, mode);
      setSessionsLoading(false);
    };

    initChat();

    // 组件卸载或 agentId 变化时清理状态
    return () => {
      reset();
    };
  }, [agentId, user, navigate, fetchSessions, clearChat, reset, mode]);

  // 当刷新直接进入聊天页且未加载智能体列表时，尝试加载智能体详情
  useEffect(() => {
    if (agentId && !currentAgent && !agentLoading) {
      setAgentLoading(true);
      fetchAgent(agentId)
        .then(agent => {
          if (agent) setLocalAgent(agent);
        })
        .finally(() => setAgentLoading(false));
    }
  }, [agentId, currentAgent, fetchAgent, agentLoading]);

  // 监听当前会话变化加载消息（不自动选择最新会话）
  useEffect(() => {
    if (currentSession && !pendingNew) {
      setMessagesLoading(true);
      Promise.resolve(fetchMessages(currentSession.id)).finally(() => setMessagesLoading(false));
    }
  }, [currentSession?.id, fetchMessages]);

  const handleCreateSession = async () => {
    if (!agentId) return;
    
    const newSession = await createSession(agentId, `新的对话`, mode);
    if (newSession) {
      setCurrentSession(newSession);
      fetchMessages(newSession.id);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !agentId || isStreaming) return;

    let targetSessionId = currentSession?.id;

    if (!targetSessionId) {
      // 只要没有选中当前会话，发送消息时就自动创建新会话
      const newSession = await createSession(agentId, `新的对话`, mode);
      if (!newSession) return;
      setCurrentSession(newSession);
      // 新建会话后不需要立即 fetchMessages，因为 sendMessage 会更新本地消息状态
      // setPendingNew(false); // 保持 pendingNew 为 true，防止 useEffect 触发 fetchMessages 覆盖本地状态
      targetSessionId = newSession.id;
    }

    if (!targetSessionId) return;

    const message = inputMessage.trim();
    setInputMessage('');

    try {
      await sendMessage(targetSessionId, message, agentId, () => {}, isWebSearchEnabled);
    } catch (error) {
      console.error('Failed to send message:', error);
      // 如果出错，把消息放回输入框，方便用户重试
      setInputMessage(message);
      // 这里可以添加一个简单的 alert 或者 toast 提示
      alert('发送消息失败，请检查网络或后端服务是否正常。');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeleteConfirmation(sessionId);
  };

  const confirmDelete = async () => {
    if (deleteConfirmation) {
      await deleteSession(deleteConfirmation);
      setDeleteConfirmation(null);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!currentAgent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">正在加载智能体信息</h2>
          <p className="text-gray-600 mb-4">若长时间无响应，请点击重试</p>
          <button
            onClick={() => {
              if (agentId) {
                setAgentLoading(true);
                fetchAgent(agentId)
                  .then(agent => {
                    if (agent) setLocalAgent(agent);
                  })
                  .finally(() => setAgentLoading(false));
                fetchAgents();
              }
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-transparent flex overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80 md:w-80 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0'} transition-all duration-300 glass border-r border-white/20 flex flex-col overflow-hidden fixed md:relative h-full z-20 md:z-auto`}>
        <div className="p-4 border-b border-gray-200/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              对话历史
              {mode === 'dev' && <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">开发环境</span>}
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
          </div>
          <button
              onClick={() => { setPendingNew(true); setCurrentSession(null); clearChat(); }}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 text-sm md:text-base"
            >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">新建对话</span>
            <span className="sm:hidden">新建</span>
            </button>
          </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-6 md:py-8">
              <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin text-blue-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-6 md:py-8">
              <p className="text-gray-500 text-sm">暂无对话历史</p>
              <p className="text-gray-400 text-xs mt-1 hidden sm:block">点击上方按钮创建新对话</p>
            </div>
          ) : (
            <div className="space-y-1 md:space-y-2">
              <AnimatePresence mode="popLayout">
                {sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    className={`p-2 md:p-3 rounded-lg cursor-pointer transition-colors group ${
                      currentSession?.id === session.id
                        ? 'bg-blue-50/80 border border-blue-200/50 shadow-sm'
                        : 'hover:bg-gray-50/50'
                    }`}
                    onClick={() => {
                      setPendingNew(false);
                      setCurrentSession(session);
                      fetchMessages(session.id);
                      // 移动端点击后自动关闭侧边栏
                      if (window.innerWidth < 768) {
                        setSidebarOpen(false);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {session.title || '未命名对话'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(session.created_at).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirmation}
        onClose={() => setDeleteConfirmation(null)}
        onConfirm={confirmDelete}
        title="删除会话"
        message="确定要删除这个会话吗？删除后该会话的所有消息记录将无法恢复。"
        type="danger"
        confirmText="确认删除"
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="glass border-b border-white/20 px-4 py-3 md:px-6 md:py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 md:space-x-4">
              <button
                onClick={() => {
                  if (location.state?.from) {
                    navigate(location.state.from);
                  } else if (mode === 'dev') {
                    navigate('/agents/my');
                  } else {
                    navigate('/');
                  }
                }}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center space-x-2 md:space-x-3">
                <img
                  src={currentAgent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAgent.name)}&background=random`}
                  alt={currentAgent.name}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover"
                />
                <div>
                  <h1 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
                    {currentAgent.name}
                    {user?.id === currentAgent.creator_id && (
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${
                        currentAgent.status === 'private' 
                          ? 'bg-gray-100 text-gray-700 border-gray-200' 
                          : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      }`}>
                        {currentAgent.status === 'private' ? '私有' : '我的'}
                        {(currentAgent as any).draft_revision && ' (调试模式)'}
                      </span>
                    )}
                    <button
                      onClick={() => toggleFavorite(currentAgent)}
                      className="ml-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                      title={currentAgent.is_favorited ? "取消收藏" : "收藏智能体"}
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          currentAgent.is_favorited ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
                        }`}
                      />
                    </button>
                  </h1>
                  <div className="text-xs md:text-sm text-green-600 flex items-center space-x-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                    <span>在线</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-xs md:text-sm text-gray-500">
              {currentSession ? formatTime(currentSession.updated_at) : ''}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 md:px-6 md:py-4">
          {messagesLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-blue-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Bot className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mb-3 md:mb-4" />
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-1 md:mb-2">开始对话</h3>
              <p className="text-sm md:text-base text-gray-500 max-w-sm md:max-w-md">
                向{currentAgent.name}发送您的第一条消息，开始智能对话体验。
              </p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 md:space-x-3 max-w-[80%] md:max-w-2xl ${
                    message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    {/* Avatar */}
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0">
                      {message.role === 'user' ? (
                        <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3 md:w-4 md:h-4 text-white" />
                        </div>
                      ) : (
                        <img
                          src={currentAgent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAgent.name)}&background=random`}
                          alt={currentAgent.name}
                          className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover"
                        />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className={`flex-1 ${
                      message.role === 'user' ? 'text-right' : 'text-left'
                    }`}>
                      <div className={`inline-block px-4 py-3 rounded-2xl shadow-sm ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-none'
                          : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'
                      }`}>
                        <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5 px-1">
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {isStreaming && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 md:space-x-3 max-w-[80%] md:max-w-2xl">
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0">
                      <img
                        src={currentAgent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAgent.name)}&background=random`}
                        alt={currentAgent.name}
                        className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="inline-block px-3 py-2 md:px-4 md:py-2 rounded-2xl bg-gray-100">
                        <div className="flex space-x-1">
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-4 py-4 md:px-6 md:py-6 w-full max-w-4xl mx-auto">
          <div className="relative">
            {/* Pixel Agents */}
            <div className="absolute -top-14 left-4 z-10 pointer-events-none">
              <PixelAgents />
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl border border-white/50 p-2 flex items-end space-x-2 transition-all hover:shadow-2xl relative z-20">
              <button
                onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                className={`p-3 rounded-full transition-all duration-200 flex-shrink-0 mb-1 ml-1 ${
                  isWebSearchEnabled 
                    ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title={isWebSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
              >
                <Globe className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="和 Agent 一起开始你的工作..."
                  disabled={isStreaming}
                  className="w-full px-4 py-3 bg-transparent border-none focus:ring-0 resize-none text-gray-800 placeholder-gray-400 text-base min-h-[56px] max-h-[200px]"
                  rows={1}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isStreaming}
                className="p-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0 mb-1 mr-1"
              >
                {isStreaming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
