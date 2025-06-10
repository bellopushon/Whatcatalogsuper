const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Email del super administrador
const SUPER_ADMIN_EMAIL = 'the.genio27@gmail.com';

// Helper function to verify super admin
async function verifySuperAdmin(authHeader: string | null, supabaseUrl: string, serviceRoleKey: string) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Verify the JWT token
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': serviceRoleKey,
    }
  });

  if (!response.ok) {
    throw new Error('Invalid authentication token');
  }

  const user = await response.json();
  
  if (user.email !== SUPER_ADMIN_EMAIL) {
    throw new Error('Access denied: Super admin privileges required');
  }

  return user;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`🔄 Super Admin Users API called: ${req.method}`);

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

    // Verify super admin for all operations
    const authHeader = req.headers.get('Authorization');
    try {
      await verifySuperAdmin(authHeader, supabaseUrl, serviceRoleKey);
    } catch (error) {
      console.error('Super admin verification failed:', error.message);
      return new Response(
        JSON.stringify({ 
          error: error.message,
          code: 'UNAUTHORIZED'
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle GET request - fetch all users
    if (req.method === 'GET') {
      console.log('🔄 Fetching users with service role...');
      const response = await fetch(
        `${supabaseUrl}/rest/v1/users?select=*&order=created_at.desc`,
        {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching users:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Error al obtener usuarios de la base de datos',
            code: 'USERS_FETCH_FAILED',
            details: `HTTP ${response.status}: ${response.statusText}`,
            body: errorText
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const users = await response.json();
      console.log(`✅ Successfully fetched ${users?.length || 0} users via service role`);

      // Agregar información adicional a cada usuario
      const enrichedUsers = (users || []).map((user: any) => ({
        ...user,
        isSuperAdmin: user.email === SUPER_ADMIN_EMAIL,
        isActive: user.is_active ?? true,
        lastLoginAt: user.last_login_at || null
      }));

      return new Response(
        JSON.stringify({
          success: true,
          users: enrichedUsers,
          count: enrichedUsers.length,
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle POST request - create user
    if (req.method === 'POST') {
      const userData = await req.json();
      console.log('🔄 Creating new user:', userData.email);

      // Create user in Supabase Auth using service role
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
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

      if (!authResponse.ok) {
        const authError = await authResponse.json();
        console.error('Error creating user in Auth:', authError);
        return new Response(
          JSON.stringify({ 
            error: authError.message || 'Error creating user in authentication',
            code: 'AUTH_CREATE_FAILED'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const authData = await authResponse.json();
      const userId = authData.id;

      // Create record in users table
      const dbResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
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

      if (!dbResponse.ok) {
        // If database insert fails, delete the auth user
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
          }
        });

        const dbError = await dbResponse.json();
        console.error('Error creating user in database:', dbError);
        return new Response(
          JSON.stringify({ 
            error: dbError.message || 'Error creating user in database',
            code: 'DB_CREATE_FAILED'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const newUser = await dbResponse.json();
      console.log('✅ User created successfully:', userId);

      return new Response(
        JSON.stringify({
          success: true,
          user: Array.isArray(newUser) ? newUser[0] : newUser,
          message: 'Usuario creado exitosamente'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle PUT request - update user
    if (req.method === 'PUT') {
      const url = new URL(req.url);
      const userId = url.searchParams.get('id');
      
      if (!userId) {
        return new Response(
          JSON.stringify({ 
            error: 'User ID is required',
            code: 'MISSING_USER_ID'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const userData = await req.json();
      console.log('🔄 Updating user:', userId);

      const updateData: any = {
        name: userData.name,
        phone: userData.phone || null,
        company: userData.company || null,
        location: userData.location || null,
        plan: userData.plan,
        is_active: userData.isActive,
        updated_at: new Date().toISOString()
      };

      // Update email if changed
      if (userData.email) {
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: userData.email
          })
        });

        if (!authResponse.ok) {
          const authError = await authResponse.json();
          console.error('Error updating user email:', authError);
          return new Response(
            JSON.stringify({ 
              error: authError.message || 'Error updating user email',
              code: 'AUTH_UPDATE_FAILED'
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        updateData.email = userData.email;
      }

      // Update password if provided
      if (userData.password) {
        const passwordResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            password: userData.password
          })
        });

        if (!passwordResponse.ok) {
          const passwordError = await passwordResponse.json();
          console.error('Error updating user password:', passwordError);
          return new Response(
            JSON.stringify({ 
              error: passwordError.message || 'Error updating user password',
              code: 'PASSWORD_UPDATE_FAILED'
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
      }

      // Update in users table
      const dbResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      });

      if (!dbResponse.ok) {
        const dbError = await dbResponse.json();
        console.error('Error updating user in database:', dbError);
        return new Response(
          JSON.stringify({ 
            error: dbError.message || 'Error updating user in database',
            code: 'DB_UPDATE_FAILED'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const updatedUser = await dbResponse.json();
      console.log('✅ User updated successfully:', userId);

      return new Response(
        JSON.stringify({
          success: true,
          user: Array.isArray(updatedUser) ? updatedUser[0] : updatedUser,
          message: 'Usuario actualizado exitosamente'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle DELETE request - delete user
    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const userId = url.searchParams.get('id');
      
      if (!userId) {
        return new Response(
          JSON.stringify({ 
            error: 'User ID is required',
            code: 'MISSING_USER_ID'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('🔄 Deleting user:', userId);

      // Delete from Auth (this will cascade to users table)
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      });

      if (!authResponse.ok) {
        const authError = await authResponse.json();
        console.error('Error deleting user from Auth:', authError);
        return new Response(
          JSON.stringify({ 
            error: authError.message || 'Error deleting user from authentication',
            code: 'AUTH_DELETE_FAILED'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('✅ User deleted successfully:', userId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Usuario eliminado exitosamente'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Super Admin Users API Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR',
        details: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});