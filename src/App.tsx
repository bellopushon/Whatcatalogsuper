import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SuperAdminProvider, useSuperAdmin } from './contexts/SuperAdminContext';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ui/ToastContainer';

import SuperAdminLogin from './components/auth/SuperAdminLogin';
import AdminLayout from './components/layout/AdminLayout';
import Dashboard from './components/dashboard/Dashboard';
import UserManagement from './components/admin/UserManagement';
import PlanManagement from './components/admin/PlanManagement';
import StripeManagement from './components/admin/StripeManagement';
import SystemLogs from './components/admin/SystemLogs';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-400">Cargando Super Panel...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useSuperAdmin();

  if (!state.isInitialized) {
    return <LoadingScreen />;
  }

  if (state.authError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Error de Autenticación</h2>
          <p className="text-slate-400 mb-4">{state.authError}</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg"
          >
            Ir al Login
          </button>
        </div>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { state } = useSuperAdmin();

  if (!state.isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* LOGIN ROUTE */}
      <Route path="/login" element={
        state.isAuthenticated ? (
          <Navigate to="/admin\" replace />
        ) : (
          <SuperAdminLogin />
        )
      } />

      {/* PROTECTED SUPER ADMIN ROUTES */}
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="plans" element={<PlanManagement />} />
        <Route path="stripe" element={<StripeManagement />} />
        <Route path="logs" element={<SystemLogs />} />
      </Route>

      {/* DEFAULT REDIRECTS */}
      <Route 
        path="/" 
        element={
          <Navigate to={state.isAuthenticated ? "/admin" : "/login"} replace />
        } 
      />

      {/* CATCH ALL ROUTE */}
      <Route 
        path="*" 
        element={
          <Navigate to={state.isAuthenticated ? "/admin" : "/login"} replace />
        } 
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <SuperAdminProvider>
        <ToastProvider>
          <div className="min-h-screen bg-slate-900">
            <AppRoutes />
            <ToastContainer />
          </div>
        </ToastProvider>
      </SuperAdminProvider>
    </Router>
  );
}

export default App;