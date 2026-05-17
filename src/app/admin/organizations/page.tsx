'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Search, Plus, Edit2, ToggleLeft, ToggleRight,
  Users, Trash2, Loader2, X, UserPlus, ChevronDown, Filter, AlertTriangle,
  ArrowLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Organization {
  id: string;
  name: string;
  org_type: 'negocio' | 'gobierno' | 'ong' | 'otro';
  payment_method: 'factura' | 'tarjeta_corporativa' | 'sinpe_empresarial' | 'transferencia' | 'credito';
  email: string;
  phone: string;
  address: string;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role_in_org: 'admin' | 'gerente' | 'miembro';
  joined_at: string;
  profiles?: { name: string; email: string };
}

type OrgType = 'todos' | 'negocio' | 'gobierno' | 'ong' | 'otro';
type StatusFilter = 'todos' | 'activas' | 'inactivas';

const orgTypeLabels: Record<string, string> = {
  negocio: 'Negocio',
  gobierno: 'Gobierno',
  ong: 'ONG',
  otro: 'Otro',
};

const paymentLabels: Record<string, string> = {
  factura: 'Factura',
  tarjeta_corporativa: 'Tarjeta Corporativa',
  sinpe_empresarial: 'SINPE Empresarial',
  transferencia: 'Transferencia',
  credito: 'Credito',
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  miembro: 'Miembro',
};

