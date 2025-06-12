# 🚀 **Integración de Stripe para Entorno de Desarrollo Real**

## 📋 **Configuración Actual**

Tu sistema ya está configurado para un entorno de desarrollo real donde los clientes pueden gestionar directamente sus suscripciones. Aquí tienes todo lo que necesitas saber:

## ✅ **Funcionalidades Habilitadas**

### **Portal de Cliente Mejorado**
- ✅ **Cambio de planes** - Los usuarios pueden actualizar/degradar sus planes
- ✅ **Gestión de métodos de pago** - Agregar/cambiar tarjetas
- ✅ **Historial de facturas** - Ver y descargar facturas
- ✅ **Actualización de datos** - Cambiar email, nombre, dirección, teléfono
- ✅ **Cancelación de suscripción** - Al final del período actual
- ✅ **Política de privacidad y términos** - Enlaces configurados

### **Checkout Mejorado**
- ✅ **Códigos promocionales** - Los usuarios pueden aplicar descuentos
- ✅ **Recolección de dirección** - Para facturación automática
- ✅ **Recolección de Tax ID** - Para empresas
- ✅ **Términos de servicio** - Aceptación requerida
- ✅ **Facturación automática** - Facturas generadas automáticamente

## 🔧 **Implementación en el Proyecto Principal**

### **1. Cargar Planes Dinámicamente**

```javascript
// Obtener todos los planes disponibles
const loadPlans = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-plans`);
    const data = await response.json();
    
    if (data.success) {
      return data.plans;
    } else {
      throw new Error(data.error || 'Error al cargar planes');
    }
  } catch (error) {
    console.error('Error loading plans:', error);
    return [];
  }
};
```

### **2. Crear Sesión de Pago**

```javascript
// Crear sesión de pago para suscripción
const createPaymentSession = async (planId, user) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: planId,
        userId: user.id, // Opcional pero recomendado
        userEmail: user.email,
        userName: user.name,
        successUrl: `${window.location.origin}/subscription/success?plan=${planId}`,
        cancelUrl: `${window.location.origin}/subscription/cancel`
      })
    });

    const data = await response.json();
    
    if (data.success) {
      // Redireccionar a Stripe Checkout
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Error al crear sesión de pago');
    }
  } catch (error) {
    console.error('Error creating payment session:', error);
    alert('Error al procesar el pago. Intenta de nuevo.');
  }
};
```

### **3. Abrir Portal de Gestión**

```javascript
// Abrir portal de Stripe para gestión completa
const openCustomerPortal = async (userId) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        returnUrl: window.location.href
      })
    });

    const data = await response.json();
    
    if (data.success) {
      // Abrir portal en la misma ventana
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Error al abrir portal');
    }
  } catch (error) {
    console.error('Error opening portal:', error);
    alert('Error al abrir el portal de gestión.');
  }
};
```

### **4. Verificar Estado de Suscripción**

```javascript
// Obtener estado actual de la suscripción del usuario
const getUserSubscriptionStatus = async (userId) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-subscription-status?userId=${userId}`
    );
    
    const data = await response.json();
    
    if (data.success) {
      return {
        user: data.user,
        plan: data.plan,
        subscription: data.subscription,
        billing: data.billing
      };
    } else {
      throw new Error(data.error || 'Error al obtener estado');
    }
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return null;
  }
};
```

## 🎨 **Componente React Completo para Desarrollo**

