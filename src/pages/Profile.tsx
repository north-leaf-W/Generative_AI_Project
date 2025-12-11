import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { Lock, User, Mail, CheckCircle, AlertCircle, Edit2, X, ChevronDown, ChevronRight, Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/utils';

const Profile: React.FC = () => {
  const { user, checkAuth, logout, changePassword, updateProfile, isLoading, error, clearError } = useAuthStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  
  // 头像上传相关状态
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
    clearError();
  }, [checkAuth, clearError]);

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
      await updateProfile({ name: newName });
      setIsEditingName(false);
      setNameSuccess('用户名已更新');
      // 3秒后自动清除成功提示
      setTimeout(() => setNameSuccess(''), 3000);
    } catch {}
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // 重置状态
    setAvatarError(null);
    setIsUploadingAvatar(true);

    try {
      // 1. 验证文件大小 (1MB)
      if (file.size > 1024 * 1024) {
        throw new Error('头像大小不能超过 1MB');
      }

      // 2. 验证文件类型
      if (!file.type.startsWith('image/')) {
        throw new Error('请上传图片文件');
      }

      // 3. 上传到 Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 4. 获取公开链接
      const { data } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(filePath);

      // 5. 更新用户资料
      await updateProfile({ avatar_url: data.publicUrl });
      
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setAvatarError(err.message || '头像上传失败，请重试');
    } finally {
      setIsUploadingAvatar(false);
      // 清空 input，允许重复上传同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">个人中心</h1>
      
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">账户信息</h2>
        <div className="space-y-4">
          {/* Avatar Section */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-gray-400" />
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 transition-colors"
                title="更换头像"
              >
                <Camera className="w-4 h-4 text-gray-600" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">头像</p>
              <p className="text-xs text-gray-500 mt-1">支持 JPG, PNG格式，最大 1MB</p>
              {avatarError && (
                <p className="text-xs text-red-600 mt-1">{avatarError}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 text-gray-700 h-9">
            <User className="w-5 h-5 flex-shrink-0 text-gray-400" />
            {isEditingName ? (
              <form onSubmit={handleUpdateName} className="flex items-center space-x-2 flex-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  placeholder="输入新用户名"
                />
                <button
                  type="submit"
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  disabled={isLoading}
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center space-x-3 group">
                <span className="text-lg font-medium">{user.name}</span>
                <button
                  onClick={() => {
                    setNewName(user.name);
                    setIsEditingName(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="修改用户名"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {nameSuccess && (
                  <span className="text-sm text-green-600 flex items-center animate-fade-in-out">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {nameSuccess}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3 text-gray-700 h-9">
            <Mail className="w-5 h-5 flex-shrink-0 text-gray-400" />
            <span className="text-gray-600">{user.email}</span>
            {user.role === 'admin' && (
              <span className="px-2.5 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full ml-2">
                管理员
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <button
          onClick={() => setIsChangePasswordOpen(!isChangePasswordOpen)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Lock className="w-5 h-5 text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900">修改密码</h2>
          </div>
          {isChangePasswordOpen ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </button>
        
        {isChangePasswordOpen && (
          <div className="p-6 pt-0 border-t border-gray-100 bg-gray-50/30">
            <form onSubmit={onChangePassword} className="space-y-5 mt-6 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">当前密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">新密码（至少6位）</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow bg-white"
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

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 font-medium shadow-sm hover:shadow-md"
                >
                  {isLoading ? '提交中...' : '更新密码'}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
};

export default Profile;
