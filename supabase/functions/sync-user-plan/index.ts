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
    const { data: planData, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', newPlanId)
      .single();

    if (planError || !planData) {
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

    // Step 2: Get current user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
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

    const oldPlanId = userData.plan;

    // Step 3: Map plan name to enum value
    // The users.plan column expects enum values: 'gratuito', 'emprendedor', 'profesional'
    let planEnumValue: string;
    
    // Map plan names to enum values based on common naming patterns
    const planName = planData.name.toLowerCase();
    if (planName.includes('gratuito') || planName.includes('free') || planName.includes('básico')) {
      planEnumValue = 'gratuito';
    } else if (planName.includes('emprendedor') || planName.includes('entrepreneur') || planName.includes('starter')) {
      planEnumValue = 'emprendedor';
    } else if (planName.includes('profesional') || planName.includes('professional') || planName.includes('pro')) {
      planEnumValue = 'profesional';
    } else {
      // Default fallback - you might want to adjust this logic based on your specific plan structure
      planEnumValue = 'gratuito';
    }

    // Step 4: Update user plan with the correct enum value
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ plan: planEnumValue })
      .eq('id', userId)
      .select()
      .single();

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

    // Step 5: Log the action in system_logs
    const { error: logError } = await supabaseAdmin
      .from('system_logs')
      .insert({
        admin_id: adminId || user.id,
        action: 'update_user_plan',
        object_type: 'user',
        object_id: userId,
        details: {
          oldPlanId,
          newPlanId,
          oldPlanName: oldPlanId,
          newPlanName: planData.name,
          planEnumValue,
          timestamp: new Date().toISOString()
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      });

    if (logError) {
      console.warn('Failed to log action:', logError);
    }

    console.log(`✅ User plan updated successfully: ${userId} -> ${newPlanId} (${planEnumValue})`);

    return new Response(
      JSON.stringify({
        success: true,
        user: updatedUser,
        plan: planData,
        message: `Plan actualizado a ${planData.name}`,
        changes: {
          oldPlanId,
          newPlanId,
          planName: planData.name,
          planEnumValue
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