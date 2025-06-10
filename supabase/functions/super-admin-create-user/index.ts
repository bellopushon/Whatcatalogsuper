const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Email del super administrador
const SUPER_ADMIN_EMAIL = 'the.genio27@gmail.com';

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  company?: string;
  location?: string;
  plan: string;
  isActive: boolean;
  adminId: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Create User function called');

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
    const userData: CreateUserRequest = await req.json();

    // Validate required fields
    if (!userData.name || !userData.email || !userData.password || !userData.plan) {
      return new Response(
        JSON.stringify({ 
          error: 'Campos requeridos: name, email, password, plan',
          code: 'MISSING_REQUIRED_FIELDS'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate email format
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

    // Validate password length
    if (userData.password.length < 6) {
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

    console.log(`🔄 Creating user: ${userData.email}`);

    // Step 1: Verify the plan exists
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

    // Step 2: Check if email already exists
    const existingUserResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id&email=eq.${userData.email}`,
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

    // Step 3: Create user in Supabase Auth
    const authCreateResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name
        }
      })
    });

    if (!authCreateResponse.ok) {
      const authError = await authCreateResponse.json();
      console.error('Error creating user in Auth:', authError);
      return new Response(
        JSON.stringify({ 
          error: authError.message || 'Error al crear usuario en autenticación',
          code: 'AUTH_CREATE_FAILED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const authData = await authCreateResponse.json();
    const userId = authData.id;

    // Step 4: Create user record in users table
    const dbCreateResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: userId,
        email: userData.email,
        name: userData.name,
        phone: userData.phone || null,
        company: userData.company || null,
        location: userData.location || null,
        plan: userData.plan,
        is_active: userData.isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    if (!dbCreateResponse.ok) {
      // If database insert fails, delete the auth user
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      });

      const dbError = await dbCreateResponse.json();
      console.error('Error creating user in database:', dbError);
      return new Response(
        JSON.stringify({ 
          error: dbError.message || 'Error al crear usuario en base de datos',
          code: 'DB_CREATE_FAILED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const newUser = await dbCreateResponse.json();
    const createdUser = Array.isArray(newUser) ? newUser[0] : newUser;

    // Step 5: Log the action in system_logs
    const logResponse = await fetch(`${supabaseUrl}/rest/v1/system_logs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        admin_id: userData.adminId || user.id,
        action: 'create_user',
        object_type: 'user',
        object_id: userId,
        details: {
          email: userData.email,
          name: userData.name,
          plan: userData.plan,
          isActive: userData.isActive,
          timestamp: new Date().toISOString()
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      })
    });

    if (!logResponse.ok) {
      console.warn('Failed to log action, but continuing...');
    }

    console.log(`✅ User created successfully: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          phone: createdUser.phone,
          company: createdUser.company,
          location: createdUser.location,
          plan: createdUser.plan,
          isActive: createdUser.is_active,
          isSuperAdmin: createdUser.email === SUPER_ADMIN_EMAIL,
          createdAt: createdUser.created_at,
          updatedAt: createdUser.updated_at
        },
        message: 'Usuario creado exitosamente'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Create User Error:', error);
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