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
    console.log('🔄 Fetching available plans');

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

    // Get all active plans ordered by level
    const planResponse = await fetch(
      `${supabaseUrl}/rest/v1/plans?select=*&is_active=eq.true&order=level.asc`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      }
    );

    if (!planResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to fetch plans' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const plans = await planResponse.json();

    // Transform plans for frontend consumption
    const transformedPlans = plans.map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: parseFloat(plan.price) || 0,
      maxStores: plan.max_stores,
      maxProducts: plan.max_products,
      maxCategories: plan.max_categories,
      features: plan.features || [],
      isActive: plan.is_active,
      isFree: plan.is_free,
      level: plan.level,
      // Add display properties
      popular: plan.level === 2, // Mark middle tier as popular
      recommended: plan.level === 3, // Mark highest tier as recommended
      priceDisplay: plan.is_free ? 'Gratis' : `$${parseFloat(plan.price).toFixed(2)}`,
      interval: plan.is_free ? '' : '/mes'
    }));

    console.log(`✅ Fetched ${transformedPlans.length} active plans`);

    return new Response(
      JSON.stringify({
        success: true,
        plans: transformedPlans,
        count: transformedPlans.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error fetching plans:', error);
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