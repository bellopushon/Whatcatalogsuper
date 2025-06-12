import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Email del super administrador
const SUPER_ADMIN_EMAIL = 'the.genio27@gmail.com';

interface FixUserRequest {
  userId: string;
  adminId?: string;
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
    console.log('🔄 Fix User Stripe Customer function called');

    // Verificar que tenemos las variables de entorno necesarias
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Configuración del servidor incompleta',
          code: 'MISSING_ENV_VARS'
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

    // Verify super admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ 
          error: 'Token de autorización requerido',
          code: 'NO_AUTH_TOKEN'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Token de autenticación inválido',
          code: 'INVALID_TOKEN'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (user.email !== SUPER_ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ 
          error: 'Acceso denegado: Se requieren privilegios de super administrador',
          code: 'UNAUTHORIZED'
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const { userId, adminId }: FixUserRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: 'userId es requerido',
          code: 'MISSING_USER_ID'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔄 Fixing Stripe customer for user: ${userId}`);

    // Step 1: Get user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ 
          error: `Usuario con ID ${userId} no encontrado`,
          code: 'USER_NOT_FOUND'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 2: Get plan data
    const { data: planData, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', userData.plan)
      .single();

    if (planError || !planData) {
      return new Response(
        JSON.stringify({ 
          error: `Plan con ID ${userData.plan} no encontrado`,
          code: 'PLAN_NOT_FOUND'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 3: Get Stripe configuration
    const { data: stripeConfigs, error: configError } = await supabaseAdmin
      .from('stripe_config')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (configError || !stripeConfigs || stripeConfigs.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Stripe no está configurado',
          code: 'STRIPE_NOT_CONFIGURED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const stripeConfig = stripeConfigs[0];

    let stripeCustomerId = userData.stripe_customer_id;
    let subscriptionId = userData.subscription_id;
    let updateData: any = {};

    // Step 4: Create or find Stripe customer if missing
    if (!stripeCustomerId) {
      console.log(`🔄 Creating Stripe customer for user: ${userData.email}`);

      // First, try to find existing customer by email
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
          console.log(`✅ Found existing Stripe customer: ${stripeCustomerId}`);
        }
      }

      // If no existing customer found, create new one
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
            'metadata[plan_id]': userData.plan
          })
        });

        if (!customerResponse.ok) {
          const errorText = await customerResponse.text();
          console.error('Stripe customer creation error:', errorText);
          return new Response(
            JSON.stringify({ 
              error: 'Error al crear cliente en Stripe',
              code: 'STRIPE_CUSTOMER_ERROR',
              details: errorText
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const customer = await customerResponse.json();
        stripeCustomerId = customer.id;
        console.log(`✅ Created new Stripe customer: ${stripeCustomerId}`);
      }

      updateData.stripe_customer_id = stripeCustomerId;
    }

    // Step 5: Create subscription if user has a paid plan but no subscription
    if (!subscriptionId && !planData.is_free && planData.stripe_price_id) {
      console.log(`🔄 Creating subscription for paid plan: ${planData.name}`);

      const subscriptionResponse = await fetch('https://api.stripe.com/v1/subscriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeConfig.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          customer: stripeCustomerId,
          'items[0][price]': planData.stripe_price_id,
          'metadata[user_id]': userData.id,
          'metadata[plan_id]': userData.plan,
          'payment_behavior': 'default_incomplete',
          'payment_settings[save_default_payment_method]': 'on_subscription',
          'expand[]': 'latest_invoice.payment_intent'
        })
      });

      if (subscriptionResponse.ok) {
        const subscription = await subscriptionResponse.json();
        subscriptionId = subscription.id;
        
        updateData.subscription_id = subscriptionId;
        // Map Stripe status to database enum value
        updateData.subscription_status = mapStripeStatusToDbStatus(subscription.status);
        updateData.subscription_start_date = new Date(subscription.current_period_start * 1000).toISOString();
        updateData.subscription_end_date = new Date(subscription.current_period_end * 1000).toISOString();
        
        console.log(`✅ Created subscription: ${subscriptionId} with status: ${subscription.status} -> ${updateData.subscription_status}`);
      } else {
        const errorText = await subscriptionResponse.text();
        console.warn('Could not create subscription:', errorText);
        // Don't fail the entire operation if subscription creation fails
      }
    }

    // Step 6: Update user with Stripe information
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user:', updateError);
        return new Response(
          JSON.stringify({ 
            error: 'Error al actualizar usuario',
            code: 'USER_UPDATE_ERROR',
            details: updateError.message
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Step 7: Log the action
      const { error: logError } = await supabaseAdmin
        .from('system_logs')
        .insert({
          admin_id: adminId || user.id,
          action: 'fix_user_stripe_customer',
          object_type: 'user',
          object_id: userId,
          details: {
            stripeCustomerId,
            subscriptionId,
            planName: planData.name,
            updateData,
            timestamp: new Date().toISOString()
          },
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        });

      if (logError) {
        console.warn('Failed to log action, but continuing...');
      }

      console.log(`✅ User Stripe customer fixed successfully: ${userId}`);

      return new Response(
        JSON.stringify({
          success: true,
          user: updatedUser,
          changes: updateData,
          message: `Usuario ${userData.email} corregido exitosamente`,
          stripeCustomerId,
          subscriptionId
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'El usuario ya tiene toda la información de Stripe necesaria',
          stripeCustomerId: userData.stripe_customer_id,
          subscriptionId: userData.subscription_id
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Fix User Stripe Customer Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR',
        details: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});