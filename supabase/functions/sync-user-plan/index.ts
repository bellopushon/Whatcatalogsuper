import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Email del super administrador
const SUPER_ADMIN_EMAIL = 'the.genio27@gmail.com';

interface UpdatePlanRequest {
  userId: string;
  newPlanId: string;
  adminId: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Sync User Plan function called');

    // Verificar que tenemos las variables de entorno necesarias
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', { 
        hasUrl: !!supabaseUrl, 
        hasServiceKey: !!serviceRoleKey 
      });
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
      console.error('Auth verification failed:', authError);
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
    const { userId, newPlanId, adminId }: UpdatePlanRequest = await req.json();

    if (!userId || !newPlanId) {
      return new Response(
        JSON.stringify({ 
          error: 'userId y newPlanId son requeridos',
          code: 'MISSING_PARAMS'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔄 Updating user plan: ${userId} -> ${newPlanId}`);

    // Step 1: Verify the plan exists
    const { data: plans, error: planError } = await supabaseAdmin
      .rpc('get_plan_by_id', { plan_id: newPlanId });

    if (planError || !plans || plans.length === 0) {
      console.error('Plan verification failed:', planError);
      return new Response(
        JSON.stringify({ 
          error: `Plan con ID ${newPlanId} no encontrado`,
          code: 'PLAN_NOT_FOUND'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const planData = plans[0];

    // Step 2: Get current user data
    const { data: currentUser, error: userError } = await supabaseAdmin
      .rpc('get_user_by_id', { user_id: userId });

    if (userError || !currentUser || currentUser.length === 0) {
      console.error('User fetch failed:', userError);
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

    const userData = currentUser[0];
    const oldPlanId = userData.plan;

    // Step 3: Update user plan
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .rpc('update_user_plan', { 
        user_id: userId, 
        new_plan_id: newPlanId 
      });

    if (updateError) {
      console.error('Error updating user plan:', updateError);
      return new Response(
        JSON.stringify({ 
          error: updateError.message || 'Error al actualizar el plan del usuario',
          code: 'UPDATE_FAILED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 4: Log the action in system_logs
    const { error: logError } = await supabaseAdmin
      .rpc('insert_system_log', {
        admin_id: adminId || user.id,
        action: 'update_user_plan',
        object_type: 'user',
        object_id: userId,
        details: {
          oldPlanId,
          newPlanId,
          oldPlanName: oldPlanId,
          newPlanName: planData.name,
          timestamp: new Date().toISOString()
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      });

    if (logError) {
      console.warn('Failed to log action:', logError);
    }

    console.log(`✅ User plan updated successfully: ${userId} -> ${newPlanId}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: updatedUser[0],
        plan: planData,
        message: `Plan actualizado a ${planData.name}`,
        changes: {
          oldPlanId,
          newPlanId,
          planName: planData.name
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Sync User Plan Error:', error);
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