import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// Tipos para el super admin
export interface SuperAdminUser {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
}

// Tipos para usuarios del sistema principal
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  bio?: string;
  avatar?: string;
  company?: string;
  location?: string;
  plan: string; // Changed to string to support dynamic plan IDs
  subscriptionId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'expired';
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionCanceledAt?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  isActive: boolean;
  isSuperAdmin: boolean;
}

// Tipos para planes
export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  maxStores: number;
  maxProducts: number;
  maxCategories: number;
  features: string[];
  isActive: boolean;
  isFree: boolean; // Indicates if this is the free plan
  level: number; // Plan level for comparison (1 = free, 2 = basic, 3 = premium, etc.)
  currency: string;
  interval: 'month' | 'year';
  stripeProductId?: string;
  stripePriceId?: string;
  createdAt: string;
  updatedAt?: string;
}

// Tipos para Stripe
export interface StripeConfig {
  id: string;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  isLive: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export interface StripePrice {
  id: string;
  productId: string;
  amount: number;
  currency: string;
  interval?: string;
  intervalCount?: number;
  isActive: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export interface StripeTransaction {
  id: string;
  userId?: string;
  customerId?: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  productId?: string;
  priceId?: string;
  subscriptionId?: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export interface SystemLog {
  id: string;
  adminId: string;
  action: string;
  objectType: string;
  objectId: string;
  details: any;
  ipAddress?: string;
  timestamp: string;
}

export interface SuperAdminState {
  user: SuperAdminUser | null;
  users: User[];
  plans: Plan[];
  systemLogs: SystemLog[];
  stripeConfig: StripeConfig | null;
  stripeProducts: StripeProduct[];
  stripePrices: StripePrice[];
  stripeTransactions: StripeTransaction[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  authError: string | null;
}

// Estado inicial
const initialState: SuperAdminState = {
  user: null,
  users: [],
  plans: [],
  systemLogs: [],
  stripeConfig: null,
  stripeProducts: [],
  stripePrices: [],
  stripeTransactions: [],
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  authError: null,
};

// Tipos de acciones
type SuperAdminAction =
  | { type: 'SET_USER'; payload: SuperAdminUser | null }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_PLANS'; payload: Plan[] }
  | { type: 'SET_SYSTEM_LOGS'; payload: SystemLog[] }
  | { type: 'SET_STRIPE_CONFIG'; payload: StripeConfig | null }
  | { type: 'SET_STRIPE_PRODUCTS'; payload: StripeProduct[] }
  | { type: 'SET_STRIPE_PRICES'; payload: StripePrice[] }
  | { type: 'SET_STRIPE_TRANSACTIONS'; payload: StripeTransaction[] }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_AUTH_ERROR'; payload: string | null }
  | { type: 'ADD_LOG'; payload: SystemLog }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'ADD_PLAN'; payload: Plan }
  | { type: 'UPDATE_PLAN'; payload: Plan }
  | { type: 'DELETE_PLAN'; payload: string }
  | { type: 'LOGOUT' };

// Reducer
function superAdminReducer(state: SuperAdminState, action: SuperAdminAction): SuperAdminState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_PLANS':
      return { ...state, plans: action.payload };
    case 'SET_SYSTEM_LOGS':
      return { ...state, systemLogs: action.payload };
    case 'SET_STRIPE_CONFIG':
      return { ...state, stripeConfig: action.payload };
    case 'SET_STRIPE_PRODUCTS':
      return { ...state, stripeProducts: action.payload };
    case 'SET_STRIPE_PRICES':
      return { ...state, stripePrices: action.payload };
    case 'SET_STRIPE_TRANSACTIONS':
      return { ...state, stripeTransactions: action.payload };
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };
    case 'SET_AUTH_ERROR':
      return { ...state, authError: action.payload };
    case 'ADD_LOG':
      return { ...state, systemLogs: [action.payload, ...state.systemLogs] };
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map(user =>
          user.id === action.payload.id ? action.payload : user
        )
      };
    case 'ADD_USER':
      return { ...state, users: [action.payload, ...state.users] };
    case 'ADD_PLAN':
      return { ...state, plans: [...state.plans, action.payload] };
    case 'UPDATE_PLAN':
      return {
        ...state,
        plans: state.plans.map(plan =>
          plan.id === action.payload.id ? action.payload : plan
        )
      };
    case 'DELETE_PLAN':
      return {
        ...state,
        plans: state.plans.filter(plan => plan.id !== action.payload)
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isInitialized: true,
        isLoading: false
      };
    default:
      return state;
  }
}

