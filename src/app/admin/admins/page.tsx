'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldCheck, Plus, Trash2, UserCheck, UserX,
  Mail, AlertTriangle, Loader2, X, Crown, Users,
  ArrowLeft, ChevronRight, Lock, Unlock, Activity,
  Eye, EyeOff, Ban, CheckCircle2, Clock, Search,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;
  blocked_by: string | null;
  created_at: string;
}

interface ActivityLogEntry {
  id: string;
  action: string;
  target_user_email: string | null;
  details: Record<string, unknown>;
  created_at: string;
  super_admin_name: string | null;
}

const SUPER_ADMIN_EMAIL = 'kardellridclient@outlook.com';

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/5 animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-7 w-10 bg-white/5 rounded animate-pulse" />
                <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <div className="h-5 w-40 bg-white/5 rounded animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-36 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 bg-white/5 rounded-full animate-pulse" />
              <div className="w-8 h-8 bg-white/5 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getActionLabel(action: string) {
  const labels: Record<string, { text: string; color: string; icon: typeof Shield }> = {
    create_admin: { text: 'Admin Creado', color: 'text-emerald-400', icon: UserCheck },
    block_admin: { text: 'Admin Bloqueado', color: 'text-red-400', icon: Ban },
    unblock_admin: { text: 'Admin Desbloqueado', color: 'text-blue-400', icon: Unlock },
    remove_admin: { text: 'Admin Eliminado', color: 'text-amber-400', icon: Trash2 },
  };
  return labels[action] || { text: action, color: 'text-gray-400', icon: Activity };
}

