import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Email del super administrador
const SUPER_ADMIN_EMAIL = 'the.genio27@gmail.com';

interface ValidateIntegrationRequest {
  planId: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Validate Stripe Integration function called');

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
    const { planId }: ValidateIntegrationRequest = await req.json();

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

    console.log(`🔄 Validating Stripe integration for plan: ${planId}`);

    // Step 1: Get plan data
    const { data: planData, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !planData) {
      return new Response(
        JSON.stringify({ 
          success: false,
          valid: false,
          error: `Plan con ID ${planId} no encontrado`,
          code: 'PLAN_NOT_FOUND'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Free plans don't need Stripe integration
    if (planData.is_free) {
      return new Response(
        JSON.stringify({
          success: true,
          valid: true,
          reason: 'Los planes gratuitos no requieren integración con Stripe',
          planName: planData.name
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 2: Check if plan has Stripe IDs
    if (!planData.stripe_product_id || !planData.stripe_price_id) {
      return new Response(
        JSON.stringify({
          success: true,
          valid: false,
          reason: 'El plan no tiene IDs de Stripe asociados',
          missing: {
            productId: !planData.stripe_product_id,
            priceId: !planData.stripe_price_id
          },
          planName: planData.name
        }),
        { 
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
          success: true,
          valid: false,
          reason: 'Stripe no está configurado',
          planName: planData.name
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const stripeConfig = stripeConfigs[0];

    // Step 4: Validate product exists in Stripe
    const productResponse = await fetch(`https://api.stripe.com/v1/products/${planData.stripe_product_id}`, {
      headers: {
        'Authorization': `Bearer ${stripeConfig.secret_key}`,
      }
    });

    if (!productResponse.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          valid: false,
          reason: 'El producto no existe en Stripe',
          details: 'Product ID no válido o producto eliminado',
          planName: planData.name
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 5: Validate price exists in Stripe
    const priceResponse = await fetch(`https://api.stripe.com/v1/prices/${planData.stripe_price_id}`, {
      headers: {
        'Authorization': `Bearer ${stripeConfig.secret_key}`,
      }
    });

    if (!priceResponse.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          valid: false,
          reason: 'El precio no existe en Stripe',
          details: 'Price ID no válido o precio eliminado',
          planName: planData.name
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 6: Validate price configuration matches plan
    const price = await priceResponse.json();
    const expectedAmount = Math.round(planData.price * 100);
    
    if (price.unit_amount !== expectedAmount) {
      return new Response(
        JSON.stringify({
          success: true,
          valid: false,
          reason: 'El precio en Stripe no coincide con el plan',
          details: `Esperado: ${expectedAmount}, Actual: ${price.unit_amount}`,
          planName: planData.name
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (price.currency !== (planData.currency || 'usd')) {
      return new Response(
        JSON.stringify({
          success: true,
          valid: false,
          reason: 'La moneda en Stripe no coincide con el plan',
          details: `Esperado: ${planData.currency || 'usd'}, Actual: ${price.currency}`,
          planName: planData.name
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (price.recurring?.interval !== (planData.interval || 'month')) {
      return new Response(
        JSON.stringify({
          success: true,
          valid: false,
          reason: 'El intervalo en Stripe no coincide con el plan',
          details: `Esperado: ${planData.interval || 'month'}, Actual: ${price.recurring?.interval}`,
          planName: planData.name
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Stripe integration validated successfully for plan: ${planId}`);

    return new Response(
      JSON.stringify({
        success: true,
        valid: true,
        reason: 'Integración con Stripe válida y correcta',
        planName: planData.name,
        stripeDetails: {
          productId: planData.stripe_product_id,
          priceId: planData.stripe_price_id,
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Validate Stripe Integration Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        valid: false,
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