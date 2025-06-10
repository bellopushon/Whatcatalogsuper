const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreatePaymentRequest {
  planId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Creating Stripe payment session');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { planId, userId, successUrl, cancelUrl }: CreatePaymentRequest = await req.json();

    // Get Stripe configuration
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
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const configs = await configResponse.json();
    if (configs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeConfig = configs[0];

    // Get plan details
    const planResponse = await fetch(
      `${supabaseUrl}/rest/v1/plans?select=*&id=eq.${planId}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      }
    );

    if (!planResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plans = await planResponse.json();
    if (plans.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plan = plans[0];

    // Get user details
    const userResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?select=*&id=eq.${userId}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      }
    );

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const users = await userResponse.json();
    if (users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = users[0];

    // Create Stripe checkout session
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'customer_email': user.email,
        'success_url': successUrl,
        'cancel_url': cancelUrl,
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': plan.name,
        'line_items[0][price_data][product_data][description]': plan.description,
        'line_items[0][price_data][unit_amount]': (plan.price * 100).toString(),
        'line_items[0][price_data][recurring][interval]': 'month',
        'line_items[0][quantity]': '1',
        'metadata[user_id]': userId,
        'metadata[plan_id]': planId,
        'metadata[plan_name]': plan.name
      })
    });

    if (!stripeResponse.ok) {
      const error = await stripeResponse.text();
      console.error('Stripe error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create payment session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const session = await stripeResponse.json();

    console.log('✅ Payment session created:', session.id);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: session.id,
        url: session.url
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Payment creation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});