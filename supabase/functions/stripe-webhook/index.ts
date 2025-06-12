const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

// Helper function to map Stripe subscription status to database enum values
function mapStripeStatusToDbStatus(stripeStatus: string): 'active' | 'canceled' | 'expired' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'unpaid':
      return 'active';
    case 'canceled':
      return 'canceled';
    case 'incomplete_expired':
    case 'ended':
      return 'expired';
    case 'incomplete':
    default:
      return 'active'; // Default to active for incomplete or unknown statuses
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Stripe webhook received');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables');
      return new Response('Server configuration error', { status: 500 });
    }

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return new Response('Missing signature', { status: 400 });
    }

    // Parse the event
    let event: StripeEvent;
    try {
      event = JSON.parse(body);
    } catch (err) {
      console.error('Invalid JSON:', err);
      return new Response('Invalid JSON', { status: 400 });
    }

    console.log(`📨 Processing Stripe event: ${event.type}`);

    // Store webhook event
    const webhookResponse = await fetch(`${supabaseUrl}/rest/v1/stripe_webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stripe_event_id: event.id,
        event_type: event.type,
        data: event.data,
        processed: false
      })
    });

    if (!webhookResponse.ok) {
      console.error('Failed to store webhook event');
    }

    // Process different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, supabaseUrl, serviceRoleKey);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event, supabaseUrl, serviceRoleKey);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event, supabaseUrl, serviceRoleKey);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event, supabaseUrl, serviceRoleKey);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, supabaseUrl, serviceRoleKey);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event, supabaseUrl, serviceRoleKey);
        break;
      
      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    // Mark webhook as processed
    await fetch(`${supabaseUrl}/rest/v1/stripe_webhooks?stripe_event_id=eq.${event.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ processed: true })
    });

    console.log('✅ Webhook processed successfully');
    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});

async function handleCheckoutCompleted(event: StripeEvent, supabaseUrl: string, serviceRoleKey: string) {
  const session = event.data.object;
  
  console.log(`🛒 Checkout completed: ${session.id}`);
  
  const metadata = session.metadata || {};
  const userEmail = metadata.user_email || session.customer_details?.email;
  const planId = metadata.plan_id;
  
  if (!userEmail || !planId) {
    console.error('Missing user email or plan ID in checkout session');
    return;
  }

  // Find or create user
  let userId = metadata.user_id;
  
  if (!userId) {
    // Try to find user by email
    const userResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id&email=eq.${userEmail}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      }
    );

    if (userResponse.ok) {
      const users = await userResponse.json();
      if (users.length > 0) {
        userId = users[0].id;
      }
    }
  }

  if (userId) {
    // Update user's plan and save stripe_customer_id
    await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan: planId,
        subscription_status: 'active',
        subscription_id: session.subscription,
        stripe_customer_id: session.customer, // Fix: Save the Stripe customer ID
        subscription_start_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    console.log(`✅ Updated user ${userId} to plan ${planId} with customer ID ${session.customer}`);
  }

  // Store transaction
  await fetch(`${supabaseUrl}/rest/v1/stripe_transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: session.payment_intent || `checkout_${session.id}`,
      user_id: userId,
      customer_id: session.customer,
      amount: session.amount_total,
      currency: session.currency,
      status: 'succeeded',
      subscription_id: session.subscription,
      metadata: {
        ...metadata,
        checkout_session_id: session.id,
        type: 'checkout'
      }
    })
  });
}

async function handlePaymentSucceeded(event: StripeEvent, supabaseUrl: string, serviceRoleKey: string) {
  const paymentIntent = event.data.object;
  
  console.log(`💰 Payment succeeded: ${paymentIntent.id}`);
  
  // Store transaction
  await fetch(`${supabaseUrl}/rest/v1/stripe_transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: paymentIntent.id,
      customer_id: paymentIntent.customer,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      payment_method: paymentIntent.payment_method,
      metadata: paymentIntent.metadata || {}
    })
  });

  // Update user subscription if this is a subscription payment
  const metadata = paymentIntent.metadata || {};
  if (metadata.user_id && metadata.plan_id) {
    // Also update stripe_customer_id if available
    const updateData: any = {
      plan: metadata.plan_id,
      subscription_status: 'active',
      subscription_start_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (paymentIntent.customer) {
      updateData.stripe_customer_id = paymentIntent.customer;
    }

    await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${metadata.user_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
  }
}

async function handlePaymentFailed(event: StripeEvent, supabaseUrl: string, serviceRoleKey: string) {
  const paymentIntent = event.data.object;
  
  console.log(`❌ Payment failed: ${paymentIntent.id}`);
  
  // Store failed transaction
  await fetch(`${supabaseUrl}/rest/v1/stripe_transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: paymentIntent.id,
      customer_id: paymentIntent.customer,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'failed',
      payment_method: paymentIntent.payment_method,
      metadata: paymentIntent.metadata || {}
    })
  });
}

async function handleSubscriptionChange(event: StripeEvent, supabaseUrl: string, serviceRoleKey: string) {
  const subscription = event.data.object;
  
  console.log(`🔄 Subscription ${event.type}: ${subscription.id}`);
  
  // Find user by customer ID
  const customerResponse = await fetch(
    `${supabaseUrl}/rest/v1/users?select=id&stripe_customer_id=eq.${subscription.customer}&limit=1`,
    {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      }
    }
  );
  
  if (customerResponse.ok) {
    const users = await customerResponse.json();
    if (users.length > 0) {
      const userId = users[0].id;
      
      // Map Stripe status to database enum value
      const mappedStatus = mapStripeStatusToDbStatus(subscription.status);
      
      // Update user subscription
      await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription_id: subscription.id,
          subscription_status: mappedStatus,
          subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
          subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
      });

      console.log(`✅ Updated user ${userId} subscription status: ${subscription.status} -> ${mappedStatus}`);
    }
  } else {
    // Fallback: try to find user by customer ID in transactions
    const transactionResponse = await fetch(
      `${supabaseUrl}/rest/v1/stripe_transactions?select=user_id&customer_id=eq.${subscription.customer}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      }
    );
    
    if (transactionResponse.ok) {
      const transactions = await transactionResponse.json();
      if (transactions.length > 0) {
        const userId = transactions[0].user_id;
        
        // Map Stripe status to database enum value
        const mappedStatus = mapStripeStatusToDbStatus(subscription.status);
        
        // Update user subscription and ensure stripe_customer_id is set
        await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subscription_id: subscription.id,
            subscription_status: mappedStatus,
            stripe_customer_id: subscription.customer, // Ensure customer ID is saved
            subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
        });

        console.log(`✅ Updated user ${userId} subscription status: ${subscription.status} -> ${mappedStatus}`);
      }
    }
  }
}

