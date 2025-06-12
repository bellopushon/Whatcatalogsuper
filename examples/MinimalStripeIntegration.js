// 🎯 INTEGRACIÓN MÍNIMA Y COMPLETA CON STRIPE
// Solo lo esencial para que funcione perfecto

import { loadStripe } from '@stripe/stripe-js';

// Inicializar Stripe (solo una vez)
const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

class SubscriptionManager {
  constructor() {
    this.plans = [];
    this.user = null;
  }

  // 1. Cargar planes del Super Admin (lo único que necesitas de él)
  async loadPlans() {
    try {
      const response = await fetch('https://tu-super-admin.com/functions/v1/get-plans');
      const data = await response.json();
      this.plans = data.plans;
      return this.plans;
    } catch (error) {
      console.error('Error loading plans:', error);
      return [];
    }
  }

  // 2. Suscribirse a un plan (directo con Stripe)
  async subscribeToPlan(planId) {
    const plan = this.plans.find(p => p.id === planId);
    if (!plan) throw new Error('Plan no encontrado');

    const { error } = await stripe.redirectToCheckout({
      lineItems: [{
        price: plan.stripe_price_id, // Ya viene del Super Admin
        quantity: 1,
      }],
      mode: 'subscription',
      successUrl: `${window.location.origin}/success?plan=${planId}`,
      cancelUrl: `${window.location.origin}/pricing`,
      customerEmail: this.user?.email,
      clientReferenceId: this.user?.id,
      // Metadata para tracking
      metadata: {
        userId: this.user?.id,
        planId: planId,
        planName: plan.name
      }
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  // 3. Abrir portal de gestión (directo con Stripe)
  async openBillingPortal() {
    if (!this.user?.stripeCustomerId) {
      throw new Error('Usuario no tiene customer ID de Stripe');
    }

    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerId: this.user.stripeCustomerId,
          returnUrl: window.location.href
        })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No se pudo crear sesión del portal');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      throw error;
    }
  }

  // 4. Verificar estado de suscripción
  async checkSubscriptionStatus() {
    if (!this.user?.id) return null;

    try {
      const response = await fetch(`/api/subscription-status/${this.user.id}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return null;
    }
  }

  // 5. Setear usuario actual
  setUser(user) {
    this.user = user;
  }
}

// Exportar instancia singleton
export const subscriptionManager = new SubscriptionManager();

// 🎯 BACKEND MÍNIMO (Node.js/Express)

// Endpoint 1: Crear sesión del portal
app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { customerId, returnUrl } = req.body;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || 'https://tu-app.com/billing',
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint 2: Webhook de Stripe (lo más importante)
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar eventos importantes
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object);
      break;
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
  }

  res.json({received: true});
});

// Funciones auxiliares para webhooks
async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id;
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  // Actualizar usuario en tu base de datos
  await updateUser(userId, {
    stripeCustomerId: customerId,
    subscriptionId: subscriptionId,
    subscriptionStatus: 'active',
    planId: session.metadata.planId // Si lo incluiste
  });

  console.log(`✅ User ${userId} subscribed successfully`);
}

async function handleSubscriptionChange(subscription) {
  // Encontrar usuario por customer ID
  const user = await findUserByStripeCustomerId(subscription.customer);
  if (!user) return;

  await updateUser(user.id, {
    subscriptionStatus: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  });

  console.log(`✅ Subscription updated for user ${user.id}`);
}

async function handleSubscriptionCanceled(subscription) {
  const user = await findUserByStripeCustomerId(subscription.customer);
  if (!user) return;

  // Downgrade a plan gratuito
  await updateUser(user.id, {
    subscriptionStatus: 'canceled',
    planId: 'free-plan-id' // Tu plan gratuito
  });

  console.log(`✅ User ${user.id} downgraded to free plan`);
}

// 🎨 COMPONENTE REACT SÚPER SIMPLE

import React, { useState, useEffect } from 'react';
import { subscriptionManager } from './subscriptionManager';

export default function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Cargar usuario actual (tu lógica)
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      subscriptionManager.setUser(currentUser);

      // Cargar planes del Super Admin
      const plansData = await subscriptionManager.loadPlans();
      setPlans(plansData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId) => {
    try {
      await subscriptionManager.subscribeToPlan(planId);
    } catch (error) {
      alert('Error al procesar suscripción: ' + error.message);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await subscriptionManager.openBillingPortal();
    } catch (error) {
      alert('Error al abrir portal: ' + error.message);
    }
  };

  if (loading) return <div>Cargando planes...</div>;

  return (
    <div className="pricing-page">
      <h1>Elige tu Plan</h1>
      
      <div className="plans-grid">
        {plans.map(plan => (
          <div key={plan.id} className="plan-card">
            <h3>{plan.name}</h3>
            <div className="price">
              {plan.isFree ? 'Gratis' : `$${plan.price}/${plan.interval}`}
            </div>
            <ul className="features">
              {plan.features.map(feature => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <button 
              onClick={() => handleSelectPlan(plan.id)}
              className="subscribe-btn"
            >
              {plan.isFree ? 'Comenzar Gratis' : 'Suscribirse'}
            </button>
          </div>
        ))}
      </div>

      {user?.stripeCustomerId && (
        <div className="billing-section">
          <h2>Gestionar Suscripción</h2>
          <button onClick={handleManageSubscription}>
            Abrir Portal de Facturación
          </button>
        </div>
      )}
    </div>
  );
}