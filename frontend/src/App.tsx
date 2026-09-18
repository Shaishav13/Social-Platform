/**
 * Social Platform - React Frontend Application
 * 
 * Copyright (c) 2025 Shaishav
 * Licensed under the MIT License
 * 
 * Main App component with routing and authentication
 * Author: Shaishav <sk.shaishav.9@gmail.com>
 * GitHub: https://github.com/Shaishav13
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import CreatePostPage from './pages/CreatePost';
import PostDetail from './pages/PostDetail';
import Notifications from './pages/Notifications';
import FollowRequests from './pages/FollowRequests';
import TestFollowRequests from './pages/TestFollowRequests';
import Search from './pages/Search';
import Explore from './pages/Explore';
import Settings from './pages/Settings';
import AdminRoute from './routes/AdminRoute';
import {
  AdminDashboard,
  AdminUsers,
  AdminFeatures,
  AdminSettings,
  AdminModeration,
} from './pages/admin';
import './styles/wren.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="/register" element={
              <Register />
            } />
            <Route path="/verify-email" element={
              <PublicRoute>
                <VerifyEmail />
              </PublicRoute>
            } />
            <Route path="/forgot-password" element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            } />
            <Route path="/reset-password" element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            } />
            
            {/* Protected routes */}
            <Route path="/feed" element={
              <ProtectedRoute>
                <Feed />
              </ProtectedRoute>
            } />
            <Route path="/profile/:id" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/profile/edit" element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            } />
            <Route path="/edit-profile" element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            } />
            <Route path="/create-post" element={
              <ProtectedRoute>
                <CreatePostPage />
              </ProtectedRoute>
            } />
            <Route path="/post/:postId" element={
              <ProtectedRoute>
                <PostDetail />
              </ProtectedRoute>
            } />
            <Route path="/post/:postId/comment/:commentId" element={
              <ProtectedRoute>
                <PostDetail />
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } />
            <Route path="/follow-requests" element={
              <ProtectedRoute>
                <FollowRequests />
              </ProtectedRoute>
            } />
            <Route path="/test-follow-requests" element={
              <ProtectedRoute>
                <TestFollowRequests />
              </ProtectedRoute>
            } />
            <Route path="/search" element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            } />
            
            {/* Placeholder routes for future implementation */}
            <Route path="/explore" element={
              <ProtectedRoute>
                <Explore />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/blogs" element={
              <ProtectedRoute>
                <div>Blogs page - Coming soon</div>
              </ProtectedRoute>
            } />

            {/* Admin Upper Hierarchy routes */}
            <Route path="/admin" element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } />
            <Route path="/admin/users" element={
              <AdminRoute>
                <AdminUsers />
              </AdminRoute>
            } />
            <Route path="/admin/features" element={
              <AdminRoute>
                <AdminFeatures />
              </AdminRoute>
            } />
            <Route path="/admin/settings" element={
              <AdminRoute>
                <AdminSettings />
              </AdminRoute>
            } />
            <Route path="/admin/moderation" element={
              <AdminRoute>
                <AdminModeration />
              </AdminRoute>
            } />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