export default function AdminManagementPage() {
  const { user: currentUser, session } = useAuthStore();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'admins' | 'activity'>('admins');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);

  // Forms
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [blockReason, setBlockReason] = useState('');
  const [creating, setCreating] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch('/api/admins', {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAdmins(data.admins || []);
      } else {
        toast.error(data.error || 'Error al cargar administradores');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  }, [session]);

  const fetchActivityLog = useCallback(async () => {
    try {
      const res = await fetch('/api/admins?view=activity-log&limit=100', {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setActivityLog(data.log || []);
      }
    } catch {
      // silent
    }
  }, [session]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  useEffect(() => {
    if (activeTab === 'activity') fetchActivityLog();
  }, [activeTab, fetchActivityLog]);

  // === HANDLERS ===

  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error('Todos los campos son requeridos');
      return;
    }
    if (createForm.password.length < 6) {
      toast.error('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Administrador creado exitosamente');
        setShowCreateModal(false);
        setCreateForm({ name: '', email: '', password: '' });
        fetchAdmins();
        fetchActivityLog();
      } else {
        toast.error(data.error || 'Error al crear administrador');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setCreating(false);
    }
  };

  const handleBlock = async () => {
    if (!selectedAdmin) return;
    setBlocking(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'block',
          userId: selectedAdmin.id,
          reason: blockReason || 'Bloqueado por Super Admin'
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Administrador bloqueado');
        setShowBlockModal(false);
        setSelectedAdmin(null);
        setBlockReason('');
        fetchAdmins();
        fetchActivityLog();
      } else {
        toast.error(data.error || 'Error al bloquear');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async (admin: AdminUser) => {
    setBlocking(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'unblock',
          userId: admin.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Administrador desbloqueado');
        fetchAdmins();
        fetchActivityLog();
      } else {
        toast.error(data.error || 'Error al desbloquear');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setBlocking(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedAdmin) return;
    setRemoving(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId: selectedAdmin.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Acceso removido exitosamente');
        setShowRemoveModal(false);
        setSelectedAdmin(null);
        fetchAdmins();
        fetchActivityLog();
      } else {
        toast.error(data.error || 'Error al remover administrador');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setRemoving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const regularAdmins = admins.filter(a => a.role === 'admin');
  const superAdmins = admins.filter(a => a.role === 'super_admin');
  const blockedAdmins = regularAdmins.filter(a => a.is_blocked);
  const activeAdmins = regularAdmins.filter(a => !a.is_blocked);

  // === LOADING (wait for user data before checking access) ===
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  // === NO ACCESS (only after user is loaded) ===
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Acceso Restringido</h2>
        <p className="text-sm text-gray-400 max-w-sm">
          Esta seccion es exclusiva para el Super Admin. Solo el propietario del sistema puede gestionar administradores.
        </p>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mt-6 px-6 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-purple-400" />
            Control de Administradores
          </h1>
          <p className="text-gray-400 mt-1">
            Panel exclusivo del Super Admin
          </p>
        </div>
        <motion.button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" />
          Crear Administrador
        </motion.button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Administradores</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('admins')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'admins'
              ? 'bg-cyan-500/20 text-cyan-400 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.3)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5" />
          Administradores
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'activity'
              ? 'bg-cyan-500/20 text-cyan-400 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.3)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Activity className="w-4 h-4 inline mr-1.5" />
          Log de Actividades
        </button>
      </div>

      {/* === STATS === */}
      {!loading && activeTab === 'admins' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div className="glass rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{regularAdmins.length}</p>
                <p className="text-sm text-gray-400">Total Admins</p>
              </div>
            </div>
          </motion.div>
          <motion.div className="glass rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-green-500 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{activeAdmins.length}</p>
                <p className="text-sm text-gray-400">Activos</p>
              </div>
            </div>
          </motion.div>
          <motion.div className="glass rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 to-pink-500 flex items-center justify-center">
                <Ban className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{blockedAdmins.length}</p>
                <p className="text-sm text-gray-400">Bloqueados</p>
              </div>
            </div>
          </motion.div>
          <motion.div className="glass rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{superAdmins.length}</p>
                <p className="text-sm text-gray-400">Super Admins</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* === ADMINS TAB === */}
      {loading ? (
        <LoadingSkeleton />
      ) : activeTab === 'admins' ? (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Lista de Administradores</h2>
            <span className="text-xs text-gray-500">{admins.length} total</span>
          </div>

          {admins.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No hay administradores</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {/* Super Admin Section */}
              {superAdmins.length > 0 && (
                <>
                  <div className="px-5 py-2 bg-purple-500/5 border-b border-white/5">
                    <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                      <Crown className="w-3 h-3" />
                      Super Admin (Dueño)
                    </p>
                  </div>
                  {superAdmins.map((admin) => (
                    <motion.div
                      key={admin.id}
                      className="flex items-center justify-between px-5 py-4 bg-purple-500/3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0">
                          <Crown className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{admin.name}</p>
                            {admin.id === currentUser?.id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">Tú</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Mail className="w-3 h-3 text-gray-500 flex-shrink-0" />
                            <p className="text-xs text-gray-400 truncate">{admin.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          <Crown className="w-3 h-3" />
                          Super Admin
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Activo
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </>
              )}

              {/* Regular Admins */}
              {regularAdmins.length > 0 && (
                <>
                  <div className="px-5 py-2 bg-cyan-500/5 border-b border-white/5 border-t border-t-white/5">
                    <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-3 h-3" />
                      Administradores
                    </p>
                  </div>
                  {regularAdmins.map((admin, i) => (
                    <motion.div
                      key={admin.id}
                      className={`flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors ${
                        admin.is_blocked ? 'opacity-60' : ''
                      }`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          admin.is_blocked
                            ? 'bg-gradient-to-br from-red-600 to-gray-600'
                            : 'bg-gradient-to-br from-blue-600 to-cyan-500'
                        }`}>
                          {admin.is_blocked ? (
                            <Ban className="w-5 h-5 text-white" />
                          ) : (
                            <Shield className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{admin.name}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Mail className="w-3 h-3 text-gray-500 flex-shrink-0" />
                            <p className="text-xs text-gray-400 truncate">{admin.email}</p>
                          </div>
                          {admin.is_blocked && admin.blocked_reason && (
                            <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              {admin.blocked_reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        {/* Status Badge */}
                        {admin.is_blocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                            <Ban className="w-3 h-3" />
                            Bloqueado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Activo
                          </span>
                        )}

                        {/* Date */}
                        <span className="text-xs text-gray-500 hidden sm:block">
                          {formatDate(admin.created_at)}
                        </span>

                        {/* Unblock Button */}
                        {admin.is_blocked && (
                          <motion.button
                            onClick={() => handleUnblock(admin)}
                            className="p-2 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title="Desbloquear"
                          >
                            <Unlock className="w-4 h-4" />
                          </motion.button>
                        )}

                        {/* Block Button */}
                        {!admin.is_blocked && (
                          <motion.button
                            onClick={() => {
                              setSelectedAdmin(admin);
                              setBlockReason('');
                              setShowBlockModal(true);
                            }}
                            className="p-2 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title="Bloquear"
                          >
                            <Lock className="w-4 h-4" />
                          </motion.button>
                        )}

                        {/* Remove Button */}
                        <motion.button
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setShowRemoveModal(true);
                          }}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Eliminar acceso"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* === ACTIVITY LOG TAB === */
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Log de Actividades
            </h2>
            <button
              type="button"
              onClick={fetchActivityLog}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Actualizar
            </button>
          </div>

          {activityLog.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No hay actividad registrada</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {activityLog.map((entry, i) => {
                const actionInfo = getActionLabel(entry.action);
                const ActionIcon = actionInfo.icon;
                return (
                  <motion.div
                    key={entry.id}
                    className="px-5 py-3.5 hover:bg-white/5 transition-colors"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        entry.action === 'block_admin' ? 'bg-red-500/20' :
                        entry.action === 'unblock_admin' ? 'bg-blue-500/20' :
                        entry.action === 'create_admin' ? 'bg-emerald-500/20' :
                        'bg-amber-500/20'
                      }`}>
                        <ActionIcon className={`w-4 h-4 ${actionInfo.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${actionInfo.color}`}>
                            {actionInfo.text}
                          </span>
                          {entry.target_user_email && (
                            <span className="text-xs text-gray-400 truncate">
                              — {entry.target_user_email}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDate(entry.created_at)}
                          </span>
                          {entry.super_admin_name && (
                            <span className="text-[10px] text-gray-500">
                              por {entry.super_admin_name}
                            </span>
                          )}
                          {entry.details?.reason && (
                            <span className="text-[10px] text-red-400/70 truncate">
                              Motivo: {String(entry.details.reason)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      {!loading && activeTab === 'admins' && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-400 space-y-2">
              <p className="text-white font-medium">Informacion del Super Admin</p>
              <p>Solo TÚ ({SUPER_ADMIN_EMAIL}) puedes crear, bloquear, desbloquear y eliminar cuentas de administrador. Los administradores regulares NO tienen acceso a esta seccion.</p>
              <p>Al <span className="text-red-400 font-medium">bloquear</span> un admin, no podra iniciar sesion ni acceder al panel. Al <span className="text-amber-400 font-medium">eliminar</span>, su cuenta se convierte a usuario cliente.</p>
              <p>Todas las acciones quedan registradas en el log de actividades.</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ CREATE MODAL ═══════ */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-cyan-400" />
                  Nuevo Administrador
                </h3>
                <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase">Nombre completo</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none transition-all"
                    placeholder="Juan Perez"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase">Correo electronico</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                    className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none transition-all"
                    placeholder="admin@empresa.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase">Contrasena</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                    className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none transition-all"
                    placeholder="Minimo 6 caracteres"
                  />
                </div>

                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                  <p className="text-xs text-cyan-400/80">
                    Se creara con rol de Administrador. Podra ver todo el panel pero NO podra crear, bloquear ni eliminar otros administradores.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full py-3 rounded-xl btn-neon text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</>
                  ) : (
                    <><UserCheck className="w-4 h-4" /> Crear Administrador</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ BLOCK MODAL ═══════ */}
      <AnimatePresence>
        {showBlockModal && selectedAdmin && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowBlockModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-7 h-7 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Bloquear Administrador</h3>
                <p className="text-sm text-gray-400 mb-1">
                  Bloquear a <span className="text-white font-medium">{selectedAdmin.name}</span>?
                </p>
                <p className="text-xs text-gray-500 mb-4">{selectedAdmin.email}</p>

                <div className="mb-4 text-left">
                  <label className="text-xs font-medium text-gray-400 uppercase">Motivo del bloqueo</label>
                  <textarea
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-amber-500 text-white placeholder:text-gray-600 outline-none transition-all resize-none"
                    rows={2}
                    placeholder="Escribe el motivo..."
                  />
                </div>

                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 mb-5 text-left">
                  <p className="text-xs text-red-400/80">
                    Al bloquear, este administrador NO podra iniciar sesion ni acceder al panel de administracion. Podra ser desbloqueado en cualquier momento.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleBlock}
                    disabled={blocking}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {blocking ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Bloqueando...</>
                    ) : (
                      <><Lock className="w-4 h-4" /> Bloquear</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ REMOVE CONFIRMATION MODAL ═══════ */}
      <AnimatePresence>
        {showRemoveModal && selectedAdmin && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRemoveModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Eliminar Administrador</h3>
                <p className="text-sm text-gray-400 mb-1">
                  Eliminar acceso de <span className="text-white font-medium">{selectedAdmin.name}</span>?
                </p>
                <p className="text-xs text-gray-500 mb-4">{selectedAdmin.email}</p>

                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 mb-5 text-left">
                  <p className="text-xs text-red-400/80">
                    Se eliminara permanentemente su acceso de administrador. Su cuenta se convertira en un usuario cliente regular. Esta accion no se puede deshacer.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRemoveModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={removing}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {removing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Eliminando...</>
                    ) : (
                      <><UserX className="w-4 h-4" /> Eliminar</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
