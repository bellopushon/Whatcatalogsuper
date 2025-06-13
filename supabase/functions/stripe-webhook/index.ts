import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import Stripe from "npm:stripe@14.21.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
Deno.serve(async (req)=>{
  try {
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
        status: 204
      });
    }
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey || !stripeWebhookSecret) {
      console.error("Missing required environment variables:", {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseServiceKey: !!supabaseServiceKey,
        hasStripeSecretKey: !!stripeSecretKey,
        hasStripeWebhookSecret: !!stripeWebhookSecret
      });
      throw new Error("Required environment variables are missing");
    }
    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16"
    });
    // Get the signature from the headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("No Stripe signature provided");
      return new Response(JSON.stringify({
        error: "No signature provided",
        message: "No se proporcionó firma de Stripe."
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Get the raw body
    const body = await req.text();
    console.log("Received webhook body:", body.substring(0, 200) + "...");
    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
      console.log("Webhook signature verified successfully");
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(JSON.stringify({
        error: `Webhook Error: ${err.message}`,
        message: "Error de verificación de webhook."
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log(`Processing webhook event: ${event.type}, id: ${event.id}`);
    // Store the webhook event in the database
    const { data: webhookData, error: webhookError } = await supabase.from("stripe_webhooks").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      data: event
    }).select().single();
    if (webhookError) {
      console.error("Error storing webhook:", webhookError);
    // Continue processing even if storing fails
    } else {
      console.log("Webhook stored in database with ID:", webhookData.id);
    }
    // Process the event based on its type
    let statusCode = 200;
    let responseBody = {
      received: true
    };
    switch(event.type){
      case "checkout.session.completed":
        {
          console.log("Processing checkout.session.completed event");
          const session = event.data.object;
          // Get the customer and subscription IDs
          const customerId = session.customer;
          const subscriptionId = session.subscription;
          // Get metadata from the session
          const userId = session.metadata?.userId;
          const planId = session.metadata?.planId;
          console.log("Session metadata:", {
            userId,
            planId,
            customerId,
            subscriptionId
          });
          if (userId && planId) {
            // Calculate subscription end date (30 days from now)
            const subscriptionEndDate = new Date();
            subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);
            // Get plan details
            const { data: planData, error: planError } = await supabase.from("plans").select("*").eq("id", planId).single();
            if (planError) {
              console.error("Error fetching plan:", planError);
            // Continue with default values
            } else {
              console.log("Found plan:", planData);
            }
            // Update user in database
            const { error: updateError } = await supabase.from("users").update({
              plan: planId,
              subscription_id: subscriptionId,
              subscription_status: "active",
              subscription_start_date: new Date().toISOString(),
              subscription_end_date: subscriptionEndDate.toISOString(),
              stripe_customer_id: customerId,
              payment_method: "stripe",
              updated_at: new Date().toISOString()
            }).eq("id", userId);
            if (updateError) {
              console.error("Error updating user:", updateError);
              statusCode = 500;
              responseBody = {
                error: "Error updating user",
                details: updateError
              };
            } else {
              console.log("User updated successfully with plan:", planId);
              // Record the transaction
              const { error: transactionError } = await supabase.from("stripe_transactions").insert({
                id: `txn_${subscriptionId}`,
                user_id: userId,
                customer_id: customerId,
                amount: session.amount_total || 0,
                currency: session.currency || "usd",
                status: "succeeded",
                payment_method: "stripe",
                subscription_id: subscriptionId,
                metadata: {
                  plan_id: planId,
                  session_id: session.id
                }
              });
              if (transactionError) {
                console.error("Error recording transaction:", transactionError);
              // Continue anyway as user update was successful
              } else {
                console.log("Transaction recorded successfully");
              }
            }
          } else {
            console.error("Missing userId or planId in session metadata");
            statusCode = 400;
            responseBody = {
              error: "Missing userId or planId in session metadata",
              details: {
                userId,
                planId
              }
            };
          }
          break;
        }
      case "customer.subscription.updated":
        {
          console.log("Processing customer.subscription.updated event");
          const subscription = event.data.object;
          // Get the customer ID and status
          const customerId = subscription.customer;
          const status = subscription.status;
          console.log("Subscription details:", {
            customerId,
            status,
            subscriptionId: subscription.id
          });
          // Map Stripe status to our status
          let appStatus;
          switch(status){
            case "active":
              appStatus = "active";
              break;
            case "canceled":
              appStatus = "canceled";
              break;
            case "unpaid":
            case "past_due":
              appStatus = "expired";
              break;
            default:
              appStatus = status;
          }
          // Find user by customer ID
          const { data: userData, error: userError } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).single();
          if (userError) {
            console.error("Error finding user by customer ID:", userError);
            statusCode = 404;
            responseBody = {
              error: "User not found",
              details: {
                customerId
              }
            };
          } else {
            console.log("Found user:", userData);
            // Update user in database
            const { error: updateError } = await supabase.from("users").update({
              subscription_status: appStatus,
              updated_at: new Date().toISOString()
            }).eq("id", userData.id);
            if (updateError) {
              console.error("Error updating user subscription:", updateError);
              statusCode = 500;
              responseBody = {
                error: "Error updating user subscription",
                details: updateError
              };
            } else {
              console.log("User subscription status updated to:", appStatus);
            }
          }
          break;
        }
      case "customer.subscription.deleted":
        {
          console.log("Processing customer.subscription.deleted event");
          const subscription = event.data.object;
          // Get the customer ID
          const customerId = subscription.customer;
          console.log("Subscription deleted for customer:", customerId);
          // Find user by customer ID
          const { data: userData, error: userError } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).single();
          if (userError) {
            console.error("Error finding user by customer ID:", userError);
            statusCode = 404;
            responseBody = {
              error: "User not found",
              details: {
                customerId
              }
            };
          } else {
            console.log("Found user:", userData);
            // Update user in database
            const { error: updateError } = await supabase.from("users").update({
              subscription_status: "canceled",
              subscription_canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }).eq("id", userData.id);
            if (updateError) {
              console.error("Error updating user subscription:", updateError);
              statusCode = 500;
              responseBody = {
                error: "Error updating user subscription",
                details: updateError
              };
            } else {
              console.log("User subscription marked as canceled");
            }
          }
          break;
        }
      case "invoice.payment_succeeded":
        {
          console.log("Processing invoice.payment_succeeded event");
          const invoice = event.data.object;
          // Get the customer ID and subscription ID
          const customerId = invoice.customer;
          const subscriptionId = invoice.subscription;
          if (!customerId) {
            console.error("No customer ID in invoice");
            break;
          }
          // Record the transaction
          const { error: transactionError } = await supabase.from("stripe_transactions").insert({
            id: `inv_${invoice.id}`,
            user_id: null,
            customer_id: customerId,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
            payment_method: "stripe",
            subscription_id: subscriptionId,
            metadata: {
              invoice_id: invoice.id,
              invoice_number: invoice.number
            }
          });
          if (transactionError) {
            console.error("Error recording transaction:", transactionError);
          } else {
            console.log("Transaction recorded successfully");
            // Find and update the user ID in the transaction
            const { data: userData, error: userError } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).single();
            if (!userError && userData) {
              const { error: updateError } = await supabase.from("stripe_transactions").update({
                user_id: userData.id
              }).eq("id", `inv_${invoice.id}`);
              if (updateError) {
                console.error("Error updating transaction with user ID:", updateError);
              } else {
                console.log("Transaction updated with user ID:", userData.id);
              }
            }
          }
          break;
        }
      case "payment_intent.succeeded":
        {
          console.log("Processing payment_intent.succeeded event");
          const paymentIntent = event.data.object;
          // Get the customer ID
          const customerId = paymentIntent.customer;
          if (!customerId) {
            console.error("No customer ID in payment intent");
            break;
          }
          // Record the transaction
          const { error: transactionError } = await supabase.from("stripe_transactions").insert({
            id: `pi_${paymentIntent.id}`,
            user_id: null,
            customer_id: customerId,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: "succeeded",
            payment_method: paymentIntent.payment_method_types?.[0] || "stripe",
            metadata: {
              payment_intent_id: paymentIntent.id
            }
          });
          if (transactionError) {
            console.error("Error recording transaction:", transactionError);
          } else {
            console.log("Transaction recorded successfully");
            // Find and update the user ID in the transaction
            const { data: userData, error: userError } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).single();
            if (!userError && userData) {
              const { error: updateError } = await supabase.from("stripe_transactions").update({
                user_id: userData.id
              }).eq("id", `pi_${paymentIntent.id}`);
              if (updateError) {
                console.error("Error updating transaction with user ID:", updateError);
              } else {
                console.log("Transaction updated with user ID:", userData.id);
              }
            }
          }
          break;
        }
      case "customer.subscription.created":
        {
          console.log("Processing customer.subscription.created event");
          const subscription = event.data.object;
          // Get the customer ID, subscription ID, and plan ID
          const customerId = subscription.customer;
          const subscriptionId = subscription.id;
          const planId = subscription.plan?.metadata?.plan_id;
          console.log("Subscription created:", {
            customerId,
            subscriptionId,
            planId,
            status: subscription.status
          });
          if (!customerId) {
            console.error("No customer ID in subscription");
            break;
          }
          // Find user by customer ID
          const { data: userData, error: userError } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).single();
          if (userError) {
            console.error("Error finding user by customer ID:", userError);
            break;
          }
          console.log("Found user:", userData);
          // If we have a plan ID from metadata, update the user's plan
          if (planId) {
            // Calculate subscription end date based on billing cycle
            const subscriptionEndDate = new Date(subscription.current_period_end * 1000);
            // Update user in database
            const { error: updateError } = await supabase.from("users").update({
              plan: planId,
              subscription_id: subscriptionId,
              subscription_status: subscription.status,
              subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
              subscription_end_date: subscriptionEndDate.toISOString(),
              updated_at: new Date().toISOString()
            }).eq("id", userData.id);
            if (updateError) {
              console.error("Error updating user with subscription:", updateError);
            } else {
              console.log("User updated with subscription and plan:", planId);
            }
          } else {
            console.log("No plan ID in subscription metadata, using product lookup");
            // Try to find the plan by product ID
            const productId = subscription.plan?.product;
            if (productId) {
              const { data: planData, error: planError } = await supabase.from("plans").select("id").eq("stripe_product_id", productId).single();
              if (planError) {
                console.error("Error finding plan by product ID:", planError);
              } else if (planData) {
                console.log("Found plan by product ID:", planData);
                // Calculate subscription end date based on billing cycle
                const subscriptionEndDate = new Date(subscription.current_period_end * 1000);
                // Update user in database
                const { error: updateError } = await supabase.from("users").update({
                  plan: planData.id,
                  subscription_id: subscriptionId,
                  subscription_status: subscription.status,
                  subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
                  subscription_end_date: subscriptionEndDate.toISOString(),
                  updated_at: new Date().toISOString()
                }).eq("id", userData.id);
                if (updateError) {
                  console.error("Error updating user with subscription:", updateError);
                } else {
                  console.log("User updated with subscription and plan:", planData.id);
                }
              }
            }
          }
          // Record the subscription in the database
          const { error: subscriptionError } = await supabase.from("subscriptions").insert({
            user_id: userData.id,
            plan_id: planId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            payment_method: "stripe",
            metadata: {
              product_id: subscription.plan?.product
            }
          });
          if (subscriptionError) {
            console.error("Error recording subscription:", subscriptionError);
          } else {
            console.log("Subscription recorded successfully");
          }
          break;
        }
      // Add more event types as needed
      default:
        // Unhandled event type
        console.log(`Unhandled event type: ${event.type}`);
    }
    // Update webhook record as processed
    if (webhookData) {
      await supabase.from("stripe_webhooks").update({
        processed: true
      }).eq("id", webhookData.id);
      console.log("Webhook marked as processed");
    }
    return new Response(JSON.stringify(responseBody), {
      status: statusCode,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return new Response(JSON.stringify({
      error: "Error interno del servidor",
      message: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
