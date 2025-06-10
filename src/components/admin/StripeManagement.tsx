import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Settings, 
  DollarSign, 
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  TestTube,
  Zap,
  Copy,
  AlertCircle,
  Link,
  ArrowRight
} from 'lucide-react';
import { useSuperAdmin } from '../../contexts/SuperAdminContext';
import { useToast } from '../../contexts/ToastContext';

export default function StripeManagement() {
  const { 
    state, 
    loadStripeConfig, 
    saveStripeConfig, 
    loadStripeProducts, 
    loadStripePrices, 
    loadStripeTransactions,
    testStripeConnection,
    syncStripeProducts
  } = useSuperAdmin();
  const { success, error } = useToast();
  
  const [activeTab, setActiveTab] = useState<'config' | 'products' | 'transactions' | 'webhooks' | 'integration'>('config');
  const [isLoading, setIsLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown');
  
  // Config form state
  const [configForm, setConfigForm] = useState({
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    isLive: false,
    isActive: true
  });

  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [formErrors, setFormErrors] = useState<any>({});

  useEffect(() => {
    if (state.stripeConfig) {
      setConfigForm({
        publishableKey: state.stripeConfig.publishableKey,
        secretKey: state.stripeConfig.secretKey,
        webhookSecret: state.stripeConfig.webhookSecret,
        isLive: state.stripeConfig.isLive,
        isActive: state.stripeConfig.isActive
      });
    } else {
      setConfigForm({
        publishableKey: '',
        secretKey: '',
        webhookSecret: '',
        isLive: false,
        isActive: true
      });
    }
  }, [state.stripeConfig]);

  const validateConfigForm = () => {
    const errors: any = {};

    if (!configForm.publishableKey.trim()) {
      errors.publishableKey = 'La clave pública es requerida';
    } else if (!configForm.publishableKey.startsWith('pk_')) {
      errors.publishableKey = 'La clave pública debe comenzar con "pk_"';
    }

    if (!configForm.secretKey.trim()) {
      errors.secretKey = 'La clave secreta es requerida';
    } else if (!configForm.secretKey.startsWith('sk_')) {
      errors.secretKey = 'La clave secreta debe comenzar con "sk_"';
    }

    // Webhook secret is optional, but if provided, must start with whsec_
    if (configForm.webhookSecret.trim() && !configForm.webhookSecret.startsWith('whsec_')) {
      errors.webhookSecret = 'El webhook secret debe comenzar con "whsec_" (copia el valor completo desde Stripe)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveConfig = async () => {
    if (!validateConfigForm()) return;

    setIsLoading(true);
    try {
      await saveStripeConfig(configForm);
      setIsEditingConfig(false);
      success('Configuración guardada', 'La configuración de Stripe se ha guardado correctamente');
      
      // Test connection after saving
      await handleTestConnection();
    } catch (err: any) {
      console.error('Error saving config:', err);
      error('Error al guardar', err.message || 'No se pudo guardar la configuración');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const isConnected = await testStripeConnection();
      setConnectionStatus(isConnected ? 'success' : 'error');
      
      if (isConnected) {
        success('Conexión exitosa', 'La conexión con Stripe es válida');
      } else {
        error('Conexión fallida', 'No se pudo conectar con Stripe. Verifica las credenciales.');
      }
    } catch (err) {
      setConnectionStatus('error');
      error('Error de conexión', 'Error al probar la conexión con Stripe');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSyncProducts = async () => {
    setIsLoading(true);
    try {
      await syncStripeProducts();
      success('Sincronización completa', 'Los productos se han sincronizado con Stripe');
    } catch (err: any) {
      console.error('Error syncing products:', err);
      error('Error de sincronización', err.message || 'No se pudo sincronizar con Stripe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadStripeConfig(),
        loadStripeProducts(),
        loadStripePrices(),
        loadStripeTransactions()
      ]);
      success('Datos actualizados', 'Los datos de Stripe se han actualizado');
    } catch (err) {
      error('Error al actualizar', 'No se pudieron actualizar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded': return 'text-green-400 bg-green-400/10';
      case 'pending': return 'text-yellow-400 bg-yellow-400/10';
      case 'failed': return 'text-red-400 bg-red-400/10';
      default: return 'text-slate-400 bg-slate-400/10';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    success('Copiado', 'Texto copiado al portapapeles');
  };

  const tabs = [
    { id: 'config', label: 'Configuración', icon: Settings },
    { id: 'products', label: 'Productos', icon: CreditCard },
    { id: 'transactions', label: 'Transacciones', icon: DollarSign },
    { id: 'webhooks', label: 'Webhooks', icon: RefreshCw },
    { id: 'integration', label: 'Integración', icon: Link }
  ];

  // Get products with their prices
  const productsWithPrices = state.stripeProducts.map(product => ({
    ...product,
    prices: state.stripePrices.filter(price => price.productId === product.id)
  }));

  // Get plans mapped to Stripe products
  const plansWithStripeMapping = state.plans.map(plan => {
    const stripeProduct = state.stripeProducts.find(p => 
      p.name.toLowerCase().includes(plan.name.toLowerCase()) ||
      p.metadata?.plan_id === plan.id
    );
    
    return {
      ...plan,
      stripeProduct,
      hasStripeMapping: !!stripeProduct
    };
  });

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 lg:px-8 py-4 lg:py-6 sticky top-0 z-40">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-white">Gestión de Stripe</h1>
            <p className="text-slate-400 text-sm lg:text-base mt-1">
              Configura y gestiona los pagos de la plataforma
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refrescar
            </button>
            
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Dashboard Stripe
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <div className="px-4 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-cyan-500 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 lg:p-8">
        {/* Configuration Tab */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    connectionStatus === 'success' ? 'bg-green-500/20' : 
                    connectionStatus === 'error' ? 'bg-red-500/20' : 'bg-slate-500/20'
                  }`}>
                    {connectionStatus === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : connectionStatus === 'error' ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Conexión</p>
                    <p className="text-lg font-bold text-white">
                      {connectionStatus === 'success' ? 'Conectado' : 
                       connectionStatus === 'error' ? 'Error' : 'No probado'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Settings className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Modo</p>
                    <p className="text-lg font-bold text-white">
                      {state.stripeConfig?.isLive ? 'Producción' : 'Pruebas'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Productos</p>
                    <p className="text-lg font-bold text-white">{state.stripeProducts.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Transacciones</p>
                    <p className="text-lg font-bold text-white">{state.stripeTransactions.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration Form */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Configuración de API</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showSecrets ? 'Ocultar' : 'Mostrar'}
                  </button>

                  {state.stripeConfig && (
                    <button
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <TestTube className={`w-4 h-4 ${isTestingConnection ? 'animate-pulse' : ''}`} />
                      Probar Conexión
                    </button>
                  )}
                  
                  {!isEditingConfig ? (
                    <button
                      onClick={() => setIsEditingConfig(true)}
                      className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      {state.stripeConfig ? 'Editar' : 'Configurar'}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setIsEditingConfig(false);
                          setFormErrors({});
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveConfig}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Guardar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!state.stripeConfig && !isEditingConfig && (
                <div className="text-center py-8">
                  <CreditCard className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Stripe no configurado</h3>
                  <p className="text-slate-400 mb-4">
                    Configura las credenciales de Stripe para habilitar los pagos
                  </p>
                  <button
                    onClick={() => setIsEditingConfig(true)}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Configurar Stripe
                  </button>
                </div>
              )}

              {(state.stripeConfig || isEditingConfig) && (
                <div className="space-y-6">
                  {/* Webhook Secret Help */}
                  {isEditingConfig && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="text-blue-400 font-medium text-sm">Cómo obtener el Webhook Secret</h3>
                          <p className="text-blue-300/80 text-sm mt-1">
                            1. Ve a tu Dashboard de Stripe → Webhooks<br/>
                            2. Selecciona tu webhook<br/>
                            3. En la sección "Secreto de firma", haz clic en "Revelar"<br/>
                            4. Copia el valor completo que comienza con "whsec_"
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">
                        Publishable Key *
                      </label>
                      <input
                        type={showSecrets ? 'text' : 'password'}
                        value={configForm.publishableKey}
                        onChange={(e) => setConfigForm(prev => ({ ...prev, publishableKey: e.target.value }))}
                        disabled={!isEditingConfig}
                        className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 ${
                          formErrors.publishableKey ? 'border-red-500' : 'border-slate-600'
                        }`}
                        placeholder="pk_test_..."
                      />
                      {formErrors.publishableKey && (
                        <p className="text-red-400 text-xs mt-1">{formErrors.publishableKey}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">
                        Secret Key *
                      </label>
                      <input
                        type={showSecrets ? 'text' : 'password'}
                        value={configForm.secretKey}
                        onChange={(e) => setConfigForm(prev => ({ ...prev, secretKey: e.target.value }))}
                        disabled={!isEditingConfig}
                        className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 ${
                          formErrors.secretKey ? 'border-red-500' : 'border-slate-600'
                        }`}
                        placeholder="sk_test_..."
                      />
                      {formErrors.secretKey && (
                        <p className="text-red-400 text-xs mt-1">{formErrors.secretKey}</p>
                      )}
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block text-slate-300 text-sm font-medium mb-2">
                        Webhook Secret (Opcional)
                        <span className="text-slate-500 text-xs ml-2">
                          - Necesario para recibir eventos de Stripe
                        </span>
                      </label>
                      <input
                        type={showSecrets ? 'text' : 'password'}
                        value={configForm.webhookSecret}
                        onChange={(e) => setConfigForm(prev => ({ ...prev, webhookSecret: e.target.value }))}
                        disabled={!isEditingConfig}
                        className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 ${
                          formErrors.webhookSecret ? 'border-red-500' : 'border-slate-600'
                        }`}
                        placeholder="whsec_1234567890abcdef... (copia desde Stripe Dashboard)"
                      />
                      {formErrors.webhookSecret && (
                        <p className="text-red-400 text-xs mt-1">{formErrors.webhookSecret}</p>
                      )}
                      {!formErrors.webhookSecret && configForm.webhookSecret && (
                        <p className="text-green-400 text-xs mt-1">
                          ✓ Webhook secret válido
                        </p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="isLive"
                          checked={configForm.isLive}
                          onChange={(e) => setConfigForm(prev => ({ ...prev, isLive: e.target.checked }))}
                          disabled={!isEditingConfig}
                          className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500 disabled:opacity-50"
                        />
                        <label htmlFor="isLive" className="text-slate-300 text-sm">
                          Modo de producción
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="isActive"
                          checked={configForm.isActive}
                          onChange={(e) => setConfigForm(prev => ({ ...prev, isActive: e.target.checked }))}
                          disabled={!isEditingConfig}
                          className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500 disabled:opacity-50"
                        />
                        <label htmlFor="isActive" className="text-slate-300 text-sm">
                          Configuración activa
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Productos de Stripe</h3>
              <button
                onClick={handleSyncProducts}
                disabled={isLoading || !state.stripeConfig}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                Sincronizar con Stripe
              </button>
            </div>

            {!state.stripeConfig && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-amber-400 font-medium text-sm">Configuración requerida</h3>
                    <p className="text-amber-300/80 text-sm mt-1">
                      Configura las credenciales de Stripe en la pestaña de Configuración para ver los productos.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {productsWithPrices.map((product) => (
                <div key={product.id} className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-white">{product.name}</h4>
                      <p className="text-slate-400 text-sm mt-1">{product.description}</p>
                      <p className="text-slate-500 text-xs mt-2 font-mono">ID: {product.id}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {product.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-slate-300">Precios:</h5>
                    {product.prices.length > 0 ? (
                      product.prices.map((price) => (
                        <div key={price.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                          <span className="text-white font-medium">
                            {formatAmount(price.amount, price.currency)}
                          </span>
                          {price.interval && (
                            <span className="text-slate-400 text-sm">
                              /{price.intervalCount === 1 ? price.interval : `${price.intervalCount} ${price.interval}s`}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm">No hay precios configurados</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {productsWithPrices.length === 0 && state.stripeConfig && (
              <div className="text-center py-12">
                <CreditCard className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No hay productos</h3>
                <p className="text-slate-400 mb-4">
                  Sincroniza con Stripe para cargar los productos existentes
                </p>
                <button
                  onClick={handleSyncProducts}
                  disabled={isLoading}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Sincronizar Productos
                </button>
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Transacciones Recientes</h3>

            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {state.stripeTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-slate-700/30">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-300">
                          {transaction.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {transaction.customerId || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                          {formatAmount(transaction.amount, transaction.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {state.stripeTransactions.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No hay transacciones</h3>
                <p className="text-slate-400">
                  Las transacciones aparecerán aquí cuando se procesen pagos
                </p>
              </div>
            )}
          </div>
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Configuración de Webhooks</h3>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    URL del Webhook
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`}
                      readOnly
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    />
                    <button
                      onClick={() => copyToClipboard(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`)}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Eventos a Escuchar
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      'checkout.session.completed',
                      'payment_intent.succeeded',
                      'payment_intent.payment_failed',
                      'customer.subscription.created',
                      'customer.subscription.updated',
                      'customer.subscription.deleted',
                      'invoice.payment_succeeded'
                    ].map((event) => (
                      <div key={event} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-slate-300">{event}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-blue-400 font-medium text-sm">Instrucciones</h3>
                      <p className="text-blue-300/80 text-sm mt-1">
                        1. Copia la URL del webhook<br/>
                        2. Ve al Dashboard de Stripe → Webhooks<br/>
                        3. Crea un nuevo endpoint con esta URL<br/>
                        4. Selecciona los eventos listados arriba<br/>
                        5. Copia el webhook secret y pégalo en la configuración
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Integration Tab */}
        {activeTab === 'integration' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Integración con el Proyecto Principal</h3>

            {/* Plan Mapping */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h4 className="text-lg font-medium text-white mb-4">Mapeo de Planes</h4>
              <p className="text-slate-400 text-sm mb-6">
                Los planes del Super Admin se conectan automáticamente con Stripe. Los usuarios del proyecto principal verán estos planes dinámicamente.
              </p>

              <div className="space-y-4">
                {plansWithStripeMapping.map((plan) => (
                  <div key={plan.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                    <div>
                      <h5 className="text-white font-medium">{plan.name}</h5>
                      <p className="text-slate-400 text-sm">{plan.description}</p>
                      <p className="text-cyan-400 text-sm font-medium">
                        ${plan.price}/mes • {plan.maxStores} tiendas • {plan.maxProducts} productos
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {plan.hasStripeMapping ? (
                        <span className="flex items-center gap-2 text-green-400 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Conectado
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-amber-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Auto-conecta
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* API Endpoints */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h4 className="text-lg font-medium text-white mb-4">Endpoints para el Proyecto Principal</h4>
              
              <div className="space-y-4">
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-white font-medium">Obtener Planes</h5>
                    <button
                      onClick={() => copyToClipboard(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-plans`)}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <code className="text-cyan-400 text-sm">
                    GET {import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-plans
                  </code>
                  <p className="text-slate-400 text-sm mt-2">
                    Obtiene todos los planes activos del Super Admin
                  </p>
                </div>

                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-white font-medium">Crear Sesión de Pago</h5>
                    <button
                      onClick={() => copyToClipboard(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-session`)}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <code className="text-cyan-400 text-sm">
                    POST {import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-session
                  </code>
                  <p className="text-slate-400 text-sm mt-2">
                    Crea una sesión de pago de Stripe para un plan específico
                  </p>
                </div>
              </div>
            </div>

            {/* Integration Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <h4 className="text-blue-400 font-medium mb-4">Instrucciones para el Proyecto Principal</h4>
              <div className="space-y-3 text-blue-300/80 text-sm">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium text-blue-300">Cargar Planes Dinámicamente</p>
                    <p>Usa el endpoint GET /get-plans para obtener todos los planes disponibles</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium text-blue-300">Mostrar Planes al Usuario</p>
                    <p>Renderiza los planes con sus características, precios y botones de compra</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-xs font-bold">3</span>
                  <div>
                    <p className="font-medium text-blue-300">Procesar Pago</p>
                    <p>Cuando el usuario haga clic en "Comprar", llama al endpoint POST /create-payment-session</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-xs font-bold">4</span>
                  <div>
                    <p className="font-medium text-blue-300">Redireccionar a Stripe</p>
                    <p>Usa la URL devuelta para redireccionar al usuario al checkout de Stripe</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-xs font-bold">5</span>
                  <div>
                    <p className="font-medium text-blue-300">Actualización Automática</p>
                    <p>Los webhooks actualizarán automáticamente el plan del usuario tras el pago exitoso</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Code Example */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h4 className="text-white font-medium mb-4">Ejemplo de Código para el Proyecto Principal</h4>
              <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-300">
{`// Cargar planes
const loadPlans = async () => {
  const response = await fetch('${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-plans');
  const data = await response.json();
  return data.plans;
};

// Crear sesión de pago
const handlePayment = async (planId, userEmail, userName) => {
  const response = await fetch('${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId,
      userEmail,
      userName,
      successUrl: window.location.origin + '/success',
      cancelUrl: window.location.origin + '/cancel'
    })
  });
  
  const data = await response.json();
  if (data.success) {
    window.location.href = data.url; // Redireccionar a Stripe
  }
};`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}