// Contexto
const SuperAdminContext = createContext<{
  state: SuperAdminState;
  dispatch: React.Dispatch<SuperAdminAction>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logAction: (action: string, objectType: string, objectId: string, details?: any) => Promise<void>;
  loadUsers: () => Promise<void>;
  loadPlans: () => Promise<void>;
  loadSystemLogs: () => Promise<void>;
  updateUserPlan: (userId: string, newPlan: string) => Promise<void>;
  toggleUserStatus: (userId: string) => Promise<void>;
  createUser: (userData: CreateUserData) => Promise<void>;
  updateUser: (userId: string, userData: UpdateUserData) => Promise<void>;
  createPlan: (planData: Omit<Plan, 'id' | 'createdAt'>) => Promise<void>;
  updatePlan: (planData: Plan) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
  // Stripe functions
  loadStripeConfig: () => Promise<void>;
  saveStripeConfig: (config: Omit<StripeConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  loadStripeProducts: () => Promise<void>;
  loadStripePrices: () => Promise<void>;
  loadStripeTransactions: () => Promise<void>;
  testStripeConnection: () => Promise<boolean>;
  syncStripeProducts: () => Promise<void>;
  syncPlanWithStripe: (planId: string) => Promise<void>;
  validateStripeIntegration: (planId: string) => Promise<boolean>;
  // Helper functions for plan logic
  getFreePlan: () => Plan | null;
  getPlanByLevel: (level: number) => Plan | null;
  getUserPlan: (user: User) => Plan | null;
  canUserPerformAction: (user: User, action: 'create_store' | 'create_product' | 'create_category', currentCount?: number) => boolean;
  getMaxLimitForUser: (user: User, type: 'stores' | 'products' | 'categories') => number;
}>({
  state: initialState,
  dispatch: () => null,
  login: async () => {},
  logout: async () => {},
  logAction: async () => {},
  loadUsers: async () => {},
  loadPlans: async () => {},
  loadSystemLogs: async () => {},
  updateUserPlan: async () => {},
  toggleUserStatus: async () => {},
  createUser: async () => {},
  updateUser: async () => {},
  createPlan: async () => {},
  updatePlan: async () => {},
  deletePlan: async () => {},
  loadStripeConfig: async () => {},
  saveStripeConfig: async () => {},
  loadStripeProducts: async () => {},
  loadStripePrices: async () => {},
  loadStripeTransactions: async () => {},
  testStripeConnection: async () => false,
  syncStripeProducts: async () => {},
  syncPlanWithStripe: async () => {},
  validateStripeIntegration: async () => false,
  getFreePlan: () => null,
  getPlanByLevel: () => null,
  getUserPlan: () => null,
  canUserPerformAction: () => false,
  getMaxLimitForUser: () => 0,
});

// Email del super administrador
const SUPER_ADMIN_EMAIL = 'the.genio27@gmail.com';

// Interfaces for user operations
export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  company?: string;
  location?: string;
  plan: string;
  isActive: boolean;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  company?: string;
  location?: string;
  plan?: string;
  isActive?: boolean;
}

// Funciones de transformación
function transformSupabaseUserToAppUser(userData: any): User {
  return {
    id: userData.id,
    email: userData.email,
    name: userData.name || '',
    phone: userData.phone || undefined,
    bio: userData.bio || undefined,
    avatar: userData.avatar || undefined,
    company: userData.company || undefined,
    location: userData.location || undefined,
    plan: userData.plan || 'gratuito', // Default to 'gratuito' to match database enum
    subscriptionId: userData.subscription_id || undefined,
    subscriptionStatus: userData.subscription_status || undefined,
    subscriptionStartDate: userData.subscription_start_date || undefined,
    subscriptionEndDate: userData.subscription_end_date || undefined,
    subscriptionCanceledAt: userData.subscription_canceled_at || undefined,
    paymentMethod: userData.payment_method || undefined,
    createdAt: userData.created_at,
    updatedAt: userData.updated_at || undefined,
    lastLoginAt: userData.last_login_at || undefined,
    isActive: userData.is_active ?? true,
    isSuperAdmin: userData.email === SUPER_ADMIN_EMAIL,
  };
}

function transformSupabaseLogToAppLog(logData: any): SystemLog {
  return {
    id: logData.id,
    adminId: logData.admin_id,
    action: logData.action,
    objectType: logData.object_type,
    objectId: logData.object_id,
    details: logData.details || {},
    ipAddress: logData.ip_address,
    timestamp: logData.created_at,
  };
}

function transformSupabasePlanToAppPlan(planData: any): Plan {
  return {
    id: planData.id,
    name: planData.name,
    description: planData.description,
    price: parseFloat(planData.price) || 0,
    maxStores: planData.max_stores || 1,
    maxProducts: planData.max_products || 10,
    maxCategories: planData.max_categories || 3,
    features: planData.features || [],
    isActive: planData.is_active ?? true,
    isFree: planData.is_free ?? false,
    level: planData.level || 1,
    currency: planData.currency || 'usd',
    interval: planData.interval || 'month',
    stripeProductId: planData.stripe_product_id || undefined,
    stripePriceId: planData.stripe_price_id || undefined,
    createdAt: planData.created_at,
    updatedAt: planData.updated_at || undefined,
  };
}

