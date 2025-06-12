import React, { useState, useEffect } from 'react';
import { CreditCard, ExternalLink, Settings, DollarSign, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

// Este es un ejemplo de cómo implementar el portal de Stripe en tu proyecto principal

interface SubscriptionData {
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
  };
  subscription: {
    status: string;
    nextBillingDate?: string;
    cancelAtPeriodEnd: boolean;
    hasStripeCustomer: boolean;
    canManageSubscription: boolean;
  };
}

export default function SubscriptionManagement() {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Obtener datos de suscripción del usuario
  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      // Reemplaza con tu lógica de autenticación
      const userId = getCurrentUserId(); // Tu función para obtener el ID del usuario actual
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-subscription-status?userId=${userId}`
      );
      
      const data = await response.json();
      
      if (data.success) {
        setSubscriptionData(data);
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStripePortal = async () => {
    setOpeningPortal(true);
    try {
      const userId = getCurrentUserId();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}` // Tu token de autenticación
          },
          body: JSON.stringify({
            userId: userId,
            returnUrl: window.location.href
          })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        // Abrir portal de Stripe en la misma ventana
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Error al abrir portal de Stripe');
      }
    } catch (error) {
      console.error('Error opening Stripe portal:', error);
      alert('Error al abrir el portal de Stripe. Intenta de nuevo.');
    } finally {
      setOpeningPortal(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'canceled': return 'text-red-600 bg-red-100';
      case 'past_due': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activa';
      case 'canceled': return 'Cancelada';
      case 'past_due': return 'Pago Pendiente';
      case 'free': return 'Plan Gratuito';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="bg-white rounded-lg border p-6">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!subscriptionData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error al cargar suscripción</h3>
          <p className="text-gray-500">No se pudo cargar la información de tu suscripción.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Mi Suscripción</h1>

      {/* Plan Actual */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Plan Actual</h2>
            <p className="text-gray-600">Gestiona tu suscripción y facturación</p>
          </div>
          
          {subscriptionData.subscription.canManageSubscription && (
            <button
              onClick={handleOpenStripePortal}
              disabled={openingPortal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {openingPortal ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Abriendo...
                </>
              ) : (
                <>
                  <Settings className="w-5 h-5" />
                  Gestionar Suscripción
                  <ExternalLink className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Información del Plan */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">{subscriptionData.plan.name}</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Precio:</span>
                <span className="font-medium text-gray-900">
                  {subscriptionData.plan.price === 0 ? 'Gratis' : 
                   `$${subscriptionData.plan.price}/${subscriptionData.plan.interval === 'month' ? 'mes' : 'año'}`
                  }
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estado:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscriptionData.subscription.status)}`}>
                  {getStatusText(subscriptionData.subscription.status)}
                </span>
              </div>

              {subscriptionData.subscription.nextBillingDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Próxima facturación:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(subscriptionData.subscription.nextBillingDate).toLocaleDateString('es-ES')}
                  </span>
                </div>
              )}

              {subscriptionData.subscription.cancelAtPeriodEnd && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-yellow-800 text-sm">
                      Tu suscripción se cancelará al final del período actual
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Acciones Disponibles */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">¿Qué puedes hacer?</h3>
            
            <div className="space-y-3">
              {subscriptionData.subscription.canManageSubscription ? (
                <>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Cambiar de plan (upgrade/downgrade)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Actualizar método de pago</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Ver y descargar facturas</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Cancelar suscripción</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Actualizar información de facturación</span>
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-600 text-sm">
                    {subscriptionData.plan.price === 0 
                      ? 'Estás en el plan gratuito. Puedes actualizar a un plan de pago en cualquier momento.'
                      : 'Para gestionar tu suscripción, necesitas tener un método de pago configurado.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Información Adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <CreditCard className="w-6 h-6 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-blue-900 font-medium mb-2">Portal de Gestión Seguro</h3>
            <p className="text-blue-800 text-sm">
              Al hacer clic en "Gestionar Suscripción", serás redirigido al portal seguro de Stripe donde podrás:
            </p>
            <ul className="text-blue-800 text-sm mt-2 space-y-1">
              <li>• Cambiar tu plan de suscripción</li>
              <li>• Actualizar tu método de pago</li>
              <li>• Ver tu historial de facturas</li>
              <li>• Cancelar tu suscripción si lo deseas</li>
            </ul>
            <p className="text-blue-700 text-xs mt-3">
              Todos los datos de pago son procesados de forma segura por Stripe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Funciones auxiliares que debes implementar según tu sistema de autenticación
function getCurrentUserId(): string {
  // Implementa tu lógica para obtener el ID del usuario actual
  // Por ejemplo, desde el contexto de autenticación, localStorage, etc.
  return 'user-id-here';
}

function getAuthToken(): string {
  // Implementa tu lógica para obtener el token de autenticación
  // Por ejemplo, desde localStorage, contexto, etc.
  return localStorage.getItem('auth-token') || '';
}