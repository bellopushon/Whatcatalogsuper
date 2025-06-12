import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  RefreshCw, 
  UserPlus, 
  MoreVertical,
  Crown,
  CheckCircle,
  XCircle,
  Calendar,
  Mail,
  Phone,
  Building,
  MapPin,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Grid,
  List,
  Shield,
  Save,
  X,
  Edit,
  AlertTriangle,
  Wrench,
  CreditCard,
  ExternalLink
} from 'lucide-react';
import { useSuperAdmin } from '../../contexts/SuperAdminContext';
import { useToast } from '../../contexts/ToastContext';

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  phone: string;
  company: string;
  location: string;
  plan: string;
  isActive: boolean;
}

interface EditUserForm {
  name: string;
  email: string;
  password: string;
  phone: string;
  company: string;
  location: string;
  plan: string;
  isActive: boolean;
}

export default function UserManagement() {
  const { 
    state, 
    updateUserPlan, 
    toggleUserStatus, 
    loadUsers, 
    createUser, 
    updateUser, 
    fixUserStripeCustomer 
  } = useSuperAdmin();
  const { success, error } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlanFilter, setSelectedPlanFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [fixingUser, setFixingUser] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 8;
  
  // Dropdown positioning
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [dropdownPositions, setDropdownPositions] = useState<{ [key: string]: { top?: number; bottom?: number; left?: number; right?: number } }>({});
  
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    name: '',
    email: '',
    password: '',
    phone: '',
    company: '',
    location: '',
    plan: '',
    isActive: true
  });

  const [editForm, setEditForm] = useState<EditUserForm>({
    name: '',
    email: '',
    password: '',
    phone: '',
    company: '',
    location: '',
    plan: '',
    isActive: true
  });

  const [formErrors, setFormErrors] = useState<any>({});
  const [showPassword, setShowPassword] = useState(false);

  // Initialize default plan
  useEffect(() => {
    if (state.plans.length > 0 && !createForm.plan) {
      const freePlan = state.plans.find(p => p.isFree);
      if (freePlan) {
        setCreateForm(prev => ({ ...prev, plan: freePlan.id }));
      }
    }
  }, [state.plans, createForm.plan]);

  // Filter users based on search and filters
  const filteredUsers = state.users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = selectedPlanFilter === 'all' || user.plan === selectedPlanFilter;
    const matchesStatus = selectedStatusFilter === 'all' || 
                         (selectedStatusFilter === 'active' && user.isActive) ||
                         (selectedStatusFilter === 'inactive' && !user.isActive);
    
    return matchesSearch && matchesPlan && matchesStatus;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedPlanFilter, selectedStatusFilter]);

  // Smart dropdown positioning for mobile and desktop
  const calculateDropdownPosition = (userId: string, buttonElement: HTMLButtonElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const dropdownHeight = 300; // Increased for new portal option
    const dropdownWidth = 200;
    
    let position: { top?: number; bottom?: number; left?: number; right?: number } = {};
    
    // Mobile-first approach
    if (viewportWidth < 768) {
      // On mobile, center the dropdown or position it optimally
      const spaceRight = viewportWidth - rect.right;
      const spaceLeft = rect.left;
      
      if (spaceRight >= dropdownWidth) {
        // Position to the right of button
        position.left = rect.right + 8;
      } else if (spaceLeft >= dropdownWidth) {
        // Position to the left of button
        position.right = viewportWidth - rect.left + 8;
      } else {
        // Center on screen with margin
        position.left = 16;
        position.right = 16;
      }
      
      // Vertical positioning
      if (rect.bottom + dropdownHeight <= viewportHeight) {
        position.top = rect.bottom + 4;
      } else {
        position.bottom = viewportHeight - rect.top + 4;
      }
    } else {
      // Desktop positioning
      position.right = viewportWidth - rect.right + 8;
      
      if (rect.bottom + dropdownHeight <= viewportHeight) {
        position.top = rect.bottom + 4;
      } else {
        position.bottom = viewportHeight - rect.top + 4;
      }
    }
    
    setDropdownPositions(prev => ({
      ...prev,
      [userId]: position
    }));
  };

  const handleDropdownToggle = (userId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    
    if (openDropdown === userId) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown(userId);
      calculateDropdownPosition(userId, event.currentTarget);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown && !Object.values(dropdownRefs.current).some(ref => 
        ref?.contains(event.target as Node)
      )) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadUsers();
      success('Usuarios actualizados', 'La lista de usuarios se ha actualizado correctamente');
    } catch (err) {
      error('Error al actualizar', 'No se pudieron cargar los usuarios');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePlanChange = async (userId: string, newPlan: string) => {
    try {
      console.log(`🔄 Changing plan for user ${userId} to ${newPlan}`);
      
      const planExists = state.plans.find(p => p.id === newPlan);
      if (!planExists) {
        throw new Error(`Plan "${newPlan}" no existe`);
      }

      await updateUserPlan(userId, newPlan);
      setOpenDropdown(null);
      success('Plan actualizado', 'El plan del usuario se ha actualizado correctamente');
    } catch (err: any) {
      console.error('Error updating plan:', err);
      error('Error al actualizar plan', err.message || 'No se pudo actualizar el plan del usuario');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      await toggleUserStatus(userId);
      setOpenDropdown(null);
      success('Estado actualizado', 'El estado del usuario se ha actualizado correctamente');
    } catch (err: any) {
      console.error('Error toggling status:', err);
      error('Error al cambiar estado', err.message || 'No se pudo cambiar el estado del usuario');
    }
  };

  const handleFixUserStripe = async (userId: string) => {
    setFixingUser(userId);
    try {
      await fixUserStripeCustomer(userId);
      setOpenDropdown(null);
      success('Usuario corregido', 'Se ha corregido la información de Stripe del usuario');
    } catch (err: any) {
      console.error('Error fixing user Stripe:', err);
      error('Error al corregir usuario', err.message || 'No se pudo corregir la información de Stripe');
    } finally {
      setFixingUser(null);
    }
  };

  const handleOpenStripePortal = async (userId: string) => {
    setOpeningPortal(userId);
    try {
      const user = state.users.find(u => u.id === userId);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({
          userId: userId,
          returnUrl: window.location.href
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Open Stripe portal in new tab
        window.open(data.url, '_blank');
        setOpenDropdown(null);
        success('Portal abierto', 'Se ha abierto el portal de Stripe en una nueva pestaña');
      } else {
        throw new Error(data.error || 'Error al crear sesión del portal');
      }
    } catch (err: any) {
      console.error('Error opening Stripe portal:', err);
      error('Error al abrir portal', err.message || 'No se pudo abrir el portal de Stripe');
    } finally {
      setOpeningPortal(null);
    }
  };

  const validateCreateForm = () => {
    const errors: any = {};

    if (!createForm.name.trim()) {
      errors.name = 'El nombre es requerido';
    }

    if (!createForm.email.trim()) {
      errors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(createForm.email)) {
      errors.email = 'El email no es válido';
    }

    if (!createForm.password) {
      errors.password = 'La contraseña es requerida';
    } else if (createForm.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    const emailExists = state.users.find(u => u.email.toLowerCase() === createForm.email.toLowerCase());
    if (emailExists) {
      errors.email = 'Este email ya está registrado';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateEditForm = () => {
    const errors: any = {};

    if (!editForm.name.trim()) {
      errors.name = 'El nombre es requerido';
    }

    if (!editForm.email.trim()) {
      errors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(editForm.email)) {
      errors.email = 'El email no es válido';
    }

    if (editForm.password && editForm.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    // Check if email exists for other users
    const emailExists = state.users.find(u => 
      u.email.toLowerCase() === editForm.email.toLowerCase() && 
      u.id !== editingUser
    );
    if (emailExists) {
      errors.email = 'Este email ya está registrado';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = async () => {
    if (!validateCreateForm()) return;

    setIsSubmitting(true);
    try {
      await createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        phone: createForm.phone.trim() || undefined,
        company: createForm.company.trim() || undefined,
        location: createForm.location.trim() || undefined,
        plan: createForm.plan,
        isActive: createForm.isActive
      });

      setIsCreatingUser(false);
      resetCreateForm();
      success('Usuario creado', 'El usuario se ha creado correctamente');
    } catch (err: any) {
      console.error('Error creating user:', err);
      error('Error al crear usuario', err.message || 'No se pudo crear el usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password
      phone: user.phone || '',
      company: user.company || '',
      location: user.location || '',
      plan: user.plan,
      isActive: user.isActive
    });
    setIsCreatingUser(true); // Reuse the same modal
  };

  const handleUpdateUser = async () => {
    if (!validateEditForm()) return;

    setIsSubmitting(true);
    try {
      const updateData: any = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || undefined,
        company: editForm.company.trim() || undefined,
        location: editForm.location.trim() || undefined,
        plan: editForm.plan,
        isActive: editForm.isActive
      };

      // Only include password if it's provided
      if (editForm.password) {
        updateData.password = editForm.password;
      }

      await updateUser(editingUser!, updateData);

      setIsCreatingUser(false);
      setEditingUser(null);
      resetEditForm();
      success('Usuario actualizado', 'El usuario se ha actualizado correctamente');
    } catch (err: any) {
      console.error('Error updating user:', err);
      error('Error al actualizar usuario', err.message || 'No se pudo actualizar el usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    const freePlan = state.plans.find(p => p.isFree);
    setCreateForm({
      name: '',
      email: '',
      password: '',
      phone: '',
      company: '',
      location: '',
      plan: freePlan?.id || '',
      isActive: true
    });
    setFormErrors({});
  };

  const resetEditForm = () => {
    setEditForm({
      name: '',
      email: '',
      password: '',
      phone: '',
      company: '',
      location: '',
      plan: '',
      isActive: true
    });
    setFormErrors({});
  };

  const getPlanBadge = (planId: string) => {
    const plan = state.plans.find(p => p.id === planId);
    
    if (!plan) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          Plan Desconocido
        </span>
      );
    }

    let colorClass = 'bg-gray-100 text-gray-700';
    
    if (plan.isFree) {
      colorClass = 'bg-gray-100 text-gray-700';
    } else if (plan.level === 2) {
      colorClass = 'bg-blue-100 text-blue-700';
    } else if (plan.level >= 3) {
      colorClass = 'bg-purple-100 text-purple-700';
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {plan.name}
      </span>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const sortedPlans = [...state.plans].sort((a, b) => a.level - b.level);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setOpenDropdown(null);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
        <div className="flex justify-between flex-1 sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
        
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Mostrando <span className="font-medium">{startIndex + 1}</span> a{' '}
              <span className="font-medium">{Math.min(endIndex, filteredUsers.length)}</span> de{' '}
              <span className="font-medium">{filteredUsers.length}</span> resultados
            </p>
          </div>
          
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              {pages.map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                    page === currentPage
                      ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  const currentForm = editingUser ? editForm : createForm;
  const setCurrentForm = editingUser ? setEditForm : setCreateForm;

  const needsStripeCustomerFix = (user: any) => {
    const userPlan = state.plans.find(p => p.id === user.plan);
    return userPlan && !userPlan.isFree && !user.stripeCustomerId;
  };

  const canOpenStripePortal = (user: any) => {
    const userPlan = state.plans.find(p => p.id === user.plan);
    return userPlan && !userPlan.isFree && user.stripeCustomerId && state.stripeConfig;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Mobile Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          {/* Top Row: Title + Add Button */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Users</h1>
                <p className="text-xs text-gray-500">{filteredUsers.length} of {state.users.length}</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                resetCreateForm();
                setEditingUser(null);
                setIsCreatingUser(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-2">
            <select
              value={selectedPlanFilter}
              onChange={(e) => setSelectedPlanFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
            >
              <option value="all">All Plans</option>
              {sortedPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <div className="flex border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {viewMode === 'list' ? (
          /* Mobile-First List View */
          <div className="space-y-3">
            {currentUsers.map((user) => (
              <div key={user.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  {/* User Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                        {getInitials(user.name)}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">{user.name}</h3>
                        {user.isSuperAdmin && (
                          <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        )}
                        {needsStripeCustomerFix(user) && (
                          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" title="Necesita corrección de Stripe" />
                        )}
                        {canOpenStripePortal(user) && (
                          <CreditCard className="w-4 h-4 text-blue-500 flex-shrink-0" title="Puede acceder al portal de Stripe" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        {user.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 flex-shrink-0">
                            Inactive
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getPlanBadge(user.plan)}
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {user.isSuperAdmin ? 'Super Admin' : 'User'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Button */}
                  <button
                    onClick={(e) => handleDropdownToggle(user.id, e)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-lg border border-gray-200 mt-4">
                {renderPagination()}
              </div>
            )}
          </div>
        ) : (
          /* Grid View */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentUsers.map((user) => (
                <div key={user.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                          {getInitials(user.name)}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate">{user.name}</h3>
                          {user.isSuperAdmin && (
                            <Crown className="w-4 h-4 text-yellow-500" />
                          )}
                          {needsStripeCustomerFix(user) && (
                            <AlertTriangle className="w-4 h-4 text-amber-500" title="Necesita corrección de Stripe" />
                          )}
                          {canOpenStripePortal(user) && (
                            <CreditCard className="w-4 h-4 text-blue-500" title="Puede acceder al portal de Stripe" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => handleDropdownToggle(user.id, e)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {getPlanBadge(user.plan)}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Estado:</span>
                      {user.isActive ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500">
                      Registrado: {formatDate(user.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grid Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 bg-white rounded-lg border border-gray-200">
                {renderPagination()}
              </div>
            )}
          </>
        )}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron usuarios</h3>
            <p className="text-gray-500">
              {searchTerm || selectedPlanFilter !== 'all' || selectedStatusFilter !== 'all'
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Los usuarios aparecerán aquí cuando se registren'
              }
            </p>
          </div>
        )}
      </div>

      {/* Smart Dropdown Portal - Mobile Optimized */}
      {openDropdown && (
        <div 
          ref={(el) => dropdownRefs.current[openDropdown] = el}
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[9999] min-w-[200px] max-w-[calc(100vw-32px)]"
          style={{
            top: dropdownPositions[openDropdown]?.top,
            bottom: dropdownPositions[openDropdown]?.bottom,
            left: dropdownPositions[openDropdown]?.left,
            right: dropdownPositions[openDropdown]?.right,
          }}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Cambiar Plan:</p>
            <div className="space-y-1">
              {sortedPlans.map((plan) => {
                const user = state.users.find(u => u.id === openDropdown);
                return (
                  <button
                    key={plan.id}
                    onClick={() => handlePlanChange(openDropdown, plan.id)}
                    className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                      user?.plan === plan.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {plan.name} {plan.isFree && '(Gratis)'}
                  </button>
                );
              })}
            </div>
          </div>
          
          <button
            onClick={() => {
              const user = state.users.find(u => u.id === openDropdown);
              if (user) {
                handleEditUser(user);
                setOpenDropdown(null);
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Editar Usuario
          </button>

          {/* Stripe Portal option */}
          {(() => {
            const user = state.users.find(u => u.id === openDropdown);
            return user && canOpenStripePortal(user) && (
              <button
                onClick={() => handleOpenStripePortal(openDropdown)}
                disabled={openingPortal === openDropdown}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                <CreditCard className={`w-4 h-4 ${openingPortal === openDropdown ? 'animate-pulse' : ''}`} />
                <span className="flex-1">Portal de Stripe</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            );
          })()}

          {/* Fix Stripe Customer option */}
          {(() => {
            const user = state.users.find(u => u.id === openDropdown);
            return user && needsStripeCustomerFix(user) && (
              <button
                onClick={() => handleFixUserStripe(openDropdown)}
                disabled={fixingUser === openDropdown}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
              >
                <Wrench className={`w-4 h-4 ${fixingUser === openDropdown ? 'animate-pulse' : ''}`} />
                Corregir Stripe
              </button>
            );
          })()}
          
          <button
            onClick={() => handleToggleStatus(openDropdown)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Shield className="w-4 h-4" />
            {state.users.find(u => u.id === openDropdown)?.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      )}

      {/* Create/Edit User Modal */}
      {isCreatingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingUser ? 'Editar Usuario' : 'Crear Usuario'}
                </h2>
                <button
                  onClick={() => {
                    setIsCreatingUser(false);
                    setEditingUser(null);
                    resetCreateForm();
                    resetEditForm();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={currentForm.name}
                    onChange={(e) => setCurrentForm(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Juan Pérez"
                  />
                  {formErrors.name && <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={currentForm.email}
                    onChange={(e) => setCurrentForm(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="juan@ejemplo.com"
                  />
                  {formErrors.email && <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña {editingUser ? '(dejar vacío para no cambiar)' : '*'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={currentForm.password}
                      onChange={(e) => setCurrentForm(prev => ({ ...prev, password: e.target.value }))}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.password ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder={editingUser ? "Dejar vacío para no cambiar" : "Mínimo 6 caracteres"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {formErrors.password && <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={currentForm.phone}
                      onChange={(e) => setCurrentForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+1234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Plan
                    </label>
                    <select
                      value={currentForm.plan}
                      onChange={(e) => setCurrentForm(prev => ({ ...prev, plan: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {sortedPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} {plan.isFree && '(Gratis)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Empresa
                  </label>
                  <input
                    type="text"
                    value={currentForm.company}
                    onChange={(e) => setCurrentForm(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre de la empresa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ubicación
                  </label>
                  <input
                    type="text"
                    value={currentForm.location}
                    onChange={(e) => setCurrentForm(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ciudad, País"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={currentForm.isActive}
                    onChange={(e) => setCurrentForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">
                    Usuario activo
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsCreatingUser(false);
                    setEditingUser(null);
                    resetCreateForm();
                    resetEditForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingUser ? handleUpdateUser : handleCreateUser}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {editingUser ? 'Actualizando...' : 'Creando...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
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