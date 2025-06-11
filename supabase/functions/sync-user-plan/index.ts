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
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': serviceRoleKey,
      }
    });

    if (!userResponse.ok) {
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

    const user = await userResponse.json();
    
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
    const planResponse = await fetch(
      `${supabaseUrl}/rest/v1/plans?select=*&id=eq.${newPlanId}`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!planResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Error al verificar el plan',
          code: 'PLAN_VERIFICATION_FAILED'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const plans = await planResponse.json();
    if (!plans || plans.length === 0) {
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

    const plan = plans[0];

    // Step 2: Get current user data
    const userDataResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?select=*&id=eq.${userId}`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!userDataResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Error al obtener datos del usuario',
          code: 'USER_FETCH_FAILED'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const users = await userDataResponse.json();
    if (!users || users.length === 0) {
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

    const currentUser = users[0];
    const oldPlanId = currentUser.plan;

    // Step 3: Update user plan in database
const updateResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey': serviceRoleKey,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    plan: newPlanId,
    updated_at: new Date().toISOString()
  })
});

    if (!updateResponse.ok) {
      const updateError = await updateResponse.json();
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

    const updatedUser = await updateResponse.json();

    // Step 4: Log the action in system_logs
    const logResponse = await fetch(`${supabaseUrl}/rest/v1/system_logs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        admin_id: adminId || user.id,
        action: 'update_user_plan',
        object_type: 'user',
        object_id: userId,
        details: {
          oldPlanId,
          newPlanId,
          oldPlanName: 'Unknown', // We could fetch this if needed
          newPlanName: plan.name,
          timestamp: new Date().toISOString()
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      })
    });

    if (!logResponse.ok) {
      console.warn('Failed to log action, but continuing...');
    }

    console.log(`✅ User plan updated successfully: ${userId} -> ${newPlanId}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: Array.isArray(updatedUser) ? updatedUser[0] : updatedUser,
        plan: plan,
        message: `Plan actualizado a ${plan.name}`,
        changes: {
          oldPlanId,
          newPlanId,
          planName: plan.name
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