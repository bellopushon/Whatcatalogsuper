# 🎯 **Guía Completa de Integración con Stripe**

## 📋 **Resumen de la Integración**

Esta integración permite que el **proyecto principal** gestione suscripciones de manera **completamente automática** con Stripe, proporcionando una experiencia de usuario fluida y profesional.

## 🔧 **Funciones Edge Disponibles para el Proyecto Principal**

### 1. **Obtener Planes Disponibles**
```typescript
// GET /functions/v1/get-plans
const response = await fetch(`${SUPABASE_URL}/functions/v1/get-plans`);
const { plans } = await response.json();
```

### 2. **Crear Sesión de Pago**
```typescript
// POST /functions/v1/create-payment-session
const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    planId: 'plan-uuid',
    userId: 'user-uuid', // Opcional
    userEmail: 'user@example.com',
    userName: 'Usuario Nombre',
    successUrl: 'https://tu-app.com/success',
    cancelUrl: 'https://tu-app.com/cancel'
  })
});
const { url } = await response.json();
// Redireccionar a: url
```

### 3. **Portal de Cliente de Stripe**
```typescript
// POST /functions/v1/create-customer-portal-session
const response = await fetch(`${SUPABASE_URL}/functions/v1/create-customer-portal-session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-uuid',
    returnUrl: 'https://tu-app.com/subscription'
  })
});
const { url } = await response.json();
// Redireccionar a: url
```

### 4. **Estado de Suscripción del Usuario**
```typescript
// GET /functions/v1/get-user-subscription-status?userId=user-uuid
const response = await fetch(`${SUPABASE_URL}/functions/v1/get-user-subscription-status?userId=${userId}`);
const { user, plan, subscription, billing } = await response.json();
```

### 5. **Facturas del Usuario**
```typescript
// GET /functions/v1/get-user-invoices?userId=user-uuid&limit=10
const response = await fetch(`${SUPABASE_URL}/functions/v1/get-user-invoices?userId=${userId}&limit=10`);
const { invoices } = await response.json();
```

## 🎨 **Implementación en el Proyecto Principal**

### **Página de Suscripción Completa**

```typescript
// components/SubscriptionPage.tsx
import React, { useState, useEffect } from 'react';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  isFree: boolean;
  features: string[];
  limits: {
    maxStores: number;
    maxProducts: number;
    maxCategories: number;
  };
}

