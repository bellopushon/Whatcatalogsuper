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
    console.log('🔄 Creating Stripe Customer Portal session for development');

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
          
          // Update user with found customer ID
          await supabaseAdmin
            .from('users')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', userId);
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
            'metadata[user_id]': userData.id,
            'metadata[environment]': 'development'
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

    // 4. Create Customer Portal session with enhanced configuration for development
    const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        customer: stripeCustomerId,
        return_url: returnUrl,
        // Enable all features for development testing
        'configuration[business_profile][headline]': 'Gestiona tu suscripción de Tutaviendo',
        'configuration[business_profile][privacy_policy_url]': returnUrl.split('/').slice(0, 3).join('/') + '/privacy',
        'configuration[business_profile][terms_of_service_url]': returnUrl.split('/').slice(0, 3).join('/') + '/terms',
        'configuration[features][payment_method_update][enabled]': 'true',
        'configuration[features][invoice_history][enabled]': 'true',
        'configuration[features][customer_update][enabled]': 'true',
        'configuration[features][customer_update][allowed_updates][]': 'email',
        'configuration[features][customer_update][allowed_updates][]': 'name',
        'configuration[features][customer_update][allowed_updates][]': 'address',
        'configuration[features][customer_update][allowed_updates][]': 'phone',
        'configuration[features][subscription_cancel][enabled]': 'true',
        'configuration[features][subscription_cancel][mode]': 'at_period_end',
        'configuration[features][subscription_cancel][proration_behavior]': 'none',
        'configuration[features][subscription_pause][enabled]': 'false',
        'configuration[features][subscription_update][enabled]': 'true',
        'configuration[features][subscription_update][default_allowed_updates][]': 'price',
        'configuration[features][subscription_update][proration_behavior]': 'create_prorations'
      })
    });

    if (!portalResponse.ok) {
      const errorText = await portalResponse.text();
      console.error('Stripe portal error:', errorText);
      
      // Fallback to basic portal session if advanced configuration fails
      const basicPortalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
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

      if (!basicPortalResponse.ok) {
        const basicErrorText = await basicPortalResponse.text();
        console.error('Basic Stripe portal error:', basicErrorText);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Error al crear sesión del portal de Stripe',
            details: basicErrorText
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const basicSession = await basicPortalResponse.json();
      console.log(`✅ Basic portal session created: ${basicSession.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          url: basicSession.url,
          sessionId: basicSession.id,
          mode: 'basic'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const session = await portalResponse.json();

    console.log(`✅ Enhanced portal session created: ${session.id}`);

    // 5. Log portal access for development tracking
    await supabaseAdmin
      .from('system_logs')
      .insert({
        admin_id: userId,
        action: 'stripe_portal_access',
        object_type: 'subscription',
        object_id: stripeCustomerId,
        details: {
          session_id: session.id,
          environment: 'development',
          timestamp: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        url: session.url,
        sessionId: session.id,
        mode: 'enhanced',
        message: 'Portal de desarrollo configurado con todas las funcionalidades habilitadas'
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