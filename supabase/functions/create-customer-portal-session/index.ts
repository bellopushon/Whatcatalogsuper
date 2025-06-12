import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreatePortalSessionRequest {
  userId: string;
  returnUrl: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Creating Stripe Customer Portal session');

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

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { userId, returnUrl }: CreatePortalSessionRequest = await req.json();

    console.log(`📋 Creating portal session for user: ${userId}`);

    // 1. Get user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Usuario no encontrado' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 2. Get Stripe configuration
    const { data: stripeConfigs, error: configError } = await supabaseAdmin
      .from('stripe_config')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (configError || !stripeConfigs || stripeConfigs.length === 0) {
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

    const stripeConfig = stripeConfigs[0];

    // 3. Ensure user has a Stripe customer ID
    let stripeCustomerId = userData.stripe_customer_id;

    if (!stripeCustomerId) {
      // Try to find existing customer by email
      const customerSearchResponse = await fetch(
        `https://api.stripe.com/v1/customers/search?query=email:'${userData.email}'`,
        {
          headers: {
            'Authorization': `Bearer ${stripeConfig.secret_key}`,
          }
        }
      );

      if (customerSearchResponse.ok) {
        const customerSearch = await customerSearchResponse.json();
        if (customerSearch.data && customerSearch.data.length > 0) {
          stripeCustomerId = customerSearch.data[0].id;
        }
      }

      // Create customer if not found
      if (!stripeCustomerId) {
        const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeConfig.secret_key}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            email: userData.email,
            name: userData.name,
            'metadata[user_id]': userData.id
          })
        });

        if (customerResponse.ok) {
          const customer = await customerResponse.json();
          stripeCustomerId = customer.id;

          // Update user with customer ID
          await supabaseAdmin
            .from('users')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', userId);
        }
      }
    }

    if (!stripeCustomerId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No se pudo crear o encontrar el cliente de Stripe' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 4. Create Customer Portal session
    const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        customer: stripeCustomerId,
        return_url: returnUrl
      })
    });

    if (!portalResponse.ok) {
      const errorText = await portalResponse.text();
      console.error('Stripe portal error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Error al crear sesión del portal de Stripe',
          details: errorText
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const session = await portalResponse.json();

    console.log(`✅ Portal session created: ${session.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        url: session.url,
        sessionId: session.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Portal creation error:', error);
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