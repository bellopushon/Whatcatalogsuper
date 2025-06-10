import React from 'react';
import { Users, Crown, Activity, TrendingUp, UserCheck, UserX, DollarSign, Calendar, ArrowUpRight, ArrowDownRight, BarChart3, PieChart, Zap, Shield, Target, Star, Download, MoreHorizontal, Globe, Smartphone, Monitor, Chrome, Siren as Firefox } from 'lucide-react';
import { useSuperAdmin } from '../../contexts/SuperAdminContext';

export default function Dashboard() {
  const { state } = useSuperAdmin();

  // Calcular estadísticas reales
  const totalUsers = state.users.length;
  const activeUsers = state.users.filter(u => u.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;
  const paidUsers = state.users.filter(u => {
    const plan = state.plans.find(p => p.id === u.plan);
    return plan && !plan.isFree;
  }).length;
  
  const recentUsers = state.users.filter(u => {
    const userDate = new Date(u.createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return userDate > weekAgo;
  }).length;

  // Distribución por planes - FIXED
  const planDistribution = state.plans.map(plan => {
    const userCount = state.users.filter(u => u.plan === plan.id).length;
    return {
      ...plan,
      userCount
    };
  });

  // Ingresos estimados mensuales
  const monthlyRevenue = state.users.reduce((total, user) => {
    const plan = state.plans.find(p => p.id === user.plan);
    return total + (plan?.price || 0);
  }, 0);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'text-green-400';
    if (action.includes('delete') || action.includes('remove')) return 'text-red-400';
    if (action.includes('edit') || action.includes('update')) return 'text-blue-400';
    if (action.includes('login') || action.includes('logout')) return 'text-purple-400';
    return 'text-slate-300';
  };

  const getPlanIcon = (level: number) => {
    if (level === 1) return <Shield className="w-5 h-5 text-slate-400" />;
    if (level === 2) return <Star className="w-5 h-5 text-blue-400" />;
    if (level === 3) return <Crown className="w-5 h-5 text-purple-400" />;
    if (level >= 4) return <Zap className="w-5 h-5 text-yellow-400" />;
    return <Target className="w-5 h-5 text-cyan-400" />;
  };

  const getPlanColor = (level: number) => {
    if (level === 1) return 'from-slate-500 to-slate-600';
    if (level === 2) return 'from-blue-500 to-blue-600';
    if (level === 3) return 'from-purple-500 to-purple-600';
    if (level >= 4) return 'from-yellow-500 to-yellow-600';
    return 'from-cyan-500 to-cyan-600';
  };

  // Sort plans by level
  const sortedPlans = [...planDistribution].sort((a, b) => a.level - b.level);

  return (
    <div className="min-h-screen bg-slate-900 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
              Panel de Control
            </h1>
            <p className="text-slate-400">
              Bienvenido de vuelta, <span className="text-cyan-400 font-medium">{state.user?.name}</span>. 
              Aquí tienes un resumen completo de la plataforma.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <select className="bg-slate-800 border border-slate-600 text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
              <option>Últimos 10 días</option>
              <option>Últimos 30 días</option>
              <option>Últimos 90 días</option>
            </select>
            
            <button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Total Users */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total de Usuarios</p>
                <p className="text-3xl font-bold text-white mt-1">{totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-green-400">
                +{recentUsers} esta semana
              </span>
            </div>
          </div>

          {/* Active Users */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm font-medium">Usuarios Activos</p>
                <p className="text-3xl font-bold text-white mt-1">{activeUsers}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-green-400">
                {totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}% del total
              </span>
            </div>
          </div>

          {/* Premium Users */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm font-medium">Usuarios Premium</p>
                <p className="text-3xl font-bold text-white mt-1">{paidUsers}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Crown className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-purple-400">
                {totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100) : 0}% conversión
              </span>
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm font-medium">Ingresos Mensuales</p>
                <p className="text-3xl font-bold text-white mt-1">${monthlyRevenue.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-green-400">
                Estimado actual
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Plan Distribution - FIXED */}
          <div className="xl:col-span-2">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Distribución por Planes</h3>
                <div className="text-sm text-slate-400">
                  {totalUsers} usuarios totales
                </div>
              </div>
              
              {sortedPlans.length > 0 ? (
                <div className="space-y-4">
                  {sortedPlans.map((plan) => {
                    const percentage = totalUsers > 0 ? (plan.userCount / totalUsers) * 100 : 0;
                    
                    return (
                      <div key={plan.id} className="bg-slate-700/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {getPlanIcon(plan.level)}
                            <div>
                              <h4 className="text-white font-medium">{plan.name}</h4>
                              {plan.isFree && (
                                <span className="text-xs text-green-400">Gratis</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-white">{plan.userCount}</span>
                            <span className="text-slate-400 text-sm ml-1">usuarios</span>
                          </div>
                        </div>
                        
                        <div className="w-full bg-slate-600 rounded-full h-2 mb-2">
                          <div
                            className={`h-2 rounded-full bg-gradient-to-r ${getPlanColor(plan.level)}`}
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">{percentage.toFixed(1)}% del total</span>
                          <span className="text-slate-400">${(plan.userCount * plan.price).toFixed(2)}/mes</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Crown className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No hay planes configurados</p>
                  <p className="text-slate-500 text-sm">Configura planes para ver la distribución</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity - FIXED */}
          <div className="xl:col-span-1">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Actividad Reciente</h3>
                <MoreHorizontal className="w-5 h-5 text-slate-400" />
              </div>
              
              <div className="space-y-4">
                {state.systemLogs && state.systemLogs.length > 0 ? (
                  state.systemLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${getActionColor(log.action)}`}>
                          {log.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDate(log.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No hay actividad reciente</p>
                    <p className="text-slate-500 text-sm">Los logs aparecerán aquí</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-2">Acciones Rápidas</h3>
            <p className="text-slate-400 text-sm">
              Gestiona la plataforma desde aquí
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-700/50 rounded-xl p-6 hover:bg-slate-700 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-lg mb-1 text-white">Gestionar Usuarios</h4>
                <p className="text-slate-400 text-sm mb-3">Ver y editar usuarios</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{totalUsers}</span>
                  <span className="text-slate-400 text-sm">usuarios</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-700/50 rounded-xl p-6 hover:bg-slate-700 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Crown className="w-6 h-6 text-purple-400" />
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-lg mb-1 text-white">Gestionar Planes</h4>
                <p className="text-slate-400 text-sm mb-3">Crear y editar planes</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{state.plans.length}</span>
                  <span className="text-slate-400 text-sm">planes</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-700/50 rounded-xl p-6 hover:bg-slate-700 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-400" />
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-lg mb-1 text-white">Ver Logs</h4>
                <p className="text-slate-400 text-sm mb-3">Historial del sistema</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{state.systemLogs?.length || 0}</span>
                  <span className="text-slate-400 text-sm">eventos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}