const emptyOrg = (): Omit<Organization, 'id' | 'created_at' | 'updated_at'> => ({
  name: '',
  org_type: 'negocio',
  payment_method: 'factura',
  email: '',
  phone: '',
  address: '',
  is_active: true,
  notes: '',
});

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="h-4 w-80 max-w-full bg-white/5 rounded-lg animate-pulse" />
      </div>
      {/* Filters bar skeleton */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 h-10 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-10 w-40 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-10 w-36 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-10 w-44 bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>
      {/* Table skeleton */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="border-b border-white/10">
          <div className="flex gap-4 px-4 py-3">
            {['w-20', 'w-16', 'w-24', 'w-28', 'w-28', 'w-16', 'w-16', 'w-16'].map((w, i) => (
              <div key={i} className={`h-3 ${w} bg-white/5 rounded animate-pulse`} />
            ))}
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2 w-40">
              <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
              <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="h-5 w-16 bg-white/5 rounded-full animate-pulse" />
            <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-8 bg-white/5 rounded animate-pulse" />
            <div className="h-5 w-5 bg-white/5 rounded animate-pulse" />
            <div className="flex gap-1">
              <div className="w-8 h-8 bg-white/5 rounded-lg animate-pulse" />
              <div className="w-8 h-8 bg-white/5 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<OrgType>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState(emptyOrg());
  const [formSaving, setFormSaving] = useState(false);

  // Members modal
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Add member
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<OrgMember | null>(null);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar organizaciones');
      console.error(error);
    } else {
      // Load member counts
      const { data: memberCounts } = await supabase
        .from('organization_members')
        .select('organization_id');

      const countMap: Record<string, number> = {};
      (memberCounts || []).forEach((m: any) => {
        countMap[m.organization_id] = (countMap[m.organization_id] || 0) + 1;
      });

      setOrganizations((data || []).map((o: Organization) => ({
        ...o,
        member_count: countMap[o.id] || 0,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const filteredOrgs = organizations.filter(org => {
    const matchSearch = !search || org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.email?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'todos' || org.org_type === typeFilter;
    const matchStatus = statusFilter === 'todos' ||
      (statusFilter === 'activas' && org.is_active) ||
      (statusFilter === 'inactivas' && !org.is_active);
    return matchSearch && matchType && matchStatus;
  });

  const openCreateModal = () => {
    setEditingOrg(null);
    setFormData(emptyOrg());
    setShowFormModal(true);
  };

  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      org_type: org.org_type,
      payment_method: org.payment_method,
      email: org.email || '',
      phone: org.phone || '',
      address: org.address || '',
      is_active: org.is_active,
      notes: org.notes || '',
    });
    setShowFormModal(true);
  };

  const handleSaveOrg = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setFormSaving(true);
    try {
      if (editingOrg) {
        const { error } = await supabase
          .from('organizations')
          .update(formData)
          .eq('id', editingOrg.id);
        if (error) throw error;
        toast.success('Organizacion actualizada');
      } else {
        const { error } = await supabase
          .from('organizations')
          .insert(formData);
        if (error) throw error;
        toast.success('Organizacion creada');
      }
      setShowFormModal(false);
      loadOrganizations();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setFormSaving(false);
    }
  };

  const toggleActive = async (org: Organization) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ is_active: !org.is_active })
        .eq('id', org.id);
      if (error) throw error;
      toast.success(`${org.name} ${org.is_active ? 'desactivada' : 'activada'}`);
      loadOrganizations();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  const openMembersModal = async (org: Organization) => {
    setSelectedOrg(org);
    setShowMembersModal(true);
    setMembersLoading(true);
    setMembers([]);
    setUserSearch('');

    const { data, error } = await supabase
      .from('organization_members')
      .select('*, profiles(name, email)')
      .eq('organization_id', org.id)
      .order('joined_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar miembros');
    } else {
      setMembers(data || []);
    }
    setMembersLoading(false);
  };

  const searchUsers = async (query: string) => {
    setUserSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      // Get existing member IDs
      const existingIds = members.map(m => m.user_id);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (!error && data) {
        setSearchResults(data.filter((u: any) => !existingIds.includes(u.id)));
      }
    } catch {
      // silent
    }
    setSearchingUsers(false);
  };

  const addMember = async (userId: string, role: 'admin' | 'gerente' | 'miembro') => {
    if (!selectedOrg) return;
    setAddingMember(true);
    try {
      const { error } = await supabase
        .from('organization_members')
        .insert({
          organization_id: selectedOrg.id,
          user_id: userId,
          role_in_org: role,
        });
      if (error) throw error;
      toast.success('Miembro agregado');
      setUserSearch('');
      setSearchResults([]);
      openMembersModal(selectedOrg);
    } catch (err: any) {
      toast.error(err.message || 'Error al agregar miembro');
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (member: OrgMember) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', member.id);
      if (error) throw error;
      toast.success('Miembro removido');
      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch (err: any) {
      toast.error(err.message || 'Error al remover miembro');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Organizaciones</h1>
        <p className="text-gray-400 mt-1">Gestion de cuentas corporativas y metodos de pago empresariales</p>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Organizaciones</span>
      </div>

      {/* Loading Skeleton */}
      {loading && <LoadingSkeleton />}

      {/* Filters Bar */}
      {!loading && (
      <motion.div
        className="glass rounded-2xl p-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as OrgType)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-8 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[140px]"
            >
              <option value="todos" className="bg-[#111827]">Todos</option>
              <option value="negocio" className="bg-[#111827]">Negocio</option>
              <option value="gobierno" className="bg-[#111827]">Gobierno</option>
              <option value="ong" className="bg-[#111827]">ONG</option>
              <option value="otro" className="bg-[#111827]">Otro</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[130px]"
            >
              <option value="todos" className="bg-[#111827]">Todos</option>
              <option value="activas" className="bg-[#111827]">Activas</option>
              <option value="inactivas" className="bg-[#111827]">Inactivas</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Create Button */}
          <button
            type="button"
            onClick={openCreateModal}
            className="py-2.5 px-5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center gap-2 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            CREAR ORGANIZACION
          </button>
        </div>
      </motion.div>
      )}

      {/* Table */}
      {!loading && (
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Nombre</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Tipo</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Pago</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Email</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Telefono</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Miembros</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Estado</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrgs.map((org, i) => (
                <motion.tr
                  key={org.id}
                  className="hover:bg-white/[0.02] transition-colors"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-sm font-medium text-white truncate max-w-[150px]">{org.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">
                      {orgTypeLabels[org.org_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-gray-400">{paymentLabels[org.payment_method]}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-gray-400">{org.email || '-'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-gray-400">{org.phone || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-cyan-400 font-medium">{org.member_count || 0}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleActive(org)}
                      className="inline-flex items-center gap-1"
                    >
                      {org.is_active ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-500" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(org)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openMembersModal(org)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                        title="Gestionar Miembros"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrgs.length === 0 && (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No se encontraron organizaciones</p>
          </div>
        )}
      </motion.div>
      )}

      {/* ===================== FORM MODAL ===================== */}
      <AnimatePresence>
        {showFormModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowFormModal(false)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">
                  {editingOrg ? 'Editar Organizacion' : 'Crear Organizacion'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Nombre *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="Nombre de la organizacion"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Tipo</label>
                    <select
                      value={formData.org_type}
                      onChange={e => setFormData(prev => ({ ...prev, org_type: e.target.value as any }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none"
                    >
                      <option value="negocio" className="bg-[#111827]">Negocio</option>
                      <option value="gobierno" className="bg-[#111827]">Gobierno</option>
                      <option value="ong" className="bg-[#111827]">ONG</option>
                      <option value="otro" className="bg-[#111827]">Otro</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Metodo de Pago</label>
                    <select
                      value={formData.payment_method}
                      onChange={e => setFormData(prev => ({ ...prev, payment_method: e.target.value as any }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none"
                    >
                      <option value="factura" className="bg-[#111827]">Factura</option>
                      <option value="tarjeta_corporativa" className="bg-[#111827]">Tarjeta Corporativa</option>
                      <option value="sinpe_empresarial" className="bg-[#111827]">SINPE Empresarial</option>
                      <option value="transferencia" className="bg-[#111827]">Transferencia</option>
                      <option value="credito" className="bg-[#111827]">Credito</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                      placeholder="org@email.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Telefono</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                      placeholder="+506 ..."
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Direccion</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="Direccion fiscal"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                    placeholder="Notas adicionales..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveOrg}
                  disabled={formSaving}
                  className="flex-1 py-2.5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {formSaving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  ) : (
                    <>{editingOrg ? 'Actualizar' : 'Crear'}</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== MEMBERS MODAL ===================== */}
      <AnimatePresence>
        {showMembersModal && selectedOrg && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowMembersModal(false)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white">Miembros</h2>
                  <p className="text-xs text-gray-500">{selectedOrg.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMembersModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Add Member Search */}
              <div className="mb-4 space-y-2">
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => searchUsers(e.target.value)}
                    placeholder="Buscar usuario por nombre o email..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  {searchingUsers && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-cyan-400" />
                  )}
                </div>

                {/* Search Results */}
                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div
                      className="bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                    >
                      {searchResults.map((user: any) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                        >
                          <div>
                            <p className="text-sm text-white">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addMember(user.id, 'miembro')}
                            disabled={addingMember}
                            className="text-xs px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                          >
                            Agregar
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Members List */}
              {membersLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              ) : members.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No hay miembros en esta organizacion</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {members.map((member, i) => (
                    <motion.div
                      key={member.id}
                      className="flex items-center justify-between bg-white/5 rounded-xl p-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">
                            {(member.profiles?.name || '??').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{member.profiles?.name || 'Usuario'}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 truncate">{member.profiles?.email || ''}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 flex-shrink-0">
                              {roleLabels[member.role_in_org]}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRemoveConfirm(member)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Remove Member Confirmation Modal */}
      <AnimatePresence>
        {removeConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setRemoveConfirm(null)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-sm z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Remover Miembro</h2>
                <button
                  type="button"
                  onClick={() => setRemoveConfirm(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-300">
                    ¿Estas seguro de remover este miembro?
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="text-white font-medium">{removeConfirm.profiles?.name || 'Usuario'}</span> sera removido de la organizacion. Esta accion no se puede deshacer.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRemoveConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeMember(removeConfirm);
                    setRemoveConfirm(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