interface SubscriptionStatus {
  status: string;
  nextBillingDate?: string;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  canManageSubscription: boolean;
}

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [user] = useAuth(); // Tu hook de autenticación

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Cargar planes disponibles
      const plansResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-plans`);
      const plansData = await plansResponse.json();
      setPlans(plansData.plans || []);

      // Cargar estado de suscripción del usuario
      if (user?.id) {
        const statusResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-subscription-status?userId=${user.id}`
        );
        const statusData = await statusResponse.json();
        setCurrentPlan(statusData.plan);
        setSubscription(statusData.subscription);
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          userId: user?.id,
          userEmail: user?.email,
          userName: user?.name,
          successUrl: `${window.location.origin}/subscription/success`,
          cancelUrl: `${window.location.origin}/subscription`
        })
      });

      const data = await response.json();
      if (data.success) {
        window.location.href = data.url; // Redireccionar a Stripe
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          returnUrl: `${window.location.origin}/subscription`
        })
      });

      const data = await response.json();
      if (data.success) {
        window.location.href = data.url; // Redireccionar al portal de Stripe
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Tu Suscripción</h1>

      {/* Estado Actual */}
      {currentPlan && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Plan Actual</h2>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">{currentPlan.name}</h3>
              <p className="text-gray-600">{currentPlan.description}</p>
              <p className="text-2xl font-bold text-blue-600">
                {currentPlan.isFree ? 'Gratis' : `$${currentPlan.price}/${currentPlan.interval}`}
              </p>
            </div>
            
            {subscription?.canManageSubscription && (
              <div className="space-y-2">
                <button
                  onClick={handleManageSubscription}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Gestionar Suscripción
                </button>
                <p className="text-sm text-gray-500">
                  Actualizar plan, cambiar tarjeta, ver facturas, cancelar
                </p>
              </div>
            )}
          </div>

          {subscription?.nextBillingDate && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Próxima facturación: {new Date(subscription.nextBillingDate).toLocaleDateString()}
              </p>
              {subscription.cancelAtPeriodEnd && (
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
              currentPlan?.id === plan.id ? 'ring-2 ring-blue-500' : ''
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

            {currentPlan?.id === plan.id ? (
              <button
                disabled
                className="w-full bg-gray-300 text-gray-500 py-2 rounded-lg cursor-not-allowed"
              >
                Plan Actual
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade(plan.id)}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                {plan.isFree ? 'Cambiar a Gratis' : 'Actualizar Plan'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### **Componente de Facturas**

```typescript
// components/InvoicesPage.tsx
import React, { useState, useEffect } from 'react';

interface Invoice {
  id: string;
  number: string;
  status: string;
  amount: number;
  currency: string;
  date: string;
  hostedInvoiceUrl: string;
  invoicePdf: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [user] = useAuth();

  useEffect(() => {
    loadInvoices();
  }, [user]);

  const loadInvoices = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-invoices?userId=${user?.id}&limit=20`
      );
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'open': return 'text-yellow-600 bg-yellow-100';
      case 'void': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return <div>Cargando facturas...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Historial de Facturas</h1>

      {invoices.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No tienes facturas disponibles</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Factura
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {invoice.number || invoice.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(invoice.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatAmount(invoice.amount, invoice.currency)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <a
                        href={invoice.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Ver
                      </a>
                      <a
                        href={invoice.invoicePdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900"
                      >
                        PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

## 🔄 **Flujo de Usuario Completo**

### **1. Usuario ve planes disponibles**
- Carga automática desde el Super Admin
- Precios y características actualizadas en tiempo real

### **2. Usuario selecciona un plan**
- Redirección automática a Stripe Checkout
- Proceso de pago seguro y profesional

### **3. Usuario gestiona su suscripción**
- **Actualizar plan**: Portal de Stripe
- **Cambiar tarjeta**: Portal de Stripe  
- **Ver facturas**: Portal de Stripe + tu aplicación
- **Cancelar**: Portal de Stripe

### **4. Webhooks automáticos**
- Actualización automática del plan del usuario
- Sincronización de estado de suscripción
- Registro de transacciones

## ⚙️ **Configuración del Super Administrador**

### **1. Configurar Stripe**
1. Ir a la pestaña "Stripe" en el Super Admin
2. Agregar las claves de Stripe (test o live)
3. Configurar webhook endpoint: `${SUPABASE_URL}/functions/v1/stripe-webhook`

### **2. Crear Planes**
1. Ir a la pestaña "Planes"
2. Crear planes con precios y características
3. Los planes se sincronizan automáticamente con Stripe

### **3. Gestionar Usuarios**
1. Ver usuarios y sus planes actuales
2. Cambiar planes manualmente si es necesario
3. Corregir problemas de Stripe Customer ID

## 🎯 **Beneficios de esta Integración**

### **Para el Usuario Final:**
- ✅ **Experiencia fluida**: Todo se maneja automáticamente
- ✅ **Portal profesional**: Gestión completa en Stripe
- ✅ **Facturas automáticas**: Descarga directa desde Stripe
- ✅ **Seguridad**: Datos de pago nunca pasan por tu servidor

### **Para el Desarrollador:**
- ✅ **Sin complejidad**: Solo llamadas a APIs simples
- ✅ **Mantenimiento mínimo**: Stripe maneja todo el billing
- ✅ **Escalable**: Funciona para miles de usuarios
- ✅ **Flexible**: Fácil agregar nuevos planes

### **Para el Super Admin:**
- ✅ **Control total**: Gestión completa de planes y usuarios
- ✅ **Sincronización automática**: Planes se crean en Stripe automáticamente
- ✅ **Monitoreo**: Logs completos de todas las acciones
- ✅ **Corrección automática**: Herramientas para solucionar problemas

## 🚀 **Implementación Rápida**

```typescript
// 1. Instalar en tu proyecto principal
npm install @supabase/supabase-js

// 2. Configurar cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Usar las funciones
const plans = await getPlans();
const paymentUrl = await createPaymentSession(planId, user);
const portalUrl = await createCustomerPortal(userId);
```

## 📞 **Soporte**

Si tienes problemas con la integración:

1. **Verificar configuración de Stripe** en el Super Admin
2. **Revisar logs del sistema** para errores
3. **Usar la función de corrección** para usuarios con problemas
4. **Contactar soporte** si persisten los problemas

---

**Esta integración te da una solución completa de billing con Stripe sin la complejidad de implementarlo desde cero. ¡Todo está listo para usar!** 🎉