```jsx
import React, { useState, useEffect } from 'react';

export default function SubscriptionManager() {
  const [plans, setPlans] = useState([]);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user] = useAuth(); // Tu hook de autenticación

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Cargar planes disponibles
      const plansData = await loadPlans();
      setPlans(plansData);

      // Cargar estado del usuario si está autenticado
      if (user?.id) {
        const status = await getUserSubscriptionStatus(user.id);
        setUserStatus(status);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId) => {
    if (!user) {
      alert('Debes iniciar sesión primero');
      return;
    }

    await createPaymentSession(planId, user);
  };

  const handleManageSubscription = async () => {
    if (!user?.id) {
      alert('Debes iniciar sesión primero');
      return;
    }

    await openCustomerPortal(user.id);
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Gestiona tu Suscripción</h1>

      {/* Estado Actual */}
      {userStatus && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Tu Plan Actual</h2>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">{userStatus.plan?.name}</h3>
              <p className="text-gray-600">{userStatus.plan?.description}</p>
              <p className="text-2xl font-bold text-blue-600">
                {userStatus.plan?.isFree ? 'Gratis' : `$${userStatus.plan?.price}/${userStatus.plan?.interval}`}
              </p>
            </div>
            
            {userStatus.subscription?.canManageSubscription && (
              <button
                onClick={handleManageSubscription}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Gestionar Suscripción
              </button>
            )}
          </div>

          {userStatus.subscription?.nextBillingDate && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Próxima facturación: {new Date(userStatus.subscription.nextBillingDate).toLocaleDateString()}
              </p>
              {userStatus.subscription.cancelAtPeriodEnd && (
                <p className="text-sm text-red-600 mt-1">
                  Tu suscripción se cancelará al final del período actual
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Planes Disponibles */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-lg shadow-md p-6 ${
              userStatus?.plan?.id === plan.id ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
            <p className="text-gray-600 mb-4">{plan.description}</p>
            
            <div className="mb-4">
              <span className="text-3xl font-bold">
                {plan.isFree ? 'Gratis' : `$${plan.price}`}
              </span>
              {!plan.isFree && (
                <span className="text-gray-500">/{plan.interval}</span>
              )}
            </div>

            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            {userStatus?.plan?.id === plan.id ? (
              <button
                disabled
                className="w-full bg-gray-300 text-gray-500 py-2 rounded-lg cursor-not-allowed"
              >
                Plan Actual
              </button>
            ) : (
              <button
                onClick={() => handleSelectPlan(plan.id)}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {plan.isFree ? 'Cambiar a Gratis' : 'Actualizar Plan'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Información del Portal */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-blue-900 font-medium mb-2">Portal de Gestión Completo</h3>
        <p className="text-blue-800 text-sm mb-4">
          En el portal de gestión podrás:
        </p>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• Cambiar tu plan de suscripción (upgrade/downgrade)</li>
          <li>• Actualizar tu método de pago</li>
          <li>• Ver y descargar todas tus facturas</li>
          <li>• Actualizar tu información de facturación</li>
          <li>• Cancelar tu suscripción si lo deseas</li>
          <li>• Aplicar códigos promocionales</li>
        </ul>
      </div>
    </div>
  );
}
```

## 🎯 **Características del Entorno de Desarrollo**

### ✅ **Para el Usuario Final:**
- **Portal completo** - Gestión total de la suscripción
- **Cambios inmediatos** - Los cambios se reflejan al instante
- **Facturación automática** - Facturas generadas automáticamente
- **Códigos promocionales** - Pueden aplicar descuentos
- **Cancelación flexible** - Al final del período actual

### ✅ **Para el Desarrollador:**
- **Logs detallados** - Seguimiento completo de todas las acciones
- **Webhooks automáticos** - Sincronización automática con la base de datos
- **Metadata extendida** - Información adicional para debugging
- **Entorno identificado** - Marcado como 'development' en Stripe

### ✅ **Funcionalidades Avanzadas:**
- **Proration automática** - Cálculo proporcional en cambios de plan
- **Trial periods** - Configurables por plan
- **Tax collection** - Recolección automática de impuestos
- **Invoice generation** - Facturas automáticas
- **Customer updates** - Actualización de datos del cliente

## 🚀 **Próximos Pasos**

1. **Implementa el componente** en tu proyecto principal
2. **Configura las URLs** de éxito y cancelación
3. **Personaliza el diseño** según tu marca
4. **Prueba todos los flujos** de pago y gestión
5. **Configura webhooks** para sincronización automática

¡Tu sistema está listo para un entorno de desarrollo real donde los clientes pueden gestionar completamente sus suscripciones! 🎉