import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Getting user subscription status');

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

    // Get user ID from URL params
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'userId parameter is required' 
        }),
        { 
          status: 400, 
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

    // Get user data with plan information
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        plan_details:plans!users_plan_fkey (
          id,
          name,
          description,
          price,
          currency,
          interval,
          is_free,
          level,
          max_stores,
          max_products,
          max_categories,
          features
        )
      `)
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

    // Get plan information from plans table if the FK didn't work
    let planData = userData.plan_details;
    if (!planData) {
      const { data: plan } = await supabaseAdmin
        .from('plans')
        .select('*')
        .eq('id', userData.plan)
        .single();
      planData = plan;
    }

    // Get Stripe configuration
    const { data: stripeConfigs } = await supabaseAdmin
      .from('stripe_config')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    const stripeConfig = stripeConfigs?.[0];

    // Get subscription details from Stripe if user has subscription
    let stripeSubscription = null;
    if (userData.subscription_id && stripeConfig) {
      try {
        const subscriptionResponse = await fetch(
          `https://api.stripe.com/v1/subscriptions/${userData.subscription_id}`,
          {
            headers: {
              'Authorization': `Bearer ${stripeConfig.secret_key}`,
            }
          }
        );

        if (subscriptionResponse.ok) {
          stripeSubscription = await subscriptionResponse.json();
        }
      } catch (error) {
        console.warn('Could not fetch Stripe subscription:', error);
      }
    }

    // Determine subscription status
    let subscriptionStatus = 'none';
    let nextBillingDate = null;
    let cancelAtPeriodEnd = false;

    if (planData?.is_free) {
      subscriptionStatus = 'free';
    } else if (stripeSubscription) {
      subscriptionStatus = stripeSubscription.status;
      nextBillingDate = new Date(stripeSubscription.current_period_end * 1000).toISOString();
      cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
    } else if (userData.subscription_status) {
      subscriptionStatus = userData.subscription_status;
    }

    console.log(`✅ Retrieved subscription status for user: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          isActive: userData.is_active
        },
        plan: planData ? {
          id: planData.id,
          name: planData.name,
          description: planData.description,
          price: planData.price,
          currency: planData.currency || 'usd',
          interval: planData.interval || 'month',
          isFree: planData.is_free,
          level: planData.level,
          limits: {
            maxStores: planData.max_stores,
            maxProducts: planData.max_products,
            maxCategories: planData.max_categories
          },
          features: planData.features || []
        } : null,
        subscription: {
          status: subscriptionStatus,
          stripeCustomerId: userData.stripe_customer_id,
          subscriptionId: userData.subscription_id,
          nextBillingDate,
          cancelAtPeriodEnd,
          hasStripeCustomer: !!userData.stripe_customer_id,
          canManageSubscription: !!userData.stripe_customer_id && !!stripeConfig
        },
        billing: {
          hasPaymentMethod: stripeSubscription?.default_payment_method ? true : false,
          lastPaymentStatus: stripeSubscription?.latest_invoice?.payment_intent?.status || null
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error getting subscription status:', error);
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