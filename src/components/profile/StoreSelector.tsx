import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Plus, Check, Crown, X } from 'lucide-react';
import { useStore } from '../../contexts/StoreContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';

interface StoreSelectorProps {
  onClose?: () => void;
}

export default function StoreSelector({ onClose }: StoreSelectorProps) {
  const { state, dispatch } = useStore();
  const { success, error } = useToast();
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // ✅ FIXED: Same logic as sidebar - correct store creation limits
  const canCreateStore = () => {
    const userPlan = state.user?.plan || 'gratuito';
    const currentStoreCount = state.stores.length;
    
    switch (userPlan) {
      case 'gratuito':
        return currentStoreCount < 1;
      case 'emprendedor':
        return currentStoreCount < 2;
      case 'profesional':
        return currentStoreCount < 5;
      default:
        return false;
    }
  };

  const getMaxStores = () => {
    const userPlan = state.user?.plan || 'gratuito';
    switch (userPlan) {
      case 'gratuito': return 1;
      case 'emprendedor': return 2;
      case 'profesional': return 5;
      default: return 1;
    }
  };

  const handleStoreChange = async (store: any) => {
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        throw new Error('No user found');
      }
      
      // Update user's current store preference in database
      // This is optional but helps maintain the selected store across sessions
      const { error: updateError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: currentUser.id,
          current_store_id: store.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (updateError) {
        console.warn('Could not save store preference:', updateError);
        // Continue anyway as this is not critical
      }
      
      // Update local state
      dispatch({ type: 'SET_CURRENT_STORE', payload: store });
      
      if (onClose) onClose();
      
      success('Tienda cambiada', `Ahora estás gestionando "${store.name}"`);
    } catch (err: any) {
      console.error('Error changing store:', err);
      error('Error al cambiar tienda', err.message || 'No se pudo cambiar la tienda. Intenta de nuevo.');
    }
  };

  const handleAddStore = () => {
    if (canCreateStore()) {
      // User can create more stores, redirect to add store page
      window.location.href = '/admin/add-store';
    } else {
      // User has reached their limit, show premium modal
      setShowPremiumModal(true);
    }
  };

  const premiumFeatures = [
    'Hasta 5 tiendas diferentes',
    'Hasta 50 productos por tienda',
    'Personalización avanzada',
    'Analíticas completas',
    'Soporte prioritario'
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 admin-dark:text-white">Mis Tiendas</h3>
          <span className="text-xs text-gray-500 admin-dark:text-gray-400">
            {state.stores.length} / {getMaxStores()}
          </span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {state.stores.map(store => (
            <button
              key={store.id}
              onClick={() => handleStoreChange(store)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                state.currentStore?.id === store.id
                  ? 'border-indigo-200 admin-dark:border-indigo-700 bg-indigo-50 admin-dark:bg-indigo-900/30 text-indigo-700 admin-dark:text-indigo-300'
                  : 'border-gray-200 admin-dark:border-gray-600 hover:border-gray-300 admin-dark:hover:border-gray-500 hover:bg-gray-50 admin-dark:hover:bg-gray-700'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                state.currentStore?.id === store.id
                  ? 'bg-indigo-100 admin-dark:bg-indigo-800'
                  : 'bg-gray-100 admin-dark:bg-gray-600'
              }`}>
                <Store className="w-4 h-4" />
              </div>
              
              <div className="flex-1 text-left">
                <p className="font-medium text-sm truncate">{store.name}</p>
                <p className="text-xs text-gray-500 admin-dark:text-gray-400">
                  {store.products?.length || 0} productos
                </p>
              </div>

              {state.currentStore?.id === store.id && (
                <Check className="w-4 h-4 text-indigo-600 admin-dark:text-indigo-400" />
              )}
            </button>
          ))}

          {/* Add Store Button - ✅ FIXED: Dynamic text based on user's ability to create stores */}
          <button
            onClick={handleAddStore}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 border-dashed transition-all ${
              canCreateStore()
                ? 'border-indigo-300 admin-dark:border-indigo-600 text-indigo-600 admin-dark:text-indigo-400 hover:border-indigo-400 admin-dark:hover:border-indigo-500 hover:bg-indigo-50 admin-dark:hover:bg-indigo-900/20'
                : 'border-gray-300 admin-dark:border-gray-600 text-gray-500 admin-dark:text-gray-400 hover:border-gray-400 admin-dark:hover:border-gray-500'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 admin-dark:bg-gray-600 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">
                {state.stores.length === 0 ? 'Crear Primera Tienda' : 'Añadir Nueva Tienda'}
              </p>
              <p className="text-xs">
                {canCreateStore()
                  ? 'Crear ahora'
                  : 'Requiere actualizar plan'
                }
              </p>
            </div>

            {!canCreateStore() && (
              <Crown className="w-4 h-4 text-yellow-500" />
            )}
          </button>
        </div>
      </div>

      {/* Premium Modal - ✅ UPDATED: Better messaging for different plans */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white admin-dark:bg-gray-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 admin-dark:text-white">¡Desbloquea Más Tiendas!</h2>
              <button
                onClick={() => setShowPremiumModal(false)}
                className="p-2 hover:bg-gray-100 admin-dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-600 admin-dark:text-gray-300">
                {state.user?.plan === 'emprendedor' 
                  ? 'Actualiza al plan Profesional para crear hasta 5 tiendas'
                  : 'Actualiza tu plan para crear múltiples tiendas y acceder a funciones avanzadas'
                }
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {premiumFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-100 admin-dark:bg-green-900/50 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-600 admin-dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 admin-dark:text-gray-300">{feature}</span>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 admin-dark:from-indigo-900/20 admin-dark:to-purple-900/20 rounded-lg p-4 mb-6">
              <div className="text-center">
                {state.user?.plan === 'emprendedor' ? (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl font-bold text-gray-900 admin-dark:text-white">$9.99</span>
                      <span className="text-gray-600 admin-dark:text-gray-300">/mes</span>
                    </div>
                    <p className="text-xs text-gray-500 admin-dark:text-gray-400">Plan Profesional</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl font-bold text-gray-900 admin-dark:text-white">$4.99</span>
                      <span className="text-gray-600 admin-dark:text-gray-300">/mes</span>
                    </div>
                    <p className="text-xs text-gray-500 admin-dark:text-gray-400">Plan Emprendedor</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPremiumModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 admin-dark:border-gray-600 text-gray-700 admin-dark:text-gray-300 rounded-lg hover:bg-gray-50 admin-dark:hover:bg-gray-700 transition-colors"
              >
                Más Tarde
              </button>
              <Link
                to="/subscription"
                onClick={() => setShowPremiumModal(false)}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors text-center"
              >
                Ver Planes
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
