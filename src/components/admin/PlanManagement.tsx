import React, { useState } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Crown,
  RefreshCw,
  DollarSign,
  Users,
  Store,
  Package,
  Save,
  AlertTriangle,
  Star,
  Shield,
  Zap,
  Target,
  Link,
  ExternalLink,
  Sync,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useSuperAdmin } from '../../contexts/SuperAdminContext';
import { useToast } from '../../contexts/ToastContext';

interface PlanFormData {
  name: string;
  description: string;
  price: number;
  maxStores: number;
  maxProducts: number;
  maxCategories: number;
  features: string[];
  isActive: boolean;
  isFree: boolean;
  level: number;
  currency: string;
  interval: 'month' | 'year';
  stripeProductId?: string;
  stripePriceId?: string;
}

export default function PlanManagement() {
  const { 
    state, 
    createPlan, 
    updatePlan, 
    deletePlan, 
    loadPlans,
    syncPlanWithStripe,
    validateStripeIntegration
  } = useSuperAdmin();
  const { success, error } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingPlan, setSyncingPlan] = useState<string | null>(null);
  const [validatingPlan, setValidatingPlan] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<{ [key: string]: boolean }>({});
  
  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    description: '',
    price: 0,
    maxStores: 1,
    maxProducts: 10,
    maxCategories: 3,
    features: [],
    isActive: true,
    isFree: false,
    level: 1,
    currency: 'usd',
    interval: 'month'
  });

  const [newFeature, setNewFeature] = useState('');
  const [formErrors, setFormErrors] = useState<any>({});

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      maxStores: 1,
      maxProducts: 10,
      maxCategories: 3,
      features: [],
      isActive: true,
      isFree: false,
      level: 1,
      currency: 'usd',
      interval: 'month'
    });
    setNewFeature('');
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: any = {};

    if (!formData.name.trim()) {
      errors.name = 'El nombre del plan es requerido';
    }

    if (!formData.description.trim()) {
      errors.description = 'La descripción es requerida';
    }

    if (formData.price < 0) {
      errors.price = 'El precio no puede ser negativo';
    }

    if (formData.isFree && formData.price > 0) {
      errors.price = 'Los planes gratuitos deben tener precio 0';
    }

    if (!formData.isFree && formData.price === 0) {
      errors.price = 'Los planes de pago deben tener un precio mayor a 0';
    }

    if (formData.maxStores < 1) {
      errors.maxStores = 'Debe permitir al menos 1 tienda';
    }

    if (formData.maxProducts < 1) {
      errors.maxProducts = 'Debe permitir al menos 1 producto';
    }

    if (formData.maxCategories < 1) {
      errors.maxCategories = 'Debe permitir al menos 1 categoría';
    }

    if (formData.level < 1) {
      errors.level = 'El nivel debe ser al menos 1';
    }

    // Check for duplicate levels (except when editing the same plan)
    const existingPlanWithLevel = state.plans.find(p => 
      p.level === formData.level && 
      p.id !== editingPlan
    );
    if (existingPlanWithLevel) {
      errors.level = `Ya existe un plan con nivel ${formData.level}`;
    }

    // Check for duplicate free plans (except when editing the same plan)
    if (formData.isFree) {
      const existingFreePlan = state.plans.find(p => 
        p.isFree && 
        p.id !== editingPlan
      );
      if (existingFreePlan) {
        errors.isFree = 'Solo puede haber un plan gratuito';
      }
    }

    if (formData.features.length === 0) {
      errors.features = 'Debe agregar al menos una característica';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadPlans();
      success('Planes actualizados', 'La lista de planes se ha actualizado correctamente');
    } catch (err) {
      error('Error al actualizar', 'No se pudieron cargar los planes');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await createPlan(formData);
      setIsCreating(false);
      resetForm();
      success('Plan creado', 'El plan se ha creado correctamente y se sincronizó con Stripe automáticamente');
    } catch (err: any) {
      console.error('Error creating plan:', err);
      error('Error al crear plan', err.message || 'No se pudo crear el plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPlan = (plan: any) => {
    setEditingPlan(plan.id);
    setFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      maxStores: plan.maxStores,
      maxProducts: plan.maxProducts,
      maxCategories: plan.maxCategories,
      features: [...plan.features],
      isActive: plan.isActive,
      isFree: plan.isFree,
      level: plan.level,
      currency: plan.currency,
      interval: plan.interval,
      stripeProductId: plan.stripeProductId,
      stripePriceId: plan.stripePriceId
    });
    setIsCreating(true);
  };

  const handleUpdatePlan = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const planToUpdate = state.plans.find(p => p.id === editingPlan);
      if (!planToUpdate) throw new Error('Plan no encontrado');

      await updatePlan({
        ...planToUpdate,
        ...formData,
        updatedAt: new Date().toISOString()
      });
      
      setIsCreating(false);
      setEditingPlan(null);
      resetForm();
      success('Plan actualizado', 'El plan se ha actualizado correctamente y se sincronizó con Stripe');
    } catch (err: any) {
      console.error('Error updating plan:', err);
      error('Error al actualizar plan', err.message || 'No se pudo actualizar el plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el plan "${planName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await deletePlan(planId);
      success('Plan eliminado', 'El plan se ha eliminado correctamente');
    } catch (err: any) {
      console.error('Error deleting plan:', err);
      error('Error al eliminar plan', err.message || 'No se pudo eliminar el plan');
    }
  };

  const handleSyncWithStripe = async (planId: string) => {
    setSyncingPlan(planId);
    try {
      await syncPlanWithStripe(planId);
      success('Sincronización exitosa', 'El plan se ha sincronizado correctamente con Stripe');
      await loadPlans(); // Reload to get updated Stripe IDs
    } catch (err: any) {
      console.error('Error syncing plan:', err);
      error('Error de sincronización', err.message || 'No se pudo sincronizar el plan con Stripe');
    } finally {
      setSyncingPlan(null);
    }
  };

  const handleValidateStripeIntegration = async (planId: string) => {
    setValidatingPlan(planId);
    try {
      const isValid = await validateStripeIntegration(planId);
      setValidationResults(prev => ({ ...prev, [planId]: isValid }));
      
      if (isValid) {
        success('Integración válida', 'El plan está correctamente integrado con Stripe');
      } else {
        error('Integración inválida', 'Hay problemas con la integración de Stripe para este plan');
      }
    } catch (err: any) {
      console.error('Error validating plan:', err);
      error('Error de validación', err.message || 'No se pudo validar la integración');
    } finally {
      setValidatingPlan(null);
    }
  };

  const addFeature = () => {
    if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const getLevelIcon = (level: number) => {
    if (level === 1) return <Shield className="w-5 h-5 text-slate-400" />;
    if (level === 2) return <Star className="w-5 h-5 text-blue-400" />;
    if (level === 3) return <Crown className="w-5 h-5 text-purple-400" />;
    if (level >= 4) return <Zap className="w-5 h-5 text-yellow-400" />;
    return <Target className="w-5 h-5 text-cyan-400" />;
  };

  const getPlanTypeColor = (plan: any) => {
    if (plan.isFree) return 'border-slate-500 bg-slate-500/10';
    if (plan.level === 2) return 'border-blue-500 bg-blue-500/10';
    if (plan.level === 3) return 'border-purple-500 bg-purple-500/10';
    if (plan.level >= 4) return 'border-yellow-500 bg-yellow-500/10';
    return 'border-cyan-500 bg-cyan-500/10';
  };

  const getStripeIntegrationStatus = (plan: any) => {
    if (plan.isFree) {
      return { status: 'not-needed', icon: CheckCircle, color: 'text-green-400', text: 'No requiere Stripe' };
    }
    
    if (!plan.stripeProductId || !plan.stripePriceId) {
      return { status: 'missing', icon: XCircle, color: 'text-red-400', text: 'Sin integrar' };
    }
    
    if (validationResults[plan.id] === false) {
      return { status: 'invalid', icon: AlertCircle, color: 'text-yellow-400', text: 'Integración inválida' };
    }
    
    if (validationResults[plan.id] === true) {
      return { status: 'valid', icon: CheckCircle, color: 'text-green-400', text: 'Integrado correctamente' };
    }
    
    return { status: 'unknown', icon: AlertCircle, color: 'text-slate-400', text: 'Estado desconocido' };
  };

  // Sort plans by level
  const sortedPlans = [...state.plans].sort((a, b) => a.level - b.level);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 lg:px-8 py-4 lg:py-6 sticky top-0 z-40">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-white">Gestión de Planes</h1>
            <p className="text-slate-400 text-sm lg:text-base mt-1">
              Crea y administra los planes de suscripción con integración completa de Stripe.
            </p>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 lg:px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>
            
            <button
              onClick={() => {
                resetForm();
                setIsCreating(true);
                setEditingPlan(null);
              }}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-3 lg:px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Plan</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 lg:p-8 space-y-6">
        {/* Stripe Integration Info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Link className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-blue-400 font-medium text-sm">Integración con Stripe</h3>
              <p className="text-blue-300/80 text-sm mt-1">
                Los planes se sincronizan automáticamente con Stripe. Los planes gratuitos no requieren integración.
                Los planes de pago crean productos y precios en Stripe automáticamente.
              </p>
            </div>
          </div>
        </div>

        {/* Plans Grid - Mobile: 1 column, Desktop: 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {sortedPlans.map((plan) => {
            const stripeStatus = getStripeIntegrationStatus(plan);
            const StatusIcon = stripeStatus.icon;
            
            return (
              <div key={plan.id} className={`rounded-lg border-2 p-4 lg:p-6 ${getPlanTypeColor(plan)}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getLevelIcon(plan.level)}
                    <div>
                      <h3 className="text-lg lg:text-xl font-bold text-white">{plan.name}</h3>
                      <p className="text-slate-400 text-xs lg:text-sm mt-1">{plan.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {plan.isFree && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                        Gratis
                      </span>
                    )}
                    {plan.isActive ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">
                        Inactivo
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl lg:text-3xl font-bold text-white">
                      {plan.price === 0 ? 'Gratis' : `$${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-slate-400">
                        /{plan.interval === 'month' ? 'mes' : 'año'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Nivel {plan.level} • {plan.currency.toUpperCase()}
                  </div>
                </div>
                
                <div className="space-y-2 lg:space-y-3 mb-4 lg:mb-6">
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <Store className="w-4 h-4 text-cyan-400" />
                    <span>Tiendas: {plan.maxStores}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <Package className="w-4 h-4 text-cyan-400" />
                    <span>Productos: {plan.maxProducts}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>Categorías: {plan.maxCategories === 999999 ? 'Ilimitadas' : plan.maxCategories}</span>
                  </div>
                </div>

                {/* Stripe Integration Status */}
                <div className="mb-4 p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusIcon className={`w-4 h-4 ${stripeStatus.color}`} />
                    <span className={`text-sm font-medium ${stripeStatus.color}`}>
                      {stripeStatus.text}
                    </span>
                  </div>
                  
                  {!plan.isFree && (
                    <div className="space-y-1 text-xs text-slate-400">
                      {plan.stripeProductId && (
                        <div>Producto: {plan.stripeProductId.slice(0, 20)}...</div>
                      )}
                      {plan.stripePriceId && (
                        <div>Precio: {plan.stripePriceId.slice(0, 20)}...</div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2 mb-4 lg:mb-6">
                  <h4 className="text-sm font-medium text-slate-300">Características:</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs lg:text-sm text-slate-400">
                        <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      <span className="hidden lg:inline">Editar</span>
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id, plan.name)}
                      disabled={plan.isFree}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={plan.isFree ? 'No se puede eliminar el plan gratuito' : 'Eliminar plan'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stripe Actions */}
                  {!plan.isFree && state.stripeConfig && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSyncWithStripe(plan.id)}
                        disabled={syncingPlan === plan.id}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
                      >
                        <Sync className={`w-4 h-4 ${syncingPlan === plan.id ? 'animate-spin' : ''}`} />
                        <span className="hidden lg:inline">Sincronizar</span>
                      </button>
                      <button
                        onClick={() => handleValidateStripeIntegration(plan.id)}
                        disabled={validatingPlan === plan.id}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        title="Validar integración con Stripe"
                      >
                        <CheckCircle className={`w-4 h-4 ${validatingPlan === plan.id ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>
                  )}

                  {!plan.isFree && !state.stripeConfig && (
                    <div className="text-center p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-amber-400 text-xs">
                        Configura Stripe para habilitar la sincronización
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {state.plans.length === 0 && (
          <div className="text-center py-8 lg:py-12">
            <Crown className="w-12 h-12 lg:w-16 lg:h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-base lg:text-lg">No hay planes creados</p>
            <p className="text-slate-500 text-sm">Crea tu primer plan para comenzar</p>
          </div>
        )}
      </div>

      {/* Create/Edit Plan Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4 lg:mb-6">
                <h2 className="text-lg lg:text-xl font-bold text-white">
                  {editingPlan ? 'Editar Plan' : 'Crear Nuevo Plan'}
                </h2>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingPlan(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Nombre del Plan *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className={`w-full px-3 py-2 lg:py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm ${
                        formErrors.name ? 'border-red-500' : 'border-slate-600'
                      }`}
                      placeholder="Ej: Professional"
                    />
                    {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Precio ({formData.currency.toUpperCase()}/{formData.interval === 'month' ? 'mes' : 'año'}) *
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      className={`w-full px-3 py-2 lg:py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm ${
                        formErrors.price ? 'border-red-500' : 'border-slate-600'
                      }`}
                      placeholder="9.99"
                      step="0.01"
                      min="0"
                    />
                    {formErrors.price && <p className="text-red-400 text-xs mt-1">{formErrors.price}</p>}
                  </div>
                </div>
                
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Descripción *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className={`w-full px-3 py-2 lg:py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm ${
                      formErrors.description ? 'border-red-500' : 'border-slate-600'
                    }`}
                    rows={3}
                    placeholder="Descripción del plan..."
                  />
                  {formErrors.description && <p className="text-red-400 text-xs mt-1">{formErrors.description}</p>}
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Nivel *
                    </label>
                    <input
                      type="number"
                      value={formData.level}
                      onChange={(e) => setFormData(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))}
                      className={`w-full px-3 py-2 lg:py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm ${
                        formErrors.level ? 'border-red-500' : 'border-slate-600'
                      }`}
                      min="1"
                    />
                    {formErrors.level && <p className="text-red-400 text-xs mt-1">{formErrors.level}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Máx. Tiendas *
                    </label>
                    <input
                      type="number"
                      value={formData.maxStores}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxStores: parseInt(e.target.value) || 1 }))}
                      className={`w-full px-3 py-2 lg:py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm ${
                        formErrors.maxStores ? 'border-red-500' : 'border-slate-600'
                      }`}
                      min="1"
                    />
                    {formErrors.maxStores && <p className="text-red-400 text-xs mt-1">{formErrors.maxStores}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Máx. Productos *
                    </label>
                    <input
                      type="number"
                      value={formData.maxProducts}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxProducts: parseInt(e.target.value) || 10 }))}
                      className={`w-full px-3 py-2 lg:py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm ${
                        formErrors.maxProducts ? 'border-red-500' : 'border-slate-600'
                      }`}
                      min="1"
                    />
                    {formErrors.maxProducts && <p className="text-red-400 text-xs mt-1">{formErrors.maxProducts}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Máx. Categorías *
                    </label>
                    <input
                      type="number"
                      value={formData.maxCategories}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxCategories: parseInt(e.target.value) || 3 }))}
                      className={`w-full px-3 py-2 lg:py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm ${
                        formErrors.maxCategories ? 'border-red-500' : 'border-slate-600'
                      }`}
                      min="1"
                      placeholder="999999 para ilimitadas"
                    />
                    {formErrors.maxCategories && <p className="text-red-400 text-xs mt-1">{formErrors.maxCategories}</p>}
                  </div>
                </div>

                {/* Stripe Configuration */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Moneda
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 lg:py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    >
                      <option value="usd">USD - Dólar Estadounidense</option>
                      <option value="eur">EUR - Euro</option>
                      <option value="gbp">GBP - Libra Esterlina</option>
                      <option value="mxn">MXN - Peso Mexicano</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Intervalo de Facturación
                    </label>
                    <select
                      value={formData.interval}
                      onChange={(e) => setFormData(prev => ({ ...prev, interval: e.target.value as 'month' | 'year' }))}
                      className="w-full px-3 py-2 lg:py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    >
                      <option value="month">Mensual</option>
                      <option value="year">Anual</option>
                    </select>
                  </div>
                </div>

                {/* Stripe IDs (Read-only for editing) */}
                {editingPlan && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">
                        Stripe Product ID
                      </label>
                      <input
                        type="text"
                        value={formData.stripeProductId || ''}
                        readOnly
                        className="w-full px-3 py-2 lg:py-3 bg-slate-600 border border-slate-500 rounded-lg text-slate-300 text-sm"
                        placeholder="Se genera automáticamente"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">
                        Stripe Price ID
                      </label>
                      <input
                        type="text"
                        value={formData.stripePriceId || ''}
                        readOnly
                        className="w-full px-3 py-2 lg:py-3 bg-slate-600 border border-slate-500 rounded-lg text-slate-300 text-sm"
                        placeholder="Se genera automáticamente"
                      />
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Características *
                  </label>
                  <div className="space-y-2">
                    {formData.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="flex-1 text-slate-300 text-sm">{feature}</span>
                        <button
                          onClick={() => removeFeature(index)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newFeature}
                        onChange={(e) => setNewFeature(e.target.value)}
                        placeholder="Nueva característica..."
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addFeature();
                          }
                        }}
                      />
                      <button
                        onClick={addFeature}
                        className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {formErrors.features && <p className="text-red-400 text-xs mt-1">{formErrors.features}</p>}
                </div>

                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                    />
                    <label htmlFor="isActive" className="text-slate-300 text-sm">
                      Plan activo
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isFree"
                      checked={formData.isFree}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        isFree: e.target.checked,
                        price: e.target.checked ? 0 : prev.price
                      }))}
                      className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                    />
                    <label htmlFor="isFree" className="text-slate-300 text-sm">
                      Plan gratuito
                    </label>
                    {formErrors.isFree && <p className="text-red-400 text-xs">{formErrors.isFree}</p>}
                  </div>
                </div>

                {formData.isFree && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-amber-300 text-xs">
                        Solo puede haber un plan gratuito. Este será el plan por defecto para nuevos usuarios.
                        Los planes gratuitos no se sincronizan con Stripe.
                      </p>
                    </div>
                  </div>
                )}

                {!formData.isFree && state.stripeConfig && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Link className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-blue-300 text-xs">
                        Este plan se sincronizará automáticamente con Stripe al guardarlo.
                        Se crearán el producto y precio correspondientes en tu cuenta de Stripe.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingPlan(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 lg:py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingPlan ? handleUpdatePlan : handleCreatePlan}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 lg:py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {editingPlan ? 'Actualizando...' : 'Creando...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingPlan ? 'Actualizar Plan' : 'Crear Plan'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}