function transformSupabaseStripeConfigToApp(configData: any): StripeConfig {
  return {
    id: configData.id,
    publishableKey: configData.publishable_key,
    secretKey: configData.secret_key,
    webhookSecret: configData.webhook_secret || '',
    isLive: configData.is_live ?? false,
    isActive: configData.is_active ?? true,
    createdAt: configData.created_at,
    updatedAt: configData.updated_at,
  };
}

function transformSupabaseStripeProductToApp(productData: any): StripeProduct {
  return {
    id: productData.id,
    name: productData.name,
    description: productData.description || '',
    isActive: productData.is_active ?? true,
    metadata: productData.metadata || {},
    createdAt: productData.created_at,
    updatedAt: productData.updated_at,
  };
}

function transformSupabaseStripePriceToApp(priceData: any): StripePrice {
  return {
    id: priceData.id,
    productId: priceData.product_id,
    amount: priceData.amount,
    currency: priceData.currency,
    interval: priceData.interval,
    intervalCount: priceData.interval_count,
    isActive: priceData.is_active ?? true,
    metadata: priceData.metadata || {},
    createdAt: priceData.created_at,
    updatedAt: priceData.updated_at,
  };
}

function transformSupabaseStripeTransactionToApp(transactionData: any): StripeTransaction {
  return {
    id: transactionData.id,
    userId: transactionData.user_id,
    customerId: transactionData.customer_id,
    amount: transactionData.amount,
    currency: transactionData.currency,
    status: transactionData.status,
    paymentMethod: transactionData.payment_method,
    productId: transactionData.product_id,
    priceId: transactionData.price_id,
    subscriptionId: transactionData.subscription_id,
    metadata: transactionData.metadata || {},
    createdAt: transactionData.created_at,
    updatedAt: transactionData.updated_at,
  };
}

