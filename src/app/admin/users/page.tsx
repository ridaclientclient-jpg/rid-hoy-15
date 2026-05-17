'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Shield, ShieldOff, Eye, Users, Mail, Phone,
  ChevronDown, MoreHorizontal, Ban, CheckCircle2, XCircle,
  UserCheck, Loader2, X, RefreshCw, UserCog, FileText, ImageIcon, Trash2,
  AlertTriangle,
} from 'lucide-react';
import { supabase, type Profile } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

type UserRole = 'client' | 'driver' | 'admin' | 'vendor' | 'courier' | 'super_admin';

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  joined: string;
  avatar: string;
}

const roleLabels: Record<UserRole, string> = {
  client: 'Cliente',
  driver: 'Conductor',
  admin: 'Admin',
  vendor: 'Vendedor',
  courier: 'Repartidor',
  super_admin: 'Super Admin',
};

const roleColors: Record<UserRole, string> = {
  client: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  driver: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  vendor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  courier: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  super_admin: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const filterTabs = ['Todos', 'Clientes', 'Conductores', 'Admins', 'Vendedores', 'Repartidores', 'Bloqueados'] as const;

const roleFilterMap: Record<string, UserRole | null> = {
  'Todos': null,
  'Clientes': 'client',
  'Conductores': 'driver',
  'Admins': 'admin',
  'Vendedores': 'vendor',
  'Repartidores': 'courier',
  'Bloqueados': null,
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
}

function profileToUserData(p: Profile): UserData {
  return {
    id: p.id,
    name: p.name || 'Sin nombre',
    email: p.email || '',
    phone: p.phone || '',
    role: (p.role as UserRole) || 'client',
    isActive: p.is_active !== false,
    isVerified: p.is_verified || false,
    joined: p.created_at || '',
    avatar: getInitials(p.name || 'U'),
  };
}

/* ─── Loading Skeleton ────────────────────────────────────── */
function UsersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48 bg-white/10" />
          <Skeleton className="h-5 w-64 mt-2 bg-white/5" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <Skeleton className="h-5 w-20 bg-white/10 mb-2" />
            <Skeleton className="h-8 w-12 bg-white/5" />
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-4">
        <Skeleton className="h-10 w-full bg-white/5" />
        <div className="flex gap-2 mt-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 bg-white/5" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-11 h-11 rounded-xl bg-white/10" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32 bg-white/10" />
                <Skeleton className="h-3 w-48 bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserData[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('Todos');
  const [visibleCount, setVisibleCount] = useState(10);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [userDocuments, setUserDocuments] = useState<Array<{id: string; type: string; url: string; status: string}>>([]);
  const [docImages, setDocImages] = useState<Record<string, string>>({});
  const [loadingDocs, setLoadingDocs] = useState(false);

  /* Fetch signed avatar URLs for users who have an avatar path */
  const fetchAvatarUrls = useCallback(async (profiles: Profile[]) => {
    const urls: Record<string, string> = {};
    const withAvatar = profiles.filter(p => p.avatar);
    if (withAvatar.length === 0) return urls;
    for (const p of withAvatar) {
      try {
        const { data, error } = await supabase.storage
          .from('avatars')
          .createSignedUrl(p.avatar!, 3600);
        if (!error && data?.signedUrl) {
          urls[p.id] = data.signedUrl;
        }
      } catch {
        // Avatar file may not exist — ignore silently
      }
    }
    return urls;
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching users:', error);
        toast.error('Error al cargar usuarios');
        setLoading(false);
        return;
      }

      const profiles = data || [];
      setUsers(profiles.map(profileToUserData));

      // Fetch signed avatar URLs for profiles with avatars
      const urls = await fetchAvatarUrls(profiles);
      setAvatarUrls(urls);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [fetchAvatarUrls]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search);

    let matchFilter = true;
    if (activeFilter === 'Bloqueados') {
      matchFilter = !u.isActive;
    } else {
      const roleFilter = roleFilterMap[activeFilter];
      if (roleFilter) {
        matchFilter = u.role === roleFilter;
      }
    }
    return matchSearch && matchFilter;
  });

  const displayedUsers = filteredUsers.slice(0, visibleCount);

  const statsData = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    blocked: users.filter(u => !u.isActive).length,
    verified: users.filter(u => u.isVerified).length,
  };

  const toggleBlock = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newActive = !user.isActive;
    try {
      const { session } = useAuthStore.getState();
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId, action: 'block', status: newActive })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      toast.success(newActive ? `Usuario ${user.name} desbloqueado` : `Usuario ${user.name} bloqueado`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: newActive } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, isActive: newActive } : null);
      }
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
    setOpenMenu(null);
  };

  const deleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`¿Estás seguro de ELIMINAR permanentemente la cuenta de ${user.name}? Esta acción no se puede deshacer.`)) return;

    try {
      const { session } = useAuthStore.getState();
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId, action: 'delete' })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      toast.success(`Usuario ${user.name} eliminado correctamente`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setSelectedUser(null);
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    }
    setOpenMenu(null);
  };

  const verifyUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', userId);

      if (error) {
        toast.error('Error al verificar usuario');
        return;
      }

      toast.success(`Usuario ${user.name} verificado`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isVerified: true } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, isVerified: true } : null);
      }
    } catch (err) {
      console.error('Verify error:', err);
      toast.error('Error al verificar usuario');
    }
    setOpenMenu(null);
  };

  const changeRole = async (userId: string, newRole: UserRole) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        toast.error('Error al cambiar rol');
        return;
      }

      toast.success(`Rol de ${user.name} cambiado a ${roleLabels[newRole]}`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
      }
      setOpenMenu(null);
    } catch (err) {
      console.error('Role change error:', err);
      toast.error('Error al cambiar rol');
    }
  };

  /* Fetch user documents for detail modal */
  const fetchUserDocuments = useCallback(async (userId: string) => {
    setLoadingDocs(true);
    setUserDocuments([]);
    setDocImages({});
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, type, url, status')
        .eq('user_id', userId);

      if (data && data.length > 0) {
        setUserDocuments(data);
        /* Get signed URLs for each document (private bucket) */
        const urls: Record<string, string> = {};
        for (const doc of data) {
          try {
            // Extract path from full URL if needed
            const path = doc.url.startsWith('http') ? doc.url.split('/documents/')[1] : doc.url;
            const { data: urlData, error: urlError } = await supabase.storage
              .from('documents')
              .createSignedUrl(path || doc.url, 3600);
            if (!urlError && urlData) {
              urls[doc.type] = urlData.signedUrl;
            }
          } catch {
            // Fallback: try public URL
            const { data: pubData } = supabase.storage
              .from('documents')
              .getPublicUrl(doc.url);
            urls[doc.type] = pubData.publicUrl;
          }
        }
        setDocImages(urls);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  /* Open user detail and load documents */
  const openUserDetail = useCallback((user: UserData) => {
    setSelectedUser(user);
    setOpenMenu(null);
    fetchUserDocuments(user.id);
  }, [fetchUserDocuments]);

  const isAdmin = currentUser?.role === 'admin' || (currentUser?.role as string) === 'super_admin';

  if (loading) return <UsersSkeleton />;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Usuarios', value: statsData.total, icon: Users, color: 'text-white' },
          { label: 'Activos', value: statsData.active, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Bloqueados', value: statsData.blocked, icon: Ban, color: 'text-red-400' },
          { label: 'Verificados', value: statsData.verified, icon: Shield, color: 'text-cyan-400' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass rounded-xl p-4"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Usuarios</h1>
          <p className="text-gray-400 mt-1">{users.length} usuarios registrados</p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* Search & Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o telefono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
          />
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveFilter(tab); setVisibleCount(10); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === tab
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {displayedUsers.map((user, i) => (
            <motion.div
              key={user.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: i * 0.03 }}
              className={`glass rounded-xl p-4 hover:bg-white/[0.07] transition-all group ${openMenu === user.id ? 'relative z-50' : ''}`}
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden ${
                  !user.isActive ? 'bg-red-500/20 text-red-400' : 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white'
                }`}>
                  {avatarUrls[user.id]
                    ? <img src={avatarUrls[user.id]} alt={user.name} className="w-full h-full object-cover" />
                    : user.avatar}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{user.name}</h3>
                    {user.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                    {!user.isActive && <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</span>
                    <span className="hidden sm:flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone || 'N/A'}</span>
                  </div>
                </div>

                {/* Role badge */}
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${roleColors[user.role] || roleColors.client} hidden sm:inline-flex`}>
                  {roleLabels[user.role] || user.role}
                </span>

                {/* Joined */}
                <span className="text-xs text-gray-500 hidden lg:block w-24 text-right">
                  {user.joined ? new Date(user.joined).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                </span>

                {/* Actions */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {openMenu === user.id && (
                      <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute right-0 top-10 w-52 glass-strong rounded-xl py-1.5 z-20 shadow-xl"
                      >
                        <button
                          onClick={() => openUserDetail(user)}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Eye className="w-4 h-4 text-cyan-400" /> Ver detalles
                        </button>
                        {!user.isVerified && (
                          <button
                            onClick={() => verifyUser(user.id)}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <UserCheck className="w-4 h-4 text-emerald-400" /> Verificar
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              // Cycle through common roles
                              const roles: UserRole[] = ['client', 'driver', 'vendor', 'courier'];
                              const currentIdx = roles.indexOf(user.role);
                              const nextRole = roles[(currentIdx + 1) % roles.length];
                              changeRole(user.id, nextRole);
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <UserCog className="w-4 h-4 text-purple-400" /> Cambiar rol
                          </button>
                        )}
                        <div className="h-px bg-white/10 my-1" />
                        <button
                          onClick={() => toggleBlock(user.id)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-white/5 transition-colors ${
                            !user.isActive ? 'text-emerald-400 hover:text-emerald-300' : 'text-red-400 hover:text-red-300'
                          }`}
                        >
                          {!user.isActive ? (
                            <><Shield className="w-4 h-4" /> Desbloquear</>
                          ) : (
                            <><Ban className="w-4 h-4" /> Bloquear</>
                          )}
                        </button>
                        {(currentUser?.role === 'super_admin' || (currentUser?.role as any) === 'super_admin') && (
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" /> Eliminar Cuenta
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Load More */}
        {visibleCount < filteredUsers.length && (
          <motion.button
            onClick={() => setVisibleCount((v) => v + 10)}
            className="w-full py-3 glass rounded-xl text-sm text-cyan-400 hover:text-cyan-300 hover:bg-white/[0.07] transition-all flex items-center justify-center gap-2"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <ChevronDown className="w-4 h-4" />
            Cargar mas ({filteredUsers.length - visibleCount} restantes)
          </motion.button>
        )}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No se encontraron usuarios</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          USER DETAIL MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Detalle del Usuario</h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* User Info */}
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold overflow-hidden ${
                    !selectedUser.isActive ? 'bg-red-500/20 text-red-400' : 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white'
                  }`}>
                    {avatarUrls[selectedUser.id]
                      ? <img src={avatarUrls[selectedUser.id]} alt={selectedUser.name} className="w-full h-full object-cover" />
                      : selectedUser.avatar}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedUser.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedUser.isVerified && (
                        <span className="flex items-center gap-1 text-xs text-cyan-400"><CheckCircle2 className="w-3 h-3" /> Verificado</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${roleColors[selectedUser.role]}`}>
                        {roleLabels[selectedUser.role]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detail Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-white mt-0.5 truncate">{selectedUser.email || 'N/A'}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Telefono</p>
                    <p className="text-sm text-white mt-0.5">{selectedUser.phone || 'N/A'}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Estado</p>
                    <p className={`text-sm mt-0.5 ${selectedUser.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {selectedUser.isActive ? 'Activo' : 'Bloqueado'}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Registro</p>
                    <p className="text-sm text-white mt-0.5">
                      {selectedUser.joined ? new Date(selectedUser.joined).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Documents Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-semibold text-white">Documentos de Verificacion</h4>
                  </div>
                  {loadingDocs ? (
                    <div className="flex items-center gap-2 py-4 justify-center">
                      <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                      <span className="text-xs text-gray-400">Cargando documentos...</span>
                    </div>
                  ) : userDocuments.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {userDocuments.map((doc) => {
                        const docLabels: Record<string, string> = {
                          selfie: 'Selfie',
                          id_front: 'Cedula Frente',
                          id_back: 'Cedula Atras',
                          license_front: 'Licencia Frente',
                          license_back: 'Licencia Atras',
                          vehicle_front: 'Vehiculo Frente',
                          vehicle_side: 'Vehiculo Lateral',
                          vehicle_back: 'Vehiculo Atras',
                          vehicle_interior: 'Vehiculo Interior',
                          circulacion: 'Circulacion',
                          marchamo: 'Marchamo',
                        };
                        const imageUrl = docImages[doc.type];
                        return (
                          <div key={doc.id} className="bg-white/5 rounded-xl overflow-hidden">
                            {imageUrl ? (
                              <div
                                className="w-full aspect-square cursor-pointer relative group"
                                onClick={() => window.open(imageUrl, '_blank')}
                              >
                                <img
                                  src={imageUrl}
                                  alt={docLabels[doc.type] || doc.type}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                  <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-full aspect-square flex items-center justify-center bg-white/5">
                                <ImageIcon className="w-6 h-6 text-gray-600" />
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-[10px] text-gray-400 truncate">{docLabels[doc.type] || doc.type}</p>
                              <p className={`text-[9px] mt-0.5 font-medium ${
                                doc.status === 'approved' ? 'text-emerald-400' :
                                doc.status === 'rejected' ? 'text-red-400' :
                                'text-amber-400'
                              }`}>
                                {doc.status === 'approved' ? 'Aprobado' :
                                 doc.status === 'rejected' ? 'Rechazado' :
                                 'Pendiente'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No hay documentos subidos</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {!selectedUser.isVerified && (
                    <button
                      onClick={() => verifyUser(selectedUser.id)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <UserCheck className="w-4 h-4" /> Verificar
                    </button>
                  )}
                  <button
                    onClick={() => toggleBlock(selectedUser.id)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                      !selectedUser.isActive
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    {!selectedUser.isActive ? <><Shield className="w-4 h-4" /> Desbloquear</> : <><Ban className="w-4 h-4" /> Bloquear</>}
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
