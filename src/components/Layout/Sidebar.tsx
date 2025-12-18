import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Globe, Bot, Bell, User, LogOut, ShieldCheck, Layers } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useNotificationsStore } from '../../stores/notifications';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationsStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  interface MenuItem {
    icon: React.ElementType;
    label: string;
    path: string;
    badge?: number;
  }

  const menuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: '首页', path: '/' },
    { icon: Globe, label: '智能体广场', path: '/square' },
    { icon: Layers, label: '综合对话平台', path: '/multi-agent' },
  ];

  if (user) {
    menuItems.push({ icon: Bot, label: '我的智能体', path: '/agents/my' });
    menuItems.push({ icon: Bell, label: '消息中心', path: '/messages', badge: unreadCount });
    menuItems.push({ icon: User, label: '个人中心', path: '/profile' });
    
    if (user.role === 'admin') {
      menuItems.push({ icon: ShieldCheck, label: '管理后台', path: '/admin/agents' });
    }
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-100 shadow-sm z-50 flex flex-col transition-all duration-300">
      {/* Logo Area */}
      <div className="h-20 flex items-center px-8 border-b border-gray-50">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition-opacity" />
            <img src="/robot_face.png" alt="Logo" className="w-10 h-10 rounded-lg relative z-10" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            AI对话平台
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <span className="font-medium">{item.label}</span>
              </div>
              
              {item.badge && item.badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
              
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User / Logout */}
      {user ? (
        <div className="p-4 border-t border-gray-50 bg-gray-50/50">
          <div className="flex items-center space-x-3 mb-4 px-2">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-10 h-10 rounded-full shadow-md object-cover" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md text-white font-bold text-lg">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all duration-200 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>
      ) : (
        <div className="p-4 border-t border-gray-50">
          <Link
            to="/login"
            className="block w-full text-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200"
          >
            登录 / 注册
          </Link>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
