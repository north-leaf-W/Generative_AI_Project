import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, MessageSquare, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetPassword, isLoading, error, clearError } = useAuthStore();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    // 从 URL hash 中提取 access_token
    const hash = location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1)); // 去掉 #
      const token = params.get('access_token');
      if (token) {
        setAccessToken(token);
      } else {
        setLocalError('无效的重置链接：缺少令牌');
      }
    } else {
      // 有时候 Supabase 会将参数作为 query string 传递（取决于配置）
      const params = new URLSearchParams(location.search);
      const token = params.get('access_token');
      if (token) {
        setAccessToken(token);
      } else {
        setLocalError('无效的重置链接');
      }
    }
    clearError();
  }, [location, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    
    if (password !== confirmPassword) {
      setLocalError('两次输入的密码不一致');
      return;
    }
    
    if (password.length < 6) {
      setLocalError('密码长度至少为6位');
      return;
    }

    if (!accessToken) {
      setLocalError('无效的重置链接');
      return;
    }

    try {
      await resetPassword(password, accessToken);
      setIsSuccess(true);
      // 3秒后跳转登录页
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">设置新密码</h1>
          <p className="text-gray-600">请输入您的新密码</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {isSuccess ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">密码重置成功</h3>
              <p className="text-gray-600 mb-6">
                您的密码已更新，正在跳转到登录页...
              </p>
              <Link
                to="/login"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                立即登录
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  新密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="至少6位字符"
                    minLength={6}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  确认新密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="再次输入新密码"
                    minLength={6}
                  />
                </div>
              </div>

              {(error || localError) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{localError || error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !accessToken}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? '提交中...' : '重置密码'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
