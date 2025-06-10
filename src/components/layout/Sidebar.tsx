import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Crown, 
  Activity,
  Shield,
  LogOut,
  X,
  CreditCard
} from 'lucide-react';
import { useSuperAdmin } from '../../contexts/SuperAdminContext';

const navigationItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
  { icon: Users, label: 'Usuarios', href: '/admin/users' },
  { icon: Crown, label: 'Planes', href: '/admin/plans' },
  { icon: CreditCard, label: 'Stripe', href: '/admin/stripe' },
  { icon: Activity, label: 'Logs del Sistema', href: '/admin/logs' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const location = useLocation();
  const { state, logout } = useSuperAdmin();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && onClose && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 w-64 bg-slate-800 border-r border-slate-700 z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
      `}>
        <div className="h-full flex flex-col">
          {/* Mobile Close Button */}
          {onClose && (
            <div className="flex justify-end p-4 lg:hidden">
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          )}

          {/* Logo */}
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Super Admin</h1>
                <p className="text-xs text-slate-400">Tutaviendo Panel</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group ${
                    isActive
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium flex-1">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="border-t border-slate-700 p-4">
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                  SA
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium truncate">{state.user?.name || 'Super Admin'}</p>
                  <p className="text-slate-400 text-sm truncate">{state.user?.email}</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}