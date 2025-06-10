const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Email del super administrador
const SUPER_ADMIN_EMAIL = 'the.genio27@gmail.com';

interface UpdateUserRequest {
  userId: string;
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  company?: string;
  location?: string;
  plan?: string;
  isActive?: boolean;
  adminId: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Update User function called');

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
    const userData: UpdateUserRequest = await req.json();

    // Validate required fields
    if (!userData.userId) {
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

    console.log(`🔄 Updating user: ${userData.userId}`);

    // Step 1: Get current user data
    const currentUserResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?select=*&id=eq.${userData.userId}`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!currentUserResponse.ok) {
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

    const users = await currentUserResponse.json();
    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: `Usuario con ID ${userData.userId} no encontrado`,
          code: 'USER_NOT_FOUND'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const currentUser = users[0];

    // Step 2: Validate email if being updated
    if (userData.email && userData.email !== currentUser.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        return new Response(
          JSON.stringify({ 
            error: 'Formato de email inválido',
            code: 'INVALID_EMAIL_FORMAT'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check if new email already exists
      const existingUserResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?select=id&email=eq.${userData.email}&id=neq.${userData.userId}`,
        {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (existingUserResponse.ok) {
        const existingUsers = await existingUserResponse.json();
        if (existingUsers && existingUsers.length > 0) {
          return new Response(
            JSON.stringify({ 
              error: 'Este email ya está registrado',
              code: 'EMAIL_ALREADY_EXISTS'
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
      }
    }

    // Step 3: Validate password if being updated
    if (userData.password && userData.password.length < 6) {
      return new Response(
        JSON.stringify({ 
          error: 'La contraseña debe tener al menos 6 caracteres',
          code: 'PASSWORD_TOO_SHORT'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 4: Validate plan if being updated
    if (userData.plan && userData.plan !== currentUser.plan) {
      const planResponse = await fetch(
        `${supabaseUrl}/rest/v1/plans?select=*&id=eq.${userData.plan}`,
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
            error: `Plan con ID ${userData.plan} no encontrado`,
            code: 'PLAN_NOT_FOUND'
          }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Step 5: Update user in Supabase Auth if email or password changed
    if (userData.email || userData.password) {
      const authUpdateData: any = {};
      if (userData.email) authUpdateData.email = userData.email;
      if (userData.password) authUpdateData.password = userData.password;

      const authUpdateResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userData.userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(authUpdateData)
      });

      if (!authUpdateResponse.ok) {
        const authError = await authUpdateResponse.json();
        console.error('Error updating user in Auth:', authError);
        return new Response(
          JSON.stringify({ 
            error: authError.message || 'Error al actualizar usuario en autenticación',
            code: 'AUTH_UPDATE_FAILED'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Step 6: Update user in database
    const dbUpdateData: any = {
      updated_at: new Date().toISOString()
    };

    if (userData.name !== undefined) dbUpdateData.name = userData.name;
    if (userData.email !== undefined) dbUpdateData.email = userData.email;
    if (userData.phone !== undefined) dbUpdateData.phone = userData.phone || null;
    if (userData.company !== undefined) dbUpdateData.company = userData.company || null;
    if (userData.location !== undefined) dbUpdateData.location = userData.location || null;
    if (userData.plan !== undefined) dbUpdateData.plan = userData.plan;
    if (userData.isActive !== undefined) dbUpdateData.is_active = userData.isActive;

    const dbUpdateResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userData.userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(dbUpdateData)
    });

    if (!dbUpdateResponse.ok) {
      const dbError = await dbUpdateResponse.json();
      console.error('Error updating user in database:', dbError);
      return new Response(
        JSON.stringify({ 
          error: dbError.message || 'Error al actualizar usuario en base de datos',
          code: 'DB_UPDATE_FAILED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const updatedUser = await dbUpdateResponse.json();
    const finalUser = Array.isArray(updatedUser) ? updatedUser[0] : updatedUser;

    // Step 7: Log the action in system_logs
    const logResponse = await fetch(`${supabaseUrl}/rest/v1/system_logs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        admin_id: userData.adminId || user.id,
        action: 'update_user',
        object_type: 'user',
        object_id: userData.userId,
        details: {
          changes: userData,
          timestamp: new Date().toISOString()
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      })
    });

    if (!logResponse.ok) {
      console.warn('Failed to log action, but continuing...');
    }

    console.log(`✅ User updated successfully: ${userData.userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: finalUser.id,
          email: finalUser.email,
          name: finalUser.name,
          phone: finalUser.phone,
          company: finalUser.company,
          location: finalUser.location,
          plan: finalUser.plan,
          isActive: finalUser.is_active,
          isSuperAdmin: finalUser.email === SUPER_ADMIN_EMAIL,
          createdAt: finalUser.created_at,
          updatedAt: finalUser.updated_at
        },
        message: 'Usuario actualizado exitosamente'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Update User Error:', error);
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