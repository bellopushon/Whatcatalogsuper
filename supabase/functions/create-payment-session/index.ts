const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreatePaymentRequest {
  planId: string;
  userId?: string;
  userEmail: string;
  userName: string;
  successUrl: string;
  cancelUrl: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Creating payment session for plan');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Server configuration error' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { planId, userId, userEmail, userName, successUrl, cancelUrl }: CreatePaymentRequest = await req.json();

    console.log(`📋 Processing payment for plan: ${planId}, user: ${userEmail}`);

    // 1. Get Stripe configuration
    const configResponse = await fetch(
      `${supabaseUrl}/rest/v1/stripe_config?select=*&is_active=eq.true&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      }
    );

    if (!configResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Stripe not configured' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const configs = await configResponse.json();
    if (configs.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Stripe configuration not found' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const stripeConfig = configs[0];

    // 2. Get plan details from Super Admin
    const planResponse = await fetch(
      `${supabaseUrl}/rest/v1/plans?select=*&id=eq.${planId}&is_active=eq.true&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      }
    );

    if (!planResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Plan not found' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const plans = await planResponse.json();
    if (plans.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Plan not available' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const plan = plans[0];

    // 3. Check if plan is free
    if (plan.is_free || plan.price === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'This plan is free, no payment required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 4. Create or get Stripe customer
    let customerId = null;
    
    // Try to find existing customer
    const customerSearchResponse = await fetch(
      `https://api.stripe.com/v1/customers/search?query=email:'${userEmail}'`,
      {
        headers: {
          'Authorization': `Bearer ${stripeConfig.secret_key}`,
        }
      }
    );

    if (customerSearchResponse.ok) {
      const customerSearch = await customerSearchResponse.json();
      if (customerSearch.data && customerSearch.data.length > 0) {
        customerId = customerSearch.data[0].id;
        console.log(`👤 Found existing customer: ${customerId}`);
      }
    }

    // Create customer if not found
    if (!customerId) {
      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeConfig.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          email: userEmail,
          name: userName,
          'metadata[user_id]': userId || '',
          'metadata[plan_id]': planId
        })
      });

      if (customerResponse.ok) {
        const customer = await customerResponse.json();
        customerId = customer.id;
        console.log(`👤 Created new customer: ${customerId}`);
      }
    }

    // 5. Create Stripe checkout session
    const sessionParams = new URLSearchParams({
      'mode': 'subscription',
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': plan.name,
      'line_items[0][price_data][product_data][description]': plan.description,
      'line_items[0][price_data][unit_amount]': Math.round(plan.price * 100).toString(),
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][quantity]': '1',
      'metadata[user_id]': userId || '',
      'metadata[user_email]': userEmail,
      'metadata[plan_id]': planId,
      'metadata[plan_name]': plan.name,
      'metadata[plan_price]': plan.price.toString(),
      'allow_promotion_codes': 'true',
      'billing_address_collection': 'auto',
      'customer_update[address]': 'auto',
      'customer_update[name]': 'auto'
    });

    if (customerId) {
      sessionParams.append('customer', customerId);
    } else {
      sessionParams.append('customer_email', userEmail);
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: sessionParams
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error('❌ Stripe error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to create payment session',
          details: errorText
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const session = await stripeResponse.json();

    console.log(`✅ Payment session created: ${session.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: session.id,
        url: session.url,
        plan: {
          id: plan.id,
          name: plan.name,
          price: plan.price
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Payment creation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});