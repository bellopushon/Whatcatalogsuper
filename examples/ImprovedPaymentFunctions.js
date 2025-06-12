// Versión mejorada que maneja tanto usuarios nuevos como existentes

// 1. Función para cargar planes (sin cambios)
const loadPlans = async () => {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-plans`);
  const data = await response.json();
  return data.plans;
};

// 2. Función mejorada para crear sesión de pago
const handlePayment = async (planId, user) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-session`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}` // Si tienes autenticación
      },
      body: JSON.stringify({
        planId,
        userId: user.id, // ✅ Incluir userId si está disponible
        userEmail: user.email,
        userName: user.name,
        successUrl: window.location.origin + '/success',
        cancelUrl: window.location.origin + '/cancel'
      })
    });
    
    const data = await response.json();
    if (data.success) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Error al crear sesión de pago');
    }
  } catch (error) {
    console.error('Error creating payment session:', error);
    alert('Error al procesar el pago. Intenta de nuevo.');
  }
};

// 3. Función para cambiar plan (usuarios existentes)
const handlePlanChange = async (newPlanId, user) => {
  try {
    // Para usuarios existentes con suscripción activa
    if (user.stripeCustomerId && user.subscriptionId) {
      // Usar el portal de Stripe para cambios de plan
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          userId: user.id,
          returnUrl: window.location.href
        })
      });
      
      const data = await response.json();
      if (data.success) {
        window.location.href = data.url;
      }
    } else {
      // Para usuarios sin suscripción activa, crear nueva sesión
      await handlePayment(newPlanId, user);
    }
  } catch (error) {
    console.error('Error changing plan:', error);
    alert('Error al cambiar el plan. Intenta de nuevo.');
  }
};

// 4. Función para obtener estado de suscripción
const getUserSubscriptionStatus = async (userId) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-subscription-status?userId=${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      }
    );
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return null;
  }
};

// 5. Función para abrir portal de gestión
const openStripePortal = async (userId) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal-session`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        userId: userId,
        returnUrl: window.location.href
      })
    });
    
    const data = await response.json();
    if (data.success) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Error al abrir portal');
    }
  } catch (error) {
    console.error('Error opening portal:', error);
    alert('Error al abrir el portal de gestión.');
  }
};

// 6. Función auxiliar para obtener token de autenticación
function getAuthToken() {
  // Implementa según tu sistema de autenticación
  return localStorage.getItem('supabase.auth.token') || '';
}

// 7. Ejemplo de uso completo
const SubscriptionComponent = () => {
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  useEffect(() => {
    loadUserData();
    loadPlansData();
  }, []);

  const loadUserData = async () => {
    // Cargar datos del usuario actual
    const userData = getCurrentUser(); // Tu función
    setUser(userData);
    
    if (userData?.id) {
      const status = await getUserSubscriptionStatus(userData.id);
      setSubscriptionStatus(status);
    }
  };

  const loadPlansData = async () => {
    const plansData = await loadPlans();
    setPlans(plansData);
  };

  const handleSelectPlan = async (planId) => {
    if (!user) {
      alert('Debes iniciar sesión primero');
      return;
    }

    // Determinar si es upgrade, downgrade o nueva suscripción
    if (subscriptionStatus?.subscription?.status === 'active') {
      // Usuario con suscripción activa - usar portal
      await handlePlanChange(planId, user);
    } else {
      // Usuario nuevo o sin suscripción activa - crear nueva sesión
      await handlePayment(planId, user);
    }
  };

  return (
    <div>
      {/* Tu UI de planes aquí */}
      {plans.map(plan => (
        <div key={plan.id}>
          <h3>{plan.name}</h3>
          <p>${plan.price}/{plan.interval}</p>
          <button onClick={() => handleSelectPlan(plan.id)}>
            {subscriptionStatus?.plan?.id === plan.id ? 'Plan Actual' : 'Seleccionar'}
          </button>
        </div>
      ))}
      
      {/* Botón para gestionar suscripción */}
      {subscriptionStatus?.subscription?.canManageSubscription && (
        <button onClick={() => openStripePortal(user.id)}>
          Gestionar Suscripción
        </button>
      )}
    </div>
  );
};