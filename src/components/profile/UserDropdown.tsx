import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  LogOut, 
  ChevronDown, 
  Store,
  Moon,
  Sun,
  Edit,
  ChevronRight,
  CreditCard
} from 'lucide-react';
import { useStore } from '../../contexts/StoreContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import StoreSelector from './StoreSelector';

interface UserDropdownProps {
  onEditProfile?: () => void;
}

export default function UserDropdown({ onEditProfile }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { state, logout } = useStore();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { success, error } = useToast();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowStoreSelector(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      setIsOpen(false);
      
      console.log('🔄 Starting logout process...');
      
      await logout();
      
      success('Sesión cerrada', 'Has cerrado sesión correctamente');
      
      // Force redirect to login
      window.location.href = '/login';
      
    } catch (err: any) {
      console.error('❌ Logout error:', err);
      error('Error al cerrar sesión', err.message || 'No se pudo cerrar la sesión. Intenta de nuevo.');
      
      // Force logout anyway and redirect
      window.location.href = '/login';
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const user = state.user;
  const currentStore = state.currentStore;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors admin-dark:hover:bg-gray-700"
        disabled={isLoggingOut}
      >
        {/* Avatar */}
        <div className="relative">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
              {getInitials(user?.name || 'U')}
            </div>
          )}
          
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        </div>

        {/* User Info - Hidden on mobile */}
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-900 truncate max-w-32 admin-dark:text-white">
            {user?.name || 'Usuario'}
          </p>
          <p className="text-xs text-gray-500 truncate max-w-32 admin-dark:text-gray-300">
            {user?.email || 'email@ejemplo.com'}
          </p>
        </div>

        <ChevronDown className={`w-4 h-4 text-gray-500 admin-dark:text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''} ${isLoggingOut ? 'opacity-50' : ''}`} />
      </button>

      {/* Dropdown Menu - FIXED DARK MODE */}
      {isOpen && !isLoggingOut && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white admin-dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 admin-dark:border-gray-700 py-2 z-50">
          {/* User Info Header - FIXED DARK MODE */}
          <div className="px-4 py-3 border-b border-gray-100 admin-dark:border-gray-700">
            <div className="flex items-center gap-3">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">
                  {getInitials(user?.name || 'U')}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 admin-dark:text-white truncate">
                  {user?.name || 'Usuario'}
                </h3>
                <p className="text-sm text-gray-600 admin-dark:text-gray-300 truncate">
                  {user?.email || 'email@ejemplo.com'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    user?.plan === 'profesional' 
                      ? 'bg-purple-100 text-purple-800 admin-dark:bg-purple-900 admin-dark:text-purple-200'
                      : user?.plan === 'emprendedor'
                      ? 'bg-blue-100 text-blue-800 admin-dark:bg-blue-900 admin-dark:text-blue-200' 
                      : 'bg-gray-100 text-gray-600 admin-dark:bg-gray-700 admin-dark:text-gray-300'
                  }`}>
                    {user?.plan === 'profesional' ? 'Profesional' : user?.plan === 'emprendedor' ? 'Emprendedor' : 'Gratis'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Store Selector Section - FIXED DARK MODE */}
          {showStoreSelector ? (
            <div className="px-4 py-3 border-b border-gray-100 admin-dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setShowStoreSelector(false)}
                  className="text-sm text-gray-600 admin-dark:text-gray-300 hover:text-gray-900 admin-dark:hover:text-white transition-colors"
                >
                  ← Volver
                </button>
              </div>
              <StoreSelector onClose={() => setShowStoreSelector(false)} />
            </div>
          ) : (
            <>
              {/* Current Store Info - FIXED DARK MODE */}
              {currentStore && (
                <div className="px-4 py-3 border-b border-gray-100 admin-dark:border-gray-700">
                  <button
                    onClick={() => setShowStoreSelector(true)}
                    className="w-full flex items-center gap-3 hover:bg-gray-50 admin-dark:hover:bg-gray-800 rounded-lg p-2 transition-colors"
                  >
                    <div className="w-8 h-8 bg-indigo-100 admin-dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                      <Store className="w-4 h-4 text-indigo-600 admin-dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-gray-900 admin-dark:text-white truncate">
                        {currentStore.name}
                      </p>
                      <p className="text-xs text-gray-500 admin-dark:text-gray-400">
                        {currentStore.products?.length || 0} productos
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                </div>
              )}

              {/* Menu Items - FIXED DARK MODE HOVER STATES */}
              <div className="py-2">
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 admin-dark:text-gray-300 hover:bg-gray-50 admin-dark:hover:bg-gray-800 hover:text-gray-900 admin-dark:hover:text-white transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Mi Perfil
                </Link>

                {/* Suscripciones - Siempre visible */}
                <Link
                  to="/subscription"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 admin-dark:text-gray-300 hover:bg-gray-50 admin-dark:hover:bg-gray-800 hover:text-gray-900 admin-dark:hover:text-white transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                  Suscripciones
                </Link>

                {/* Theme Toggle - FIXED DARK MODE HOVER */}
                <button
                  onClick={toggleDarkMode}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 admin-dark:text-gray-300 hover:bg-gray-50 admin-dark:hover:bg-gray-800 hover:text-gray-900 admin-dark:hover:text-white transition-colors"
                >
                  {isDarkMode ? (
                    <>
                      <Sun className="w-4 h-4" />
                      Modo Claro
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4" />
                      Modo Oscuro
                    </>
                  )}
                </button>

                <div className="border-t border-gray-100 admin-dark:border-gray-700 mt-2 pt-2">
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 admin-dark:text-red-400 hover:bg-red-50 admin-dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoggingOut ? (
                      <>
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        Cerrando sesión...
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}