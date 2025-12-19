import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import AgentSquare from "@/pages/AgentSquare";
import Messages from "@/pages/Messages";
import Chat from "@/pages/Chat";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Profile from "./pages/Profile";
import CreateAgent from "./pages/CreateAgent";
import EditAgent from "./pages/EditAgent";
import MyAgents from "./pages/MyAgents";
import AdminAgents from "./pages/AdminAgents";
import MultiAgentChat from "./pages/MultiAgentChat";
import MemoryCenter from "./pages/MemoryCenter";
import Layout from "@/components/Layout/Layout";
import VerifyEmail from "./pages/VerifyEmail";
import { useAuthStore } from "./stores/auth";

export default function App() {
  const { checkAuth, token } = useAuthStore();

  useEffect(() => {
    // 仅在有 token 但没有 user 信息，或者页面初始化时进行一次检查
    // 避免频繁调用
    checkAuth();
  }, []); // 仅在组件挂载时执行一次

  return (
    <Router>
      <Routes>
        <Route element={<Layout />}> 
          <Route path="/" element={<Home />} />
          <Route path="/square" element={<AgentSquare />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/chat/:agentId" element={<Chat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/agents/create" element={<CreateAgent />} />
          <Route path="/agents/edit/:id" element={<EditAgent />} />
          <Route path="/agents/my" element={<MyAgents />} />
          <Route path="/multi-agent" element={<MultiAgentChat />} />
          <Route path="/memory-center" element={<MemoryCenter />} />
          <Route path="/admin/agents" element={<AdminAgents />} />
          <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
        </Route>
      </Routes>
    </Router>
  );
}
