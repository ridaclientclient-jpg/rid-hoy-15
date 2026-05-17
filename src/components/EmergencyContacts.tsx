'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Phone,
  Star,
  Trash2,
  Edit2,
  Users,
  Check,
  X,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ───────────────────────────────────────────────────────────────────

interface Session {
  access_token: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: 'familiar' | 'amigo' | 'trabajo' | 'otro';
  is_primary: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface EmergencyContactsProps {
  session: Session | null;
}

interface ContactFormData {
  name: string;
  phone: string;
  relation: EmergencyContact['relation'];
}

const RELATION_LABELS: Record<EmergencyContact['relation'], string> = {
  familiar: 'Familiar',
  amigo: 'Amigo',
  trabajo: 'Trabajo',
  otro: 'Otro',
};

const RELATION_COLORS: Record<EmergencyContact['relation'], string> = {
  familiar: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  amigo: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  trabajo: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  otro: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const MAX_CONTACTS = 5;
const API_BASE = '/api/emergency-contacts';

const INITIAL_FORM: ContactFormData = {
  name: '',
  phone: '',
  relation: 'familiar',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders(token: string | undefined) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 10)}`;
}

// ── Skeleton Loader ─────────────────────────────────────────────────────────

function ContactsSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-10 w-48 rounded-xl bg-white/5" />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="glass rounded-xl p-4 flex items-center gap-3"
        >
          <Skeleton className="h-10 w-10 rounded-full bg-white/5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32 bg-white/5" />
            <Skeleton className="h-3 w-24 bg-white/5" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg bg-white/5" />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function EmergencyContacts({ session }: EmergencyContactsProps) {
  // ── State ────────────────────────────────────────────────────────────────
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ContactFormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ContactFormData>(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState<EmergencyContact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch contacts ───────────────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(API_BASE, {
        headers: authHeaders(session.access_token),
      });
      if (!res.ok) throw new Error('Error al cargar contactos');
      const data = await res.json();
      setContacts(data.contacts ?? data ?? []);
    } catch (err: any) {
      console.error('[EmergencyContacts] Fetch error:', err);
      toast.error('Error al cargar contactos', {
        description: err?.message || 'Intenta de nuevo mas tarde.',
      });
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // ── Auto-focus name input when form opens ────────────────────────────────
  useEffect(() => {
    if (showForm) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [showForm]);

  // ── CRUD Handlers ────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!session?.access_token) {
      toast.error('Sesion no disponible');
      return;
    }
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Campos requeridos', {
        description: 'Nombre y telefono son obligatorios.',
      });
      return;
    }
    if (contacts.length >= MAX_CONTACTS) {
      toast.error(`Maximo ${MAX_CONTACTS} contactos`, {
        description: 'Elimina un contacto existente para agregar uno nuevo.',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: authHeaders(session.access_token),
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
          relation: form.relation,
        }),
      });
      if (!res.ok) throw new Error('Error al agregar contacto');
      const data = await res.json();
      toast.success('Contacto agregado', {
        description: `${form.name} ha sido agregado a tus contactos de emergencia.`,
      });
      setForm(INITIAL_FORM);
      setShowForm(false);
      fetchContacts();
    } catch (err: any) {
      console.error('[EmergencyContacts] Add error:', err);
      toast.error('Error al agregar contacto', {
        description: err?.message || 'Intenta de nuevo.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!session?.access_token || !editingId) return;
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      toast.error('Campos requeridos');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: authHeaders(session.access_token),
        body: JSON.stringify({
          contact_id: editingId,
          name: editForm.name.trim(),
          phone: editForm.phone.replace(/\D/g, ''),
          relation: editForm.relation,
        }),
      });
      if (!res.ok) throw new Error('Error al actualizar contacto');
      toast.success('Contacto actualizado');
      setEditingId(null);
      setEditForm(INITIAL_FORM);
      fetchContacts();
    } catch (err: any) {
      toast.error('Error al actualizar', {
        description: err?.message || 'Intenta de nuevo.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.access_token || !deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(API_BASE, {
        method: 'DELETE',
        headers: authHeaders(session.access_token),
        body: JSON.stringify({ contact_id: deleteTarget.id }),
      });
      if (!res.ok) throw new Error('Error al eliminar contacto');
      toast.success('Contacto eliminado', {
        description: `${deleteTarget.name} ha sido eliminado.`,
      });
      setDeleteTarget(null);
      fetchContacts();
    } catch (err: any) {
      toast.error('Error al eliminar', {
        description: err?.message || 'Intenta de nuevo.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePrimary = async (contact: EmergencyContact) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: authHeaders(session.access_token),
        body: JSON.stringify({
          contact_id: contact.id,
          is_primary: !contact.is_primary,
        }),
      });
      if (!res.ok) throw new Error('Error al marcar como principal');
      toast.success(
        contact.is_primary
          ? 'Contacto desmarcado como principal'
          : 'Contacto marcado como principal',
        {
          description: contact.is_primary
            ? ''
            : `${contact.name} es ahora tu contacto principal.`,
        }
      );
      fetchContacts();
    } catch (err: any) {
      toast.error('Error', { description: err?.message });
    }
  };

  const startEdit = (contact: EmergencyContact) => {
    setEditingId(contact.id);
    setEditForm({
      name: contact.name,
      phone: contact.phone,
      relation: contact.relation,
    });
    setShowForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(INITIAL_FORM);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return <ContactsSkeleton />;

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Contactos de Emergencia
            </h2>
            <p className="text-xs text-gray-500">
              {contacts.length} de {MAX_CONTACTS} contactos
            </p>
          </div>
        </div>

        {contacts.length < MAX_CONTACTS && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(!showForm)}
            disabled={!!editingId}
            className="h-8 px-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-1.5 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
          >
            {showForm ? (
              <>
                <X className="w-3.5 h-3.5" /> Cancelar
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" /> Agregar
              </>
            )}
          </motion.button>
        )}
      </div>

      {/* ── Contact Counter Bar ────────────────────────────────────────── */}
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
          initial={{ width: 0 }}
          animate={{
            width: `${(contacts.length / MAX_CONTACTS) * 100}%`,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* ── Add Contact Form ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="glass-strong rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                Nuevo Contacto
              </h3>

              {/* Name */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Nombre *
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Nombre del contacto"
                  maxLength={60}
                  className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Telefono *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setForm((f) => ({ ...f, phone: raw }));
                  }}
                  placeholder="Ej: 5512345678"
                  className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>

              {/* Relation */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Relacion
                </label>
                <Select
                  value={form.relation}
                  onValueChange={(val) =>
                    setForm((f) => ({
                      ...f,
                      relation: val as EmergencyContact['relation'],
                    }))
                  }
                >
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white rounded-lg focus:border-emerald-500/50 focus:ring-emerald-500/30">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(RELATION_LABELS) as [
                        EmergencyContact['relation'],
                        string,
                      ][]
                    ).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Submit */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleAdd}
                disabled={saving || !form.name.trim() || !form.phone.trim()}
                className="w-full h-10 rounded-xl bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors disabled:opacity-40"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> Agregar Contacto
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Contacts List ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {contacts.length === 0 && !loading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass rounded-xl p-8 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-7 h-7 text-gray-500" />
              </div>
              <p className="text-sm text-gray-400 mb-1">
                Sin contactos de emergencia
              </p>
              <p className="text-xs text-gray-600">
                Agrega hasta {MAX_CONTACTS} contactos para tu seguridad.
              </p>
            </motion.div>
          )}

          {contacts.map((contact, index) => (
            <motion.div
              key={contact.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              className={`glass rounded-xl overflow-hidden transition-colors ${
                contact.is_primary
                  ? 'border-emerald-500/30 ring-1 ring-emerald-500/10'
                  : ''
              }`}
            >
              {/* ── Editing Mode ─────────────────────────────────────── */}
              {editingId === contact.id ? (
                <div className="p-4 space-y-3">
                  <h4 className="text-xs text-gray-400 font-medium">
                    Editando contacto
                  </h4>

                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Nombre"
                    maxLength={60}
                    className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />

                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => {
                      const raw = e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 10);
                      setEditForm((f) => ({ ...f, phone: raw }));
                    }}
                    placeholder="Telefono"
                    className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />

                  <Select
                    value={editForm.relation}
                    onValueChange={(val) =>
                      setEditForm((f) => ({
                        ...f,
                        relation: val as EmergencyContact['relation'],
                      }))
                    }
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(RELATION_LABELS) as [
                          EmergencyContact['relation'],
                          string,
                        ][]
                      ).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={cancelEdit}
                      className="flex-1 h-9 rounded-lg border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleUpdate}
                      disabled={
                        saving ||
                        !editForm.name.trim() ||
                        !editForm.phone.trim()
                      }
                      className="flex-1 h-9 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Guardar
                    </motion.button>
                  </div>
                </div>
              ) : (
                /* ── View Mode ─────────────────────────────────────── */
                <div className="p-4 flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      contact.is_primary
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {contact.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {contact.name}
                      </span>
                      {contact.is_primary && (
                        <Star className="w-3 h-3 text-emerald-400 fill-emerald-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {formatPhone(contact.phone)}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${RELATION_COLORS[contact.relation]}`}
                      >
                        {RELATION_LABELS[contact.relation]}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Call */}
                    <a
                      href={`tel:${contact.phone}`}
                      className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                      aria-label={`Llamar a ${contact.name}`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>

                    {/* Star */}
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleTogglePrimary(contact)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        contact.is_primary
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-white/5 text-gray-500 hover:text-amber-400 hover:bg-amber-500/10'
                      }`}
                      aria-label={
                        contact.is_primary
                          ? 'Desmarcar como principal'
                          : 'Marcar como principal'
                      }
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          contact.is_primary ? 'fill-amber-400' : ''
                        }`}
                      />
                    </motion.button>

                    {/* Edit */}
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => startEdit(contact)}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                      aria-label="Editar contacto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </motion.button>

                    {/* Delete */}
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setDeleteTarget(contact)}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label="Eliminar contacto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Delete Confirmation Dialog ────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="glass-strong rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Eliminar contacto?
                </h3>
                <p className="text-sm text-gray-400 mb-1">
                  Estas a punto de eliminar a{' '}
                  <span className="text-white font-medium">
                    {deleteTarget.name}
                  </span>{' '}
                  de tus contactos de emergencia.
                </p>
                <p className="text-xs text-gray-600 mb-6">
                  Esta accion no se puede deshacer.
                </p>

                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                    className="flex-1 h-10 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />{' '}
                        Eliminando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" /> Eliminar
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EmergencyContacts;
