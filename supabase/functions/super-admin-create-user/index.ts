import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
    const { data: plans, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', userData.plan)
      .single();

    if (planError || !plans) {
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
    const { data: existingUsers, error: existingError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', userData.email);

    if (!existingError && existingUsers && existingUsers.length > 0) {
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

    // Step 3: Create user in Supabase Auth
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        name: userData.name
      }
    });

    if (authCreateError) {
      console.error('Error creating user in Auth:', authCreateError);
      return new Response(
        JSON.stringify({ 
          error: authCreateError.message || 'Error al crear usuario en autenticación',
          code: 'AUTH_CREATE_FAILED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const userId = authData.user.id;

    // Step 4: Create user record in users table
    const { data: newUser, error: dbCreateError } = await supabaseAdmin
      .from('users')
      .insert({
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
      .select()
      .single();

    if (dbCreateError) {
      // If database insert fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);

      console.error('Error creating user in database:', dbCreateError);
      return new Response(
        JSON.stringify({ 
          error: dbCreateError.message || 'Error al crear usuario en base de datos',
          code: 'DB_CREATE_FAILED'
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
      });

    if (logError) {
      console.warn('Failed to log action, but continuing...');
    }

    console.log(`✅ User created successfully: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          phone: newUser.phone,
          company: newUser.company,
          location: newUser.location,
          plan: newUser.plan,
          isActive: newUser.is_active,
          isSuperAdmin: newUser.email === SUPER_ADMIN_EMAIL,
          createdAt: newUser.created_at,
          updatedAt: newUser.updated_at
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