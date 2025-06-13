import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreatePortalSessionRequest {
  userId: string;
  returnUrl: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Creating Stripe Customer Portal session for development');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing environment variables');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Configuración del servidor incompleta. Faltan variables de entorno necesarias.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing authorization header');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Token de autorización requerido. Por favor, inicia sesión nuevamente.' 
        }),
        { 
          status: 401, 
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

    // Create client with user token for authentication
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication and get current user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Autenticación fallida. Por favor, inicia sesión nuevamente.' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify super admin privileges
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single();

    if (adminError) {
      console.error('❌ Error verifying admin user:', adminError.message);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Error al verificar permisos de administrador. Inténtalo de nuevo.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!adminUser || adminUser.email !== 'the.genio27@gmail.com') {
      console.error('❌ Unauthorized access attempt by:', adminUser?.email || 'unknown');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Acceso no autorizado. Se requieren permisos de super administrador.' 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let requestData: CreatePortalSessionRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      console.error('❌ Error parsing request body:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Datos de solicitud inválidos. Verifica el formato de la petición.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { userId, returnUrl } = requestData;

    if (!userId || !returnUrl) {
      console.error('❌ Missing required parameters:', { userId: !!userId, returnUrl: !!returnUrl });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Parámetros requeridos faltantes: userId y returnUrl son obligatorios.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📋 Creating portal session for user: ${userId} by admin: ${user.id}`);

    // 1. Get target user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ Error fetching user data:', userError.message);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Error al obtener datos del usuario. Verifica que el usuario existe.' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!userData) {
      console.error('❌ User not found:', userId);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Usuario no encontrado en la base de datos.' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 2. Get Stripe configuration
    const { data: stripeConfigs, error: configError } = await supabaseAdmin
      .from('stripe_config')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (configError) {
      console.error('❌ Error fetching Stripe config:', configError.message);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Error al obtener la configuración de Stripe. Contacta al administrador del sistema.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!stripeConfigs || stripeConfigs.length === 0) {
      console.error('❌ No active Stripe configuration found');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Stripe no está configurado. Contacta al administrador para configurar la integración de pagos.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const stripeConfig = stripeConfigs[0];

    if (!stripeConfig.secret_key) {
      console.error('❌ Stripe secret key not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Clave secreta de Stripe no configurada. Contacta al administrador.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 3. Ensure user has a Stripe customer ID
    let stripeCustomerId = userData.stripe_customer_id;

    if (!stripeCustomerId) {
      try {
        // Try to find existing customer by email
        const customerSearchResponse = await fetch(
          `https://api.stripe.com/v1/customers/search?query=email:'${userData.email}'`,
          {
            headers: {
              'Authorization': `Bearer ${stripeConfig.secret_key}`,
            }
          }
        );

        if (customerSearchResponse.ok) {
          const customerSearch = await customerSearchResponse.json();
          if (customerSearch.data && customerSearch.data.length > 0) {
            stripeCustomerId = customerSearch.data[0].id;
            
            // Update user with found customer ID
            await supabaseAdmin
              .from('users')
              .update({ stripe_customer_id: stripeCustomerId })
              .eq('id', userId);
            
            console.log(`✅ Found existing Stripe customer: ${stripeCustomerId}`);
          }
        } else {
          const errorText = await customerSearchResponse.text();
          console.error('❌ Error searching Stripe customers:', errorText);
        }

        // Create customer if not found
        if (!stripeCustomerId) {
          const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeConfig.secret_key}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              email: userData.email,
              name: userData.name,
              'metadata[user_id]': userData.id,
              'metadata[environment]': 'development'
            })
          });

          if (customerResponse.ok) {
            const customer = await customerResponse.json();
            stripeCustomerId = customer.id;

            // Update user with customer ID
            await supabaseAdmin
              .from('users')
              .update({ stripe_customer_id: stripeCustomerId })
              .eq('id', userId);
            
            console.log(`✅ Created new Stripe customer: ${stripeCustomerId}`);
          } else {
            const errorText = await customerResponse.text();
            console.error('❌ Error creating Stripe customer:', errorText);
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'Error al crear cliente en Stripe. Verifica la configuración de Stripe y los datos del usuario.' 
              }),
              { 
                status: 500, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
        }
      } catch (stripeError) {
        console.error('❌ Error during Stripe customer operations:', stripeError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Error de conexión con Stripe. Verifica la conectividad de red y la configuración de Stripe.' 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    if (!stripeCustomerId) {
      console.error('❌ Failed to obtain Stripe customer ID');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No se pudo crear o encontrar el cliente de Stripe. Verifica los datos del usuario y la configuración de Stripe.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 4. Create Customer Portal session with enhanced configuration for development
    try {
      const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeConfig.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          customer: stripeCustomerId,
          return_url: returnUrl,
          // Enable all features for development testing
          'configuration[business_profile][headline]': 'Gestiona tu suscripción de Tutaviendo',
          'configuration[business_profile][privacy_policy_url]': returnUrl.split('/').slice(0, 3).join('/') + '/privacy',
          'configuration[business_profile][terms_of_service_url]': returnUrl.split('/').slice(0, 3).join('/') + '/terms',
          'configuration[features][payment_method_update][enabled]': 'true',
          'configuration[features][invoice_history][enabled]': 'true',
          'configuration[features][customer_update][enabled]': 'true',
          'configuration[features][customer_update][allowed_updates][]': 'email',
          'configuration[features][customer_update][allowed_updates][]': 'name',
          'configuration[features][customer_update][allowed_updates][]': 'address',
          'configuration[features][customer_update][allowed_updates][]': 'phone',
          'configuration[features][subscription_cancel][enabled]': 'true',
          'configuration[features][subscription_cancel][mode]': 'at_period_end',
          'configuration[features][subscription_cancel][proration_behavior]': 'none',
          'configuration[features][subscription_pause][enabled]': 'false',
          'configuration[features][subscription_update][enabled]': 'true',
          'configuration[features][subscription_update][default_allowed_updates][]': 'price',
          'configuration[features][subscription_update][proration_behavior]': 'create_prorations'
        })
      });

      if (!portalResponse.ok) {
        const errorText = await portalResponse.text();
        console.error('❌ Stripe portal error (enhanced):', errorText);
        
        // Fallback to basic portal session if advanced configuration fails
        console.log('🔄 Attempting basic portal session as fallback...');
        const basicPortalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeConfig.secret_key}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            customer: stripeCustomerId,
            return_url: returnUrl
          })
        });

        if (!basicPortalResponse.ok) {
          const basicErrorText = await basicPortalResponse.text();
          console.error('❌ Basic Stripe portal error:', basicErrorText);
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Error al crear sesión del portal de Stripe. Verifica que el cliente tiene una suscripción activa o historial de pagos.'
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const basicSession = await basicPortalResponse.json();
        console.log(`✅ Basic portal session created: ${basicSession.id}`);

        // Log portal access with correct admin_id
        await supabaseAdmin
          .from('system_logs')
          .insert({
            admin_id: user.id,
            action: 'stripe_portal_access',
            object_type: 'subscription',
            object_id: stripeCustomerId,
            details: {
              target_user_id: userId,
              session_id: basicSession.id,
              environment: 'development',
              mode: 'basic',
              timestamp: new Date().toISOString()
            }
          });

        return new Response(
          JSON.stringify({
            success: true,
            url: basicSession.url,
            sessionId: basicSession.id,
            mode: 'basic'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const session = await portalResponse.json();
      console.log(`✅ Enhanced portal session created: ${session.id}`);

      // 5. Log portal access for development tracking with correct admin_id
      await supabaseAdmin
        .from('system_logs')
        .insert({
          admin_id: user.id,
          action: 'stripe_portal_access',
          object_type: 'subscription',
          object_id: stripeCustomerId,
          details: {
            target_user_id: userId,
            session_id: session.id,
            environment: 'development',
            mode: 'enhanced',
            timestamp: new Date().toISOString()
          }
        });

      return new Response(
        JSON.stringify({
          success: true,
          url: session.url,
          sessionId: session.id,
          mode: 'enhanced',
          message: 'Portal de desarrollo configurado con todas las funcionalidades habilitadas'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (portalError) {
      console.error('❌ Error during portal session creation:', portalError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Error de conexión al crear la sesión del portal de Stripe. Verifica la conectividad de red.'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('❌ Unexpected error in portal creation:', error);
    
    // Ensure we always return a meaningful error message
    let errorMessage = 'Error interno del servidor al crear la sesión del portal';
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = 'Error de conexión de red. Verifica tu conectividad a internet.';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Error al procesar datos. Verifica el formato de la solicitud.';
      } else if (error.message.includes('auth')) {
        errorMessage = 'Error de autenticación. Por favor, inicia sesión nuevamente.';
      } else if (error.message) {
        errorMessage = `Error del sistema: ${error.message}`;
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});