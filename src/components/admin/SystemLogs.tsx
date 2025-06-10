import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar,
  User,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Clock,
  Globe
} from 'lucide-react';
import { useSuperAdmin } from '../../contexts/SuperAdminContext';

export default function SystemLogs() {
  const { state, loadSystemLogs } = useSuperAdmin();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  
  const logsPerPage = 12;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadSystemLogs();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDetails = (details: any) => {
    if (typeof details === 'object' && details !== null) {
      return JSON.stringify(details);
    }
    return String(details);
  };

  const filteredLogs = state.systemLogs.filter(log => {
    const detailsString = formatDetails(log.details);
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         detailsString.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.adminId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === 'all' || log.objectType === selectedType;
    
    return matchesSearch && matchesType;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const endIndex = startIndex + logsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType]);

  const getLogIcon = (action: string) => {
    if (action.includes('create') || action.includes('add')) {
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
    if (action.includes('delete') || action.includes('remove')) {
      return <XCircle className="w-4 h-4 text-red-400" />;
    }
    if (action.includes('edit') || action.includes('update')) {
      return <Activity className="w-4 h-4 text-blue-400" />;
    }
    if (action.includes('login') || action.includes('logout')) {
      return <User className="w-4 h-4 text-purple-400" />;
    }
    return <Info className="w-4 h-4 text-slate-400" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) {
      return 'text-green-400 bg-green-400/10';
    }
    if (action.includes('delete') || action.includes('remove')) {
      return 'text-red-400 bg-red-400/10';
    }
    if (action.includes('edit') || action.includes('update')) {
      return 'text-blue-400 bg-blue-400/10';
    }
    if (action.includes('login') || action.includes('logout')) {
      return 'text-purple-400 bg-purple-400/10';
    }
    return 'text-slate-300 bg-slate-400/10';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Hace unos segundos';
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} h`;
    return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
  };

  const logTypes = [
    { value: 'all', label: 'Todos los Tipos' },
    { value: 'user', label: 'Usuario' },
    { value: 'plan', label: 'Plan' },
    { value: 'auth', label: 'Autenticación' },
    { value: 'system', label: 'Sistema' },
  ];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>
            Mostrando {startIndex + 1} - {Math.min(endIndex, filteredLogs.length)} de {filteredLogs.length} logs
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                page === currentPage
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {page}
            </button>
          ))}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 lg:px-8 py-4 lg:py-6 sticky top-0 z-40">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-white">Historial de Logs del Sistema</h1>
            <p className="text-slate-400 text-sm lg:text-base mt-1">
              Registro de actividades importantes de los super administradores.
            </p>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 lg:p-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por acción, detalles, ID de admin/objeto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="pl-10 pr-8 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none min-w-[200px]"
            >
              {logTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total de Logs</p>
                <p className="text-xl font-bold text-white">{state.systemLogs.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Logs Filtrados</p>
                <p className="text-xl font-bold text-white">{filteredLogs.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Página Actual</p>
                <p className="text-xl font-bold text-white">{currentPage} de {totalPages}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Logs Cards - Mobile First */}
        <div className="space-y-4">
          {currentLogs.map((log) => (
            <div key={log.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 lg:p-6 hover:border-slate-600 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Left: Icon and Action */}
                <div className="flex items-center gap-3 lg:min-w-0 lg:flex-1">
                  <div className="flex-shrink-0">
                    {getLogIcon(log.action)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded-full">
                        {log.objectType}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">
                      Admin: <span className="font-mono">{log.adminId.slice(0, 8)}...</span>
                    </p>
                  </div>
                </div>

                {/* Center: Details */}
                <div className="lg:flex-1 lg:min-w-0">
                  <div className="mb-2">
                    <p className="text-slate-300 text-sm font-medium mb-1">Detalles:</p>
                    <p className="text-slate-400 text-sm break-words">
                      {formatDetails(log.details).length > 100 
                        ? `${formatDetails(log.details).substring(0, 100)}...`
                        : formatDetails(log.details)
                      }
                    </p>
                  </div>
                  {log.objectId && (
                    <p className="text-slate-500 text-xs">
                      ID: <span className="font-mono">{log.objectId.slice(0, 8)}...</span>
                    </p>
                  )}
                </div>

                {/* Right: Time and Actions */}
                <div className="flex items-center justify-between lg:flex-col lg:items-end gap-2">
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="hidden lg:inline">{formatDate(log.timestamp)}</span>
                      <span className="lg:hidden">{formatRelativeTime(log.timestamp)}</span>
                    </div>
                    {log.ipAddress && log.ipAddress !== 'N/A' && (
                      <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <Globe className="w-3 h-3" />
                        <span>{log.ipAddress}</span>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setSelectedLog(log)}
                    className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-xs"
                  >
                    <Eye className="w-3 h-3" />
                    <span className="hidden sm:inline">Ver</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {currentLogs.length === 0 && (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No se encontraron logs</p>
            <p className="text-slate-500 text-sm">
              {searchTerm || selectedType !== 'all' 
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Los logs aparecerán aquí cuando se realicen acciones'
              }
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredLogs.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            {renderPagination()}
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Detalles del Log</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Acción</label>
                    <div className={`px-3 py-2 rounded-lg ${getActionColor(selectedLog.action)}`}>
                      {selectedLog.action.replace(/_/g, ' ')}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Tipo de Objeto</label>
                    <div className="px-3 py-2 bg-slate-700 rounded-lg text-slate-300">
                      {selectedLog.objectType}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Admin ID</label>
                    <div className="px-3 py-2 bg-slate-700 rounded-lg text-slate-300 font-mono text-sm">
                      {selectedLog.adminId}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Object ID</label>
                    <div className="px-3 py-2 bg-slate-700 rounded-lg text-slate-300 font-mono text-sm">
                      {selectedLog.objectId || 'N/A'}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Fecha y Hora</label>
                  <div className="px-3 py-2 bg-slate-700 rounded-lg text-slate-300">
                    {formatDate(selectedLog.timestamp)}
                  </div>
                </div>
                
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Dirección IP</label>
                  <div className="px-3 py-2 bg-slate-700 rounded-lg text-slate-300">
                    {selectedLog.ipAddress || 'N/A'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Detalles</label>
                  <div className="px-3 py-2 bg-slate-700 rounded-lg text-slate-300 max-h-40 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}