import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Getting user invoices');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Server configuration error' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user ID from URL params
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const limit = url.searchParams.get('limit') || '10';

    if (!userId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'userId parameter is required' 
        }),
        { 
          status: 400, 
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

    // Get user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Usuario no encontrado' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!userData.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          success: true,
          invoices: [],
          hasMore: false,
          message: 'Usuario no tiene cliente de Stripe asociado'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get Stripe configuration
    const { data: stripeConfigs, error: configError } = await supabaseAdmin
      .from('stripe_config')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (configError || !stripeConfigs || stripeConfigs.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Stripe not configured' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const stripeConfig = stripeConfigs[0];

    // Get invoices from Stripe
    const invoicesResponse = await fetch(
      `https://api.stripe.com/v1/invoices?customer=${userData.stripe_customer_id}&limit=${limit}&expand[]=data.payment_intent`,
      {
        headers: {
          'Authorization': `Bearer ${stripeConfig.secret_key}`,
        }
      }
    );

    if (!invoicesResponse.ok) {
      const errorText = await invoicesResponse.text();
      console.error('Stripe invoices error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Error al obtener facturas de Stripe',
          details: errorText
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const invoicesData = await invoicesResponse.json();

    // Transform invoices for frontend
    const invoices = invoicesData.data.map((invoice: any) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      date: new Date(invoice.created * 1000).toISOString(),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
      description: invoice.description || 'Suscripción',
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      paymentIntent: invoice.payment_intent ? {
        id: invoice.payment_intent.id,
        status: invoice.payment_intent.status,
        paymentMethod: invoice.payment_intent.payment_method
      } : null,
      subscription: invoice.subscription,
      lines: invoice.lines.data.map((line: any) => ({
        description: line.description,
        amount: line.amount,
        quantity: line.quantity,
        period: line.period ? {
          start: new Date(line.period.start * 1000).toISOString(),
          end: new Date(line.period.end * 1000).toISOString()
        } : null
      }))
    }));

    console.log(`✅ Retrieved ${invoices.length} invoices for user: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        invoices,
        hasMore: invoicesData.has_more,
        totalCount: invoicesData.data.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error getting invoices:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});