// Proveedor del contexto
export function SuperAdminProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(superAdminReducer, initialState);

  // Helper functions for plan logic
  const getFreePlan = (): Plan | null => {
    return state.plans.find(plan => plan.isFree && plan.isActive) || null;
  };

  const getPlanByLevel = (level: number): Plan | null => {
    return state.plans.find(plan => plan.level === level && plan.isActive) || null;
  };

  const getUserPlan = (user: User): Plan | null => {
    return state.plans.find(plan => plan.id === user.plan) || getFreePlan();
  };

  const canUserPerformAction = (user: User, action: 'create_store' | 'create_product' | 'create_category', currentCount: number = 0): boolean => {
    const userPlan = getUserPlan(user);
    if (!userPlan) return false;

    switch (action) {
      case 'create_store':
        return currentCount < userPlan.maxStores;
      case 'create_product':
        return currentCount < userPlan.maxProducts;
      case 'create_category':
        return currentCount < userPlan.maxCategories;
      default:
        return false;
    }
  };

  const getMaxLimitForUser = (user: User, type: 'stores' | 'products' | 'categories'): number => {
    const userPlan = getUserPlan(user);
    if (!userPlan) {
      // Fallback to free plan limits if no plan found
      const freePlan = getFreePlan();
      if (!freePlan) return type === 'stores' ? 1 : type === 'products' ? 10 : 3;
      return type === 'stores' ? freePlan.maxStores : type === 'products' ? freePlan.maxProducts : freePlan.maxCategories;
    }

    switch (type) {
      case 'stores':
        return userPlan.maxStores;
      case 'products':
        return userPlan.maxProducts;
      case 'categories':
        return userPlan.maxCategories;
      default:
        return 0;
    }
  };

  // Función de login usando Edge Function
  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_AUTH_ERROR', payload: null });

      console.log('🔄 Attempting super admin login...');

      // Llamar a la Edge Function para autenticación
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email,
          password,
          action: 'login'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error de autenticación');
      }

      if (!result.success) {
        throw new Error(result.error || 'Autenticación fallida');
      }

      console.log('✅ Super admin login successful');

      // Establecer la sesión en Supabase
      if (result.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token
        });

        if (sessionError) {
          console.warn('Warning setting session:', sessionError);
          // Continue anyway as we have the user data
        }
      }

      // Establecer usuario en el estado
      dispatch({ type: 'SET_USER', payload: result.user });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });

      // Cargar datos iniciales
      await Promise.all([
        loadUsers(),
        loadPlans(),
        loadSystemLogs(),
        loadStripeConfig(),
        loadStripeProducts(),
        loadStripePrices(),
        loadStripeTransactions()
      ]);

    } catch (error: any) {
      console.error('❌ Super Admin login error:', error);
      dispatch({ type: 'SET_AUTH_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Función de logout
  const logout = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Log de logout antes de cerrar sesión
      if (state.user) {
        await logAction('logout', 'auth', state.user.id);
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }

      dispatch({ type: 'LOGOUT' });
      console.log('✅ Super Admin logout successful');
    } catch (error) {
      console.error('❌ Super Admin logout failed:', error);
      dispatch({ type: 'LOGOUT' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Función para cargar usuarios usando Edge Function
  const loadUsers = async () => {
    try {
      console.log('🔄 Loading users via Edge Function...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authentication session found');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load users');
      }

      const users = (result.users || []).map(transformSupabaseUserToAppUser);
      dispatch({ type: 'SET_USERS', payload: users });
      console.log(`✅ Loaded ${users.length} users via Edge Function`);
    } catch (error: any) {
      console.error('❌ Error loading users:', error);
      throw error;
    }
  };

  // Función para cargar planes desde la base de datos
  const loadPlans = async () => {
    try {
      console.log('🔄 Loading plans from database...');
      
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('level', { ascending: true });

      if (error) {
        console.error('Error loading plans from database:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No plans found in database, using default plans');
        // Fallback to default plans if none exist in database
        const defaultPlans: Plan[] = [
          {
            id: 'gratuito',
            name: 'Gratuito',
            description: 'Plan básico gratuito para empezar',
            price: 0,
            maxStores: 1,
            maxProducts: 10,
            maxCategories: 3,
            features: ['1 tienda', '10 productos', '3 categorías', 'Soporte básico'],
            isActive: true,
            isFree: true,
            level: 1,
            currency: 'usd',
            interval: 'month',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'emprendedor',
            name: 'Emprendedor',
            description: 'Para pequeños negocios en crecimiento',
            price: 4.99,
            maxStores: 2,
            maxProducts: 30,
            maxCategories: 999999,
            features: ['2 tiendas', '30 productos por tienda', 'Categorías ilimitadas', 'Personalización avanzada', 'Soporte prioritario'],
            isActive: true,
            isFree: false,
            level: 2,
            currency: 'usd',
            interval: 'month',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'profesional',
            name: 'Profesional',
            description: 'Para empresas establecidas',
            price: 9.99,
            maxStores: 5,
            maxProducts: 50,
            maxCategories: 999999,
            features: ['5 tiendas', '50 productos por tienda', 'Categorías ilimitadas', 'Analíticas avanzadas', 'Personalización completa', 'Soporte 24/7'],
            isActive: true,
            isFree: false,
            level: 3,
            currency: 'usd',
            interval: 'month',
            createdAt: new Date().toISOString(),
          },
        ];
        dispatch({ type: 'SET_PLANS', payload: defaultPlans });
        return;
      }

      const plans = data.map(transformSupabasePlanToAppPlan);
      dispatch({ type: 'SET_PLANS', payload: plans });
      console.log(`✅ Loaded ${plans.length} plans from database`);
    } catch (error) {
      console.error('❌ Error loading plans:', error);
      // Don't throw error, just log it and continue with empty plans
    }
  };

  // Función para cargar logs del sistema - FIXED
  const loadSystemLogs = async () => {
    try {
      console.log('🔄 Loading system logs...');
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error loading system logs:', error);
        // Don't throw error, just set empty array
        dispatch({ type: 'SET_SYSTEM_LOGS', payload: [] });
        return;
      }

      const logs = (data || []).map(transformSupabaseLogToAppLog);
      dispatch({ type: 'SET_SYSTEM_LOGS', payload: logs });
      console.log(`✅ Loaded ${logs.length} system logs`);
    } catch (error) {
      console.error('Error loading system logs:', error);
      // Set empty array on error
      dispatch({ type: 'SET_SYSTEM_LOGS', payload: [] });
    }
  };

  // Función para cargar configuración de Stripe
  const loadStripeConfig = async () => {
    try {
      console.log('🔄 Loading Stripe configuration...');
      const { data, error } = await supabase
        .from('stripe_config')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error loading Stripe config:', error);
        dispatch({ type: 'SET_STRIPE_CONFIG', payload: null });
        return;
      }

      if (data && data.length > 0) {
        const config = transformSupabaseStripeConfigToApp(data[0]);
        dispatch({ type: 'SET_STRIPE_CONFIG', payload: config });
        console.log('✅ Loaded Stripe configuration');
      } else {
        dispatch({ type: 'SET_STRIPE_CONFIG', payload: null });
        console.log('ℹ️ No Stripe configuration found');
      }
    } catch (error) {
      console.error('Error loading Stripe config:', error);
      dispatch({ type: 'SET_STRIPE_CONFIG', payload: null });
    }
  };

  // Función para guardar configuración de Stripe
  const saveStripeConfig = async (config: Omit<StripeConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.log('🔄 Saving Stripe configuration...');

      // Primero desactivar configuraciones existentes
      await supabase
        .from('stripe_config')
        .update({ is_active: false })
        .eq('is_active', true);

      // Insertar nueva configuración
      const { data, error } = await supabase
        .from('stripe_config')
        .insert({
          publishable_key: config.publishableKey,
          secret_key: config.secretKey,
          webhook_secret: config.webhookSecret,
          is_live: config.isLive,
          is_active: config.isActive,
        })
        .select()
        .single();

      if (error) throw error;

      const newConfig = transformSupabaseStripeConfigToApp(data);
      dispatch({ type: 'SET_STRIPE_CONFIG', payload: newConfig });

      // Log de la acción
      await logAction('update_stripe_config', 'stripe_config', newConfig.id, config);

      console.log('✅ Stripe configuration saved');
    } catch (error) {
      console.error('Error saving Stripe config:', error);
      throw error;
    }
  };

  // Función para cargar productos de Stripe
  const loadStripeProducts = async () => {
    try {
      console.log('🔄 Loading Stripe products...');
      const { data, error } = await supabase
        .from('stripe_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading Stripe products:', error);
        dispatch({ type: 'SET_STRIPE_PRODUCTS', payload: [] });
        return;
      }

      const products = (data || []).map(transformSupabaseStripeProductToApp);
      dispatch({ type: 'SET_STRIPE_PRODUCTS', payload: products });
      console.log(`✅ Loaded ${products.length} Stripe products`);
    } catch (error) {
      console.error('Error loading Stripe products:', error);
      dispatch({ type: 'SET_STRIPE_PRODUCTS', payload: [] });
    }
  };

  // Función para cargar precios de Stripe
  const loadStripePrices = async () => {
    try {
      console.log('🔄 Loading Stripe prices...');
      const { data, error } = await supabase
        .from('stripe_prices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading Stripe prices:', error);
        dispatch({ type: 'SET_STRIPE_PRICES', payload: [] });
        return;
      }

      const prices = (data || []).map(transformSupabaseStripePriceToApp);
      dispatch({ type: 'SET_STRIPE_PRICES', payload: prices });
      console.log(`✅ Loaded ${prices.length} Stripe prices`);
    } catch (error) {
      console.error('Error loading Stripe prices:', error);
      dispatch({ type: 'SET_STRIPE_PRICES', payload: [] });
    }
  };

  // Función para cargar transacciones de Stripe
  const loadStripeTransactions = async () => {
    try {
      console.log('🔄 Loading Stripe transactions...');
      const { data, error } = await supabase
        .from('stripe_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error loading Stripe transactions:', error);
        dispatch({ type: 'SET_STRIPE_TRANSACTIONS', payload: [] });
        return;
      }

      const transactions = (data || []).map(transformSupabaseStripeTransactionToApp);
      dispatch({ type: 'SET_STRIPE_TRANSACTIONS', payload: transactions });
      console.log(`✅ Loaded ${transactions.length} Stripe transactions`);
    } catch (error) {
      console.error('Error loading Stripe transactions:', error);
      dispatch({ type: 'SET_STRIPE_TRANSACTIONS', payload: [] });
    }
  };

  // Función para probar conexión con Stripe
  const testStripeConnection = async (): Promise<boolean> => {
    try {
      if (!state.stripeConfig) {
        throw new Error('No Stripe configuration found');
      }

      console.log('🔄 Testing Stripe connection...');

      // Test with Stripe API
      const response = await fetch('https://api.stripe.com/v1/account', {
        headers: {
          'Authorization': `Bearer ${state.stripeConfig.secretKey}`,
        }
      });

      if (response.ok) {
        console.log('✅ Stripe connection successful');
        return true;
      } else {
        console.error('❌ Stripe connection failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error testing Stripe connection:', error);
      return false;
    }
  };

  // Función para sincronizar productos con Stripe
  const syncStripeProducts = async () => {
    try {
      if (!state.stripeConfig) {
        throw new Error('No Stripe configuration found');
      }

      console.log('🔄 Syncing products with Stripe...');

      // Fetch products from Stripe
      const response = await fetch('https://api.stripe.com/v1/products?limit=100', {
        headers: {
          'Authorization': `Bearer ${state.stripeConfig.secretKey}`,
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products from Stripe');
      }

      const stripeData = await response.json();
      
      // Sync products to database
      for (const product of stripeData.data) {
        await supabase
          .from('stripe_products')
          .upsert({
            id: product.id,
            name: product.name,
            description: product.description || '',
            is_active: product.active,
            metadata: product.metadata || {},
          });
      }

      // Fetch prices from Stripe
      const pricesResponse = await fetch('https://api.stripe.com/v1/prices?limit=100', {
        headers: {
          'Authorization': `Bearer ${state.stripeConfig.secretKey}`,
        }
      });

      if (pricesResponse.ok) {
        const pricesData = await pricesResponse.json();
        
        // Sync prices to database
        for (const price of pricesData.data) {
          await supabase
            .from('stripe_prices')
            .upsert({
              id: price.id,
              product_id: price.product,
              amount: price.unit_amount,
              currency: price.currency,
              interval: price.recurring?.interval,
              interval_count: price.recurring?.interval_count,
              is_active: price.active,
              metadata: price.metadata || {},
            });
        }
      }

      // Reload data
      await Promise.all([loadStripeProducts(), loadStripePrices()]);

      console.log('✅ Stripe products synced successfully');
    } catch (error) {
      console.error('❌ Error syncing Stripe products:', error);
      throw error;
    }
  };

  // 🚀 NUEVA FUNCIÓN: Sincronizar plan específico con Stripe
  const syncPlanWithStripe = async (planId: string) => {
    try {
      console.log(`🔄 Syncing plan with Stripe: ${planId}`);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authentication session found');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-plan-with-stripe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          adminId: state.user?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync plan with Stripe');
      }

      console.log(`✅ Plan synced with Stripe successfully: ${planId}`);
    } catch (error: any) {
      console.error('❌ Error syncing plan with Stripe:', error);
      throw error;
    }
  };

  // 🚀 NUEVA FUNCIÓN: Validar integración de Stripe para un plan
  const validateStripeIntegration = async (planId: string): Promise<boolean> => {
    try {
      console.log(`🔄 Validating Stripe integration for plan: ${planId}`);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authentication session found');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-stripe-integration`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to validate Stripe integration');
      }

      console.log(`✅ Stripe integration validation result: ${result.valid}`);
      return result.valid;
    } catch (error: any) {
      console.error('❌ Error validating Stripe integration:', error);
      return false;
    }
  };

  // 🚀 NUEVA FUNCIÓN: Actualizar plan de usuario usando Edge Function
  const updateUserPlan = async (userId: string, newPlan: string) => {
    try {
      console.log(`🔄 Updating user plan via Edge Function: ${userId} -> ${newPlan}`);
      
      // Validate that the plan exists
      const planExists = state.plans.find(p => p.id === newPlan);
      if (!planExists) {
        throw new Error(`Plan "${newPlan}" no existe`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authentication session found');
      }

      // Call the sync Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-user-plan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          newPlanId: newPlan,
          adminId: state.user?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update user plan');
      }

      // Update local state with the updated user
      const updatedUser = transformSupabaseUserToAppUser(result.user);
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });

      // Reload system logs to show the new action
      await loadSystemLogs();

      console.log(`✅ User plan updated successfully via Edge Function: ${userId} -> ${newPlan}`);
    } catch (error: any) {
      console.error('❌ Error updating user plan:', error);
      throw error;
    }
  };

  // Función para activar/desactivar usuario
  const toggleUserStatus = async (userId: string) => {
    try {
      const user = state.users.find(u => u.id === userId);
      if (!user) throw new Error('Usuario no encontrado');

      const newStatus = !user.isActive;
      console.log(`🔄 Toggling user status: ${userId} -> ${newStatus ? 'active' : 'inactive'}`);

      const { error } = await supabase
        .from('users')
        .update({ 
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      // Actualizar estado local
      const newUser = { ...user, isActive: newStatus, updatedAt: new Date().toISOString() };
      dispatch({ type: 'UPDATE_USER', payload: newUser });

      // Log de la acción
      await logAction(newStatus ? 'activate_user' : 'deactivate_user', 'user', userId, { status: newStatus });

      console.log(`✅ User status updated: ${userId} -> ${newStatus ? 'active' : 'inactive'}`);
    } catch (error) {
      console.error('Error toggling user status:', error);
      throw error;
    }
  };

  // 🚀 NUEVA FUNCIÓN: Crear usuario
  const createUser = async (userData: CreateUserData) => {
    try {
      console.log('🔄 Creating user via Edge Function:', userData.email);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authentication session found');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-create-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...userData,
          adminId: state.user?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create user');
      }

      // Add user to local state
      const newUser = transformSupabaseUserToAppUser(result.user);
      dispatch({ type: 'ADD_USER', payload: newUser });

      // Reload system logs to show the new action
      await loadSystemLogs();

      console.log(`✅ User created successfully: ${result.user.id}`);
    } catch (error: any) {
      console.error('❌ Error creating user:', error);
      throw error;
    }
  };

  // 🚀 NUEVA FUNCIÓN: Actualizar usuario
  const updateUser = async (userId: string, userData: UpdateUserData) => {
    try {
      console.log('🔄 Updating user via Edge Function:', userId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authentication session found');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-update-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...userData,
          adminId: state.user?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update user');
      }

      // Update user in local state
      const updatedUser = transformSupabaseUserToAppUser(result.user);
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });

      // Reload system logs to show the new action
      await loadSystemLogs();

      console.log(`✅ User updated successfully: ${userId}`);
    } catch (error: any) {
      console.error('❌ Error updating user:', error);
      throw error;
    }
  };

  // Función para crear plan
  const createPlan = async (planData: Omit<Plan, 'id' | 'createdAt'>) => {
    try {
      console.log('🔄 Creating plan:', planData.name);

      const { data, error } = await supabase
        .from('plans')
        .insert({
          name: planData.name,
          description: planData.description,
          price: planData.price,
          max_stores: planData.maxStores,
          max_products: planData.maxProducts,
          max_categories: planData.maxCategories,
          features: planData.features,
          is_active: planData.isActive,
          is_free: planData.isFree,
          level: planData.level,
          currency: planData.currency,
          interval: planData.interval,
        })
        .select()
        .single();

      if (error) throw error;

      const newPlan = transformSupabasePlanToAppPlan(data);
      dispatch({ type: 'ADD_PLAN', payload: newPlan });

      // Auto-sync with Stripe if not free and Stripe is configured
      if (!newPlan.isFree && state.stripeConfig) {
        try {
          await syncPlanWithStripe(newPlan.id);
          // Reload plans to get updated Stripe IDs
          await loadPlans();
        } catch (stripeError) {
          console.warn('Plan created but Stripe sync failed:', stripeError);
        }
      }

      // Log de la acción
      await logAction('create_plan', 'plan', newPlan.id, planData);

      console.log('✅ Plan created:', newPlan.id);
    } catch (error) {
      console.error('Error creating plan:', error);
      throw error;
    }
  };

  // Función para actualizar plan
  const updatePlan = async (planData: Plan) => {
    try {
      console.log('🔄 Updating plan:', planData.id);

      const { data, error } = await supabase
        .from('plans')
        .update({
          name: planData.name,
          description: planData.description,
          price: planData.price,
          max_stores: planData.maxStores,
          max_products: planData.maxProducts,
          max_categories: planData.maxCategories,
          features: planData.features,
          is_active: planData.isActive,
          is_free: planData.isFree,
          level: planData.level,
          currency: planData.currency,
          interval: planData.interval,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planData.id)
        .select()
        .single();

      if (error) throw error;

      const updatedPlan = transformSupabasePlanToAppPlan(data);
      dispatch({ type: 'UPDATE_PLAN', payload: updatedPlan });

      // Auto-sync with Stripe if not free and Stripe is configured
      if (!updatedPlan.isFree && state.stripeConfig) {
        try {
          await syncPlanWithStripe(updatedPlan.id);
          // Reload plans to get updated Stripe IDs
          await loadPlans();
        } catch (stripeError) {
          console.warn('Plan updated but Stripe sync failed:', stripeError);
        }
      }

      // Log de la acción
      await logAction('update_plan', 'plan', planData.id, planData);

      console.log('✅ Plan updated:', planData.id);
    } catch (error) {
      console.error('Error updating plan:', error);
      throw error;
    }
  };

  // Función para eliminar plan
  const deletePlan = async (planId: string) => {
    try {
      console.log('🔄 Deleting plan:', planId);

      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      dispatch({ type: 'DELETE_PLAN', payload: planId });

      // Log de la acción
      await logAction('delete_plan', 'plan', planId);

      console.log('✅ Plan deleted:', planId);
    } catch (error) {
      console.error('Error deleting plan:', error);
      throw error;
    }
  };

  // Función para registrar acciones
  const logAction = async (action: string, objectType: string, objectId: string, details?: any) => {
    try {
      if (!state.user) return;

      console.log(`📝 Logging action: ${action} on ${objectType}:${objectId}`);

      const { error } = await supabase
        .from('system_logs')
        .insert({
          admin_id: state.user.id,
          action,
          object_type: objectType,
          object_id: objectId,
          details: details || {},
          ip_address: 'N/A', // En un entorno real, obtendrías la IP real
        });

      if (error) {
        console.error('Error logging action:', error);
        return;
      }

      // Recargar logs para mostrar el nuevo
      await loadSystemLogs();
    } catch (error) {
      console.error('Error logging action:', error);
    }
  };

  // Inicialización de autenticación
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing Super Admin authentication...');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          
          // Clear invalid session by removing from localStorage directly
          console.log('🧹 Clearing invalid session from storage');
          localStorage.removeItem('tutaviendo-auth-token');
          
          if (isMounted) {
            dispatch({ type: 'SET_AUTH_ERROR', payload: sessionError.message });
            dispatch({ type: 'SET_AUTHENTICATED', payload: false });
            dispatch({ type: 'SET_INITIALIZED', payload: true });
          }
          return;
        }

        if (session?.user) {
          // Verificar que sea el super admin
          if (session.user.email !== SUPER_ADMIN_EMAIL) {
            console.log('❌ User is not super admin:', session.user.email);
            if (isMounted) {
              dispatch({ type: 'SET_AUTH_ERROR', payload: 'Acceso denegado. No tienes permisos de super administrador.' });
              dispatch({ type: 'SET_AUTHENTICATED', payload: false });
            }
          } else {
            console.log('✅ Super Admin found in session:', session.user.id);

            try {
              const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (isMounted) {
                const superAdminUser: SuperAdminUser = {
                  id: session.user.id,
                  email: session.user.email,
                  name: userData?.name || 'Super Admin',
                  isSuperAdmin: true,
                };

                dispatch({ type: 'SET_USER', payload: superAdminUser });
                dispatch({ type: 'SET_AUTHENTICATED', payload: true });

                // Cargar datos iniciales
                await Promise.all([
                  loadUsers(),
                  loadPlans(),
                  loadSystemLogs(),
                  loadStripeConfig(),
                  loadStripeProducts(),
                  loadStripePrices(),
                  loadStripeTransactions()
                ]);
              }
            } catch (error) {
              console.error('❌ Error fetching super admin data:', error);
              if (isMounted) {
                const superAdminUser: SuperAdminUser = {
                  id: session.user.id,
                  email: session.user.email,
                  name: 'Super Admin',
                  isSuperAdmin: true,
                };
                dispatch({ type: 'SET_USER', payload: superAdminUser });
                dispatch({ type: 'SET_AUTHENTICATED', payload: true });

                // Cargar datos iniciales
                await Promise.all([
                  loadUsers(),
                  loadPlans(),
                  loadSystemLogs(),
                  loadStripeConfig(),
                  loadStripeProducts(),
                  loadStripePrices(),
                  loadStripeTransactions()
                ]);
              }
            }
          }
        } else {
          console.log('ℹ️ No super admin session found');
          if (isMounted) {
            dispatch({ type: 'SET_AUTHENTICATED', payload: false });
          }
        }
      } catch (error: any) {
        console.error('❌ Super Admin auth initialization failed:', error);
        
        // Clear invalid session by removing from localStorage directly
        if (error.message?.includes('refresh_token_not_found') || 
            error.message?.includes('Invalid Refresh Token') ||
            error.message?.includes('Invalid authentication token')) {
          console.log('🧹 Clearing invalid session from storage');
          localStorage.removeItem('tutaviendo-auth-token');
        }
        
        if (isMounted) {
          dispatch({ type: 'SET_AUTH_ERROR', payload: error.message });
          dispatch({ type: 'SET_AUTHENTICATED', payload: false });
        }
      } finally {
        if (isMounted) {
          dispatch({ type: 'SET_INITIALIZED', payload: true });
          console.log('✅ Super Admin authentication initialization complete');
        }
      }
    };

    initializeAuth();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      console.log('🔄 Super Admin auth state changed:', event);

      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'LOGOUT' });
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Verificar que sea el super admin
        if (session.user.email === SUPER_ADMIN_EMAIL && state.isInitialized) {
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            const superAdminUser: SuperAdminUser = {
              id: session.user.id,
              email: session.user.email,
              name: userData?.name || 'Super Admin',
              isSuperAdmin: true,
            };

            dispatch({ type: 'SET_USER', payload: superAdminUser });
            dispatch({ type: 'SET_AUTHENTICATED', payload: true });

            // Cargar datos iniciales
            await Promise.all([
              loadUsers(),
              loadPlans(),
              loadSystemLogs(),
              loadStripeConfig(),
              loadStripeProducts(),
              loadStripePrices(),
              loadStripeTransactions()
            ]);
          } catch (error) {
            console.error('❌ Error handling super admin auth state change:', error);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SuperAdminContext.Provider value={{
      state,
      dispatch,
      login,
      logout,
      logAction,
      loadUsers,
      loadPlans,
      loadSystemLogs,
      updateUserPlan,
      toggleUserStatus,
      createUser,
      updateUser,
      createPlan,
      updatePlan,
      deletePlan,
      loadStripeConfig,
      saveStripeConfig,
      loadStripeProducts,
      loadStripePrices,
      loadStripeTransactions,
      testStripeConnection,
      syncStripeProducts,
      syncPlanWithStripe,
      validateStripeIntegration,
      getFreePlan,
      getPlanByLevel,
      getUserPlan,
      canUserPerformAction,
      getMaxLimitForUser,
    }}>
      {children}
    </SuperAdminContext.Provider>
  );
}

// Hook personalizado
export function useSuperAdmin() {
  const context = useContext(SuperAdminContext);
  if (!context) {
    throw new Error('useSuperAdmin must be used within a SuperAdminProvider');
  }
  return context;
}

export default SuperAdminContext;