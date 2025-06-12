import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Email del super administrador
const SUPER_ADMIN_EMAIL = 'the.genio27@gmail.com';

interface SyncPlanRequest {
  planId: string;
  adminId: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Sync Plan with Stripe function called');

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
    const { planId, adminId }: SyncPlanRequest = await req.json();

    if (!planId) {
      return new Response(
        JSON.stringify({ 
          error: 'planId es requerido',
          code: 'MISSING_PLAN_ID'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔄 Syncing plan with Stripe: ${planId}`);

    // Step 1: Get plan data
    const { data: planData, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !planData) {
      return new Response(
        JSON.stringify({ 
          error: `Plan con ID ${planId} no encontrado`,
          code: 'PLAN_NOT_FOUND'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (planData.is_free) {
      return new Response(
        JSON.stringify({ 
          error: 'Los planes gratuitos no requieren sincronización con Stripe',
          code: 'FREE_PLAN_NO_SYNC'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 2: Get Stripe configuration
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

    // Step 3: Create or update product in Stripe
    let stripeProductId = planData.stripe_product_id;
    
    if (!stripeProductId) {
      // Create new product
      const productResponse = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeConfig.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          name: planData.name,
          description: planData.description,
          'metadata[plan_id]': planData.id,
          'metadata[plan_level]': planData.level.toString(),
        }),
      });

      if (!productResponse.ok) {
        const errorText = await productResponse.text();
        console.error('Stripe product creation error:', errorText);
        return new Response(
          JSON.stringify({ 
            error: 'Error al crear producto en Stripe',
            code: 'STRIPE_PRODUCT_ERROR',
            details: errorText
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const product = await productResponse.json();
      stripeProductId = product.id;

      // Save product to database
      await supabaseAdmin
        .from('stripe_products')
        .upsert({
          id: product.id,
          name: product.name,
          description: product.description || '',
          is_active: product.active,
          metadata: product.metadata || {},
        });
    }

    // Step 4: Create or update price in Stripe
    let stripePriceId = planData.stripe_price_id;

    if (!stripePriceId) {
      // Create new price
      const priceResponse = await fetch('https://api.stripe.com/v1/prices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeConfig.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          product: stripeProductId,
          unit_amount: Math.round(planData.price * 100).toString(),
          currency: planData.currency || 'usd',
          'recurring[interval]': planData.interval || 'month',
          'metadata[plan_id]': planData.id,
        }),
      });

      if (!priceResponse.ok) {
        const errorText = await priceResponse.text();
        console.error('Stripe price creation error:', errorText);
        return new Response(
          JSON.stringify({ 
            error: 'Error al crear precio en Stripe',
            code: 'STRIPE_PRICE_ERROR',
            details: errorText
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const price = await priceResponse.json();
      stripePriceId = price.id;

      // Save price to database
      await supabaseAdmin
        .from('stripe_prices')
        .upsert({
          id: price.id,
          product_id: stripeProductId,
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval,
          interval_count: price.recurring?.interval_count,
          is_active: price.active,
          metadata: price.metadata || {},
        });
    }

    // Step 5: Update plan with Stripe IDs
    const { data: updatedPlan, error: updateError } = await supabaseAdmin
      .from('plans')
      .update({
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating plan with Stripe IDs:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Error al actualizar plan con IDs de Stripe',
          code: 'PLAN_UPDATE_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 6: Log the action
    const { error: logError } = await supabaseAdmin
      .from('system_logs')
      .insert({
        admin_id: adminId || user.id,
        action: 'sync_plan_with_stripe',
        object_type: 'plan',
        object_id: planId,
        details: {
          stripeProductId,
          stripePriceId,
          planName: planData.name,
          timestamp: new Date().toISOString()
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      });

    if (logError) {
      console.warn('Failed to log action, but continuing...');
    }

    console.log(`✅ Plan synced with Stripe successfully: ${planId}`);

    return new Response(
      JSON.stringify({
        success: true,
        plan: updatedPlan,
        stripeProductId,
        stripePriceId,
        message: `Plan ${planData.name} sincronizado con Stripe exitosamente`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Sync Plan with Stripe Error:', error);
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