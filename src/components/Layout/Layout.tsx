import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../stores/auth';
import { useNotificationsStore } from '../../stores/notifications';

const Layout: React.FC = () => {
  const { user } = useAuthStore();
  const { startPolling, stopPolling } = useNotificationsStore();

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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen transition-all duration-300">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;