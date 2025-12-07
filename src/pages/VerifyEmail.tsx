import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MailCheck, ArrowRight, MessageSquare } from 'lucide-react';

const VerifyEmail: React.FC = () => {
  const [params] = useSearchParams();
  const email = params.get('email') || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">请验证您的邮箱</h1>
          <p className="text-gray-600">我们已向您的邮箱发送验证链接</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <MailCheck className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-gray-700 mb-2">请前往邮箱完成验证</p>
          {email && <p className="text-gray-500 mb-6">{email}</p>}
          <div className="space-y-3">
            <Link to="/login" className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200">
              <span>去登录</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-sm text-gray-500">未收到邮件？请检查垃圾邮件或稍后重试</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
