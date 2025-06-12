import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Email del super administrador
const SUPER_ADMIN_EMAIL = 'the.genio27@gmail.com';

interface AuthRequest {
  email: string;
  password: string;
  action: 'login' | 'verify';
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, action }: AuthRequest = await req.json();

    // Verificar que sea el email del super admin
    if (email !== SUPER_ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ 
          error: 'Acceso denegado. No tienes permisos de super administrador.',
          code: 'UNAUTHORIZED'
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get environment variables
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

    if (action === 'login') {
      // Intentar autenticación
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('Auth error:', authError);
        return new Response(
          JSON.stringify({ 
            error: authError.message,
            code: 'AUTH_FAILED'
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (!authData.user) {
        return new Response(
          JSON.stringify({ 
            error: 'No se pudo autenticar el usuario',
            code: 'AUTH_FAILED'
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Verificar/crear registro en la tabla users
      let { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userError && userError.code === 'PGRST116') {
        // Usuario no existe en la tabla, crearlo
        const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authData.user.id,
            email: authData.user.email,
            name: 'Super Administrador',
            plan: 'profesional',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating user:', createError);
          return new Response(
            JSON.stringify({ 
              error: 'Error al crear el usuario super admin',
              code: 'USER_CREATE_FAILED'
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        userData = newUser;
      } else if (userError) {
        console.error('Error fetching user:', userError);
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

      // Registrar login en logs del sistema
      await supabaseAdmin
        .from('system_logs')
        .insert({
          admin_id: authData.user.id,
          action: 'super_admin_login',
          object_type: 'auth',
          object_id: authData.user.id,
          details: { email, timestamp: new Date().toISOString() },
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        });

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: authData.user.id,
            email: authData.user.email,
            name: userData.name || 'Super Administrador',
            isSuperAdmin: true
          },
          session: authData.session
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } else if (action === 'verify') {
      // Verificar que el usuario actual es super admin
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
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

      const { data: { user }, error } = await supabaseAdmin.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (error || !user || user.email !== SUPER_ADMIN_EMAIL) {
        return new Response(
          JSON.stringify({ 
            error: 'Token inválido o usuario no autorizado',
            code: 'INVALID_TOKEN'
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: 'Super Administrador',
            isSuperAdmin: true
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'Acción no válida',
        code: 'INVALID_ACTION'
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Super Admin Auth Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});