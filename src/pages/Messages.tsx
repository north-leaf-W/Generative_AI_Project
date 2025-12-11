import React, { useEffect, useState } from 'react';
import { useNotificationsStore } from '../stores/notifications';
import { Bell, RefreshCcw, CheckCheck, Trash2, CheckCircle } from 'lucide-react';
import Loading from '../components/Loading';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuthStore } from '../stores/auth';
import { useNavigate } from 'react-router-dom';

const Messages: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { notifications, fetchNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, isLoading: notifLoading } = useNotificationsStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [user, navigate, fetchNotifications]);

  const handleRefreshNotifications = async () => {
    setIsRefreshing(true);
    try {
      await fetchNotifications();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleDeleteClick = async (id: string) => {
    if (confirmDeleteId === id) {
      await deleteNotification(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => {
        setConfirmDeleteId((current) => (current === id ? null : current));
      }, 3000);
    }
  };

  const handleClearAllClick = () => {
    setIsClearAllModalOpen(true);
  };

  const handleConfirmClearAll = async () => {
    await clearAllNotifications();
    setIsClearAllModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Bell className="w-8 h-8 mr-3 text-blue-600" />
              消息中心
            </h1>
            <p className="mt-2 text-gray-600">查看和管理您的所有系统通知</p>
          </div>
          
          <div className="flex items-center space-x-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200">
            <button
              onClick={handleRefreshNotifications}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="刷新消息"
            >
              <RefreshCcw className={`w-5 h-5 ${notifLoading || isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <button
              onClick={() => markAllAsRead()}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              <span className="hidden sm:inline">全部已读</span>
            </button>
            <button
              onClick={handleClearAllClick}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">全部清空</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-6 transition-all hover:bg-gray-50 ${
                    notification.is_read ? 'bg-white' : 'bg-blue-50/30'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!notification.is_read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <h3 className={`text-base font-semibold ${notification.is_read ? 'text-gray-900' : 'text-blue-900'}`}>
                          {notification.title}
                        </h3>
                      </div>
                      <p className={`text-sm leading-relaxed ${notification.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                        {notification.content}
                      </p>
                      <span className="text-xs text-gray-400 mt-2 block">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors group"
                          title="标记为已读"
                        >
                          <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClick(notification.id)}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          confirmDeleteId === notification.id
                            ? 'text-red-600 bg-red-100 hover:bg-red-200 ring-2 ring-red-200 shadow-sm'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={confirmDeleteId === notification.id ? "再次点击确认删除" : "删除消息"}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
              {notifLoading ? (
                <Loading size="lg" text="加载消息中..." />
              ) : (
                <>
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Bell className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">暂无消息</h3>
                  <p className="text-gray-400">您目前没有收到任何通知</p>
                </>
              )}
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={isClearAllModalOpen}
          onClose={() => setIsClearAllModalOpen(false)}
          onConfirm={handleConfirmClearAll}
          title="清空所有消息"
          message="确定要删除所有消息吗？此操作无法撤销。"
          type="danger"
          confirmText="确认清空"
        />
      </div>
    </div>
  );
};

export default Messages;
