import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
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
import Layout from "@/components/Layout/Layout";
import VerifyEmail from "./pages/VerifyEmail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}> 
          <Route path="/" element={<Home />} />
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
          <Route path="/admin/agents" element={<AdminAgents />} />
          <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
        </Route>
      </Routes>
    </Router>
  );
}
