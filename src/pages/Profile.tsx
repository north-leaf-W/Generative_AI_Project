import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import { Lock, User, Mail, CheckCircle, AlertCircle, Edit2, X, ChevronDown, ChevronRight, Bell, RefreshCcw, CheckCheck } from 'lucide-react';

const Profile: React.FC = () => {
  const { user, checkAuth, logout, changePassword, updateProfile, isLoading, error, clearError } = useAuthStore();
  const { notifications, fetchNotifications, markAsRead, markAllAsRead, isLoading: notifLoading } = useNotificationsStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  useEffect(() => {
    checkAuth();
    clearError();
    fetchNotifications();
  }, [checkAuth, clearError, fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };


  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess('');
    try {
      await changePassword(oldPassword, newPassword);
      setPasswordSuccess('密码已更新');
      setOldPassword('');
      setNewPassword('');
    } catch {}
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName === user?.name) {
      setIsEditingName(false);
      return;
    }
    
    try {
      await updateProfile(newName);
      setIsEditingName(false);
      setNameSuccess('用户名已更新');
      // 3秒后自动清除成功提示
      setTimeout(() => setNameSuccess(''), 3000);
    } catch {}
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-yellow-700 text-sm">请先登录后查看个人中心。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">账户信息</h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-gray-700 h-9">
            <User className="w-4 h-4 flex-shrink-0" />
            {isEditingName ? (
              <form onSubmit={handleUpdateName} className="flex items-center space-x-2 flex-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  placeholder="输入新用户名"
                />
                <button
                  type="submit"
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                  disabled={isLoading}
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-center space-x-2 group">
                <span>{user.name}</span>
                <button
                  onClick={() => {
                    setNewName(user.name);
                    setIsEditingName(true);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                  title="修改用户名"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {nameSuccess && (
                  <span className="text-sm text-green-600 flex items-center animate-fade-in-out">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    {nameSuccess}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2 text-gray-700 h-9">
            <Mail className="w-4 h-4 flex-shrink-0" />
            <span>{user.email}</span>
            {user.role === 'admin' && (
              <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full ml-2">
                管理员
              </span>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-6 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          退出登录
        </button>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setIsChangePasswordOpen(!isChangePasswordOpen)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <h2 className="text-xl font-semibold text-gray-900">修改密码</h2>
          {isChangePasswordOpen ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </button>
        
        {isChangePasswordOpen && (
          <div className="p-6 pt-0 border-t border-gray-100">
            <form onSubmit={onChangePassword} className="space-y-4 mt-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新密码（至少6位）</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-700">{passwordSuccess}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? '提交中...' : '更新密码'}
              </button>
            </form>
          </div>
        )}
      </section>

      {/* 消息中心 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Bell className="w-5 h-5 mr-2" />
            消息中心
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchNotifications()}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="刷新消息"
            >
              <RefreshCcw className={`w-4 h-4 ${notifLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => markAllAsRead()}
              className="flex items-center space-x-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="全部已读"
            >
              <CheckCheck className="w-4 h-4" />
              <span className="hidden sm:inline">全部已读</span>
            </button>
          </div>
        </div>
        
        {notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-4 rounded-lg border transition-colors ${
                  notification.is_read 
                    ? 'bg-gray-50 border-gray-200 text-gray-600' 
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className={`font-medium mb-1 ${notification.is_read ? 'text-gray-900' : 'text-blue-900'}`}>
                      {notification.title}
                    </h3>
                    <p className={`text-sm mb-2 ${notification.is_read ? 'text-gray-500' : 'text-blue-700'}`}>
                      {notification.content}
                    </p>
                    <span className="text-xs text-gray-400">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </div>
                  {!notification.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="ml-4 p-1 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                      title="标记为已读"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
           <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-lg min-h-[200px]">
             {notifLoading ? (
               <>
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mb-3"></div>
                 <p>加载中...</p>
               </>
             ) : (
               <>
                 <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                 <p>暂无消息</p>
               </>
             )}
           </div>
        )}
      </section>
    </div>
  );
};

export default Profile;
