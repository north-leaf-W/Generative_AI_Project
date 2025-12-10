import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useNotificationsStore } from '../../stores/notifications';

const Header: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { unreadCount, startPolling, stopPolling } = useNotificationsStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      startPolling();
    } else {
      stopPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [user, startPolling, stopPolling]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="glass sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">AI对话平台</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              智能体广场
            </Link>
            {user && (
              <>
                <Link 
                  to="/agents/my" 
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  我的智能体
                </Link>
                {user.role === 'admin' && (
                  <Link 
                    to="/admin/agents" 
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    管理智能体
                  </Link>
                )}
                <Link 
                  to="/profile" 
                  className="text-gray-600 hover:text-gray-900 transition-colors relative"
                >
                  个人中心
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-xs flex items-center justify-center rounded-full px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              </>
            )}
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">
                    {user.name}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:block">退出</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
                >
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;