async function handleSubscriptionDeleted(event: StripeEvent, supabaseUrl: string, serviceRoleKey: string) {
  const subscription = event.data.object;
  
  console.log(`🗑️ Subscription deleted: ${subscription.id}`);
  
  // Find user by subscription ID
  const userResponse = await fetch(
    `${supabaseUrl}/rest/v1/users?select=id&subscription_id=eq.${subscription.id}&limit=1`,
    {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      }
    }
  );
  
  if (userResponse.ok) {
    const users = await userResponse.json();
    if (users.length > 0) {
      const userId = users[0].id;
      
      // Get free plan UUID from database
      const planResponse = await fetch(
        `${supabaseUrl}/rest/v1/plans?select=id&is_free=eq.true&is_active=eq.true&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
          }
        }
      );
      
      let freePlanId = null; // Changed from hardcoded string to null
      if (planResponse.ok) {
        const plans = await planResponse.json();
        if (plans.length > 0) {
          freePlanId = plans[0].id; // Use the actual UUID from database
          console.log(`✅ Found free plan: ${freePlanId}`);
        } else {
          console.error('❌ No free plan found in database! Please configure a free plan in Super Admin.');
        }
      } else {
        console.error('❌ Failed to fetch free plan from database');
      }
      
      // Downgrade user to free plan (or null if no free plan exists)
      await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan: freePlanId, // Will be UUID or null
          subscription_status: 'canceled',
          subscription_canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });

      if (freePlanId) {
        console.log(`✅ User ${userId} downgraded to free plan: ${freePlanId}`);
      } else {
        console.log(`⚠️ User ${userId} plan set to null - no free plan available`);
      }
    }
  }
}

async function handleInvoicePaymentSucceeded(event: StripeEvent, supabaseUrl: string, serviceRoleKey: string) {
  const invoice = event.data.object;
  
  console.log(`📄 Invoice payment succeeded: ${invoice.id}`);
  
  // Store transaction for invoice payment
  await fetch(`${supabaseUrl}/rest/v1/stripe_transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: `inv_${invoice.id}`,
      customer_id: invoice.customer,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      subscription_id: invoice.subscription,
      metadata: { invoice_id: invoice.id, type: 'invoice' }
    })
  });
}