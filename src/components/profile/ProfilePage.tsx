import React, { useState, useRef } from 'react';
import { Upload, Camera, Save, Lock, Eye, EyeOff, User, Mail, Phone, Calendar, MapPin, Building } from 'lucide-react';
import { useStore } from '../../contexts/StoreContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';

export default function ProfilePage() {
  const { state, dispatch } = useStore();
  const user = state.user;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState('personal');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
    company: user?.company || '',
    location: user?.location || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        error('Error de archivo', 'La imagen debe ser menor a 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        error('Error de archivo', 'Por favor selecciona un archivo de imagen válido');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({ ...prev, avatar: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validatePersonalForm = () => {
    const newErrors: any = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    if (formData.phone && !/^\+?[1-9]\d{1,14}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'El número de teléfono no es válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const newErrors: any = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'La contraseña actual es requerida';
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = 'La nueva contraseña es requerida';
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'La contraseña debe tener al menos 6 caracteres';
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePersonalForm()) return;

    setIsSaving(true);

    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        throw new Error('No user found');
      }

      // Update user profile in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: formData.name.trim(),
          phone: formData.phone.trim() || null,
          bio: formData.bio.trim() || null,
          avatar: formData.avatar || null,
          company: formData.company.trim() || null,
          location: formData.location.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (updateError) {
        throw updateError;
      }

      // Update email if changed
      if (formData.email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email.trim()
        });

        if (emailError) {
          throw emailError;
        }
      }

      // Update local state
      const updatedUser = {
        ...user!,
        ...formData,
        updatedAt: new Date().toISOString(),
      };

      dispatch({ type: 'SET_USER', payload: updatedUser });
      success('¡Perfil actualizado!', 'Los cambios se han guardado correctamente');
    } catch (err) {
      console.error('Error updating profile:', err);
      error('Error al actualizar', 'No se pudo actualizar el perfil. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) return;

    setIsSaving(true);

    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (passwordError) {
        throw passwordError;
      }

      success('¡Contraseña actualizada!', 'Tu contraseña se ha cambiado correctamente');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Error updating password:', err);
      error('Error al actualizar', 'No se pudo cambiar la contraseña. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const tabs = [
    { id: 'personal', label: 'Información Personal', icon: User },
    { id: 'security', label: 'Seguridad', icon: Lock },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 admin-dark:text-white">Mi Perfil</h1>
        <p className="text-gray-600 admin-dark:text-gray-300 mt-1">Gestiona tu información personal y configuración de seguridad</p>
      </div>

      {/* Profile Header */}
      <div className="bg-white admin-dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 admin-dark:border-gray-700 p-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            {formData.avatar ? (
              <img
                src={formData.avatar}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {getInitials(formData.name || 'U')}
              </div>
            )}
            
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-lg"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 admin-dark:text-white">{formData.name || 'Usuario'}</h2>
            <p className="text-gray-600 admin-dark:text-gray-300">{formData.email}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                user?.plan === 'profesional' 
                  ? 'bg-purple-100 text-purple-800 admin-dark:bg-purple-900 admin-dark:text-purple-200'
                  : user?.plan === 'emprendedor'
                  ? 'bg-blue-100 text-blue-800 admin-dark:bg-blue-900 admin-dark:text-blue-200' 
                  : 'bg-gray-100 text-gray-600 admin-dark:bg-gray-700 admin-dark:text-gray-300'
              }`}>
                Plan {user?.plan === 'profesional' ? 'Profesional' : user?.plan === 'emprendedor' ? 'Emprendedor' : 'Gratis'}
              </span>
              
              {user?.createdAt && (
                <div className="flex items-center gap-1 text-sm text-gray-500 admin-dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  Miembro desde {new Date(user.createdAt).toLocaleDateString('es-ES', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              )}
            </div>
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white admin-dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 admin-dark:border-gray-700">
        <div className="border-b border-gray-200 admin-dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 admin-dark:text-indigo-400'
                    : 'border-transparent text-gray-500 admin-dark:text-gray-400 hover:text-gray-700 admin-dark:hover:text-gray-300 hover:border-gray-300 admin-dark:hover:border-gray-600'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'personal' && (
            <form onSubmit={handlePersonalSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 admin-dark:text-gray-300 mb-2">
                    Nombre completo *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent admin-dark:bg-gray-700 admin-dark:border-gray-600 admin-dark:text-white admin-dark:placeholder-gray-400 ${
                        errors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Tu nombre completo"
                    />
                  </div>
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 admin-dark:text-gray-300 mb-2">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent admin-dark:bg-gray-700 admin-dark:border-gray-600 admin-dark:text-white admin-dark:placeholder-gray-400 ${
                        errors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="tu@email.com"
                    />
                  </div>
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 admin-dark:text-gray-300 mb-2">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent admin-dark:bg-gray-700 admin-dark:border-gray-600 admin-dark:text-white admin-dark:placeholder-gray-400 ${
                        errors.phone ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="+1234567890"
                    />
                  </div>
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 admin-dark:text-gray-300 mb-2">
                    Empresa
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 admin-dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent admin-dark:bg-gray-700 admin-dark:text-white admin-dark:placeholder-gray-400"
                      placeholder="Nombre de tu empresa"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 admin-dark:text-gray-300 mb-2">
                    Ubicación
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 admin-dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent admin-dark:bg-gray-700 admin-dark:text-white admin-dark:placeholder-gray-400"
                      placeholder="Ciudad, País"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 admin-dark:text-gray-300 mb-2">
                    Biografía
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    rows={4}
                    maxLength={200}
                    className="w-full px-4 py-3 border border-gray-300 admin-dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent admin-dark:bg-gray-700 admin-dark:text-white admin-dark:placeholder-gray-400"
                    placeholder="Cuéntanos un poco sobre ti..."
                  />
                  <p className="text-xs text-gray-500 admin-dark:text-gray-400 mt-1">
                    {formData.bio.length}/200 caracteres
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="max-w-md space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 admin-dark:text-gray-300 mb-2">
                    Contraseña actual *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent admin-dark:bg-gray-700 admin-dark:border-gray-600 admin-dark:text-white admin-dark:placeholder-gray-400 ${
                        errors.currentPassword ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Tu contraseña actual"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 admin-dark:hover:text-gray-300"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.currentPassword && <p className="text-red-500 text-sm mt-1">{errors.currentPassword}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 admin-dark:text-gray-300 mb-2">
                    Nueva contraseña *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent admin-dark:bg-gray-700 admin-dark:border-gray-600 admin-dark:text-white admin-dark:placeholder-gray-400 ${
                        errors.newPassword ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Tu nueva contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 admin-dark:hover:text-gray-300"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.newPassword && <p className="text-red-500 text-sm mt-1">{errors.newPassword}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 admin-dark:text-gray-300 mb-2">
                    Confirmar nueva contraseña *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent admin-dark:bg-gray-700 admin-dark:border-gray-600 admin-dark:text-white admin-dark:placeholder-gray-400 ${
                        errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Confirma tu nueva contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 admin-dark:hover:text-gray-300"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-400 mb-2">Consejos de seguridad:</h4>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <li>• Usa al menos 8 caracteres</li>
                  <li>• Incluye mayúsculas, minúsculas y números</li>
                  <li>• Evita información personal obvia</li>
                  <li>• No reutilices contraseñas de otras cuentas</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Actualizar Contraseña
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
