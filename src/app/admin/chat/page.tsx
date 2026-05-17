'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Search, Send, ArrowLeft, CircleDot,
  CheckCircle2, XCircle, Loader2, Inbox, User,
  ChevronDown, MoreVertical, Clock, Volume2, VolumeX,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, type SupportChat, type ChatMessage } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const POLL_INTERVAL = 8000;

const ROLE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  client:  { bg: 'bg-cyan-500/20', text: 'text-cyan-400', ring: 'ring-cyan-500/40' },
  driver:  { bg: 'bg-blue-500/20',  text: 'text-blue-400',  ring: 'ring-blue-500/40' },
  vendor:  { bg: 'bg-purple-500/20', text: 'text-purple-400', ring: 'ring-purple-500/40' },
  courier: { bg: 'bg-amber-500/20',  text: 'text-amber-400',  ring: 'ring-amber-500/40' },
};

const ROLE_LABELS: Record<string, string> = {
  client: 'Cliente',
  driver: 'Conductor',
  vendor: 'Vendedor',
  courier: 'Repartidor',
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  open:     { bg: 'bg-emerald-500/15',  text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400',    label: 'Abierto' },
  resolved: { bg: 'bg-blue-500/15',     text: 'text-blue-400',    border: 'border-blue-500/30',    dot: 'bg-blue-400',       label: 'Resuelto' },
  closed:   { bg: 'bg-gray-500/15',     text: 'text-gray-400',    border: 'border-gray-500/30',    dot: 'bg-gray-400',       label: 'Cerrado' },
};

type StatusFilter = 'all' | 'open' | 'resolved' | 'closed';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Ahora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getAvatarGradient(role: string): string {
  switch (role) {
    case 'client':  return 'from-cyan-500 to-cyan-600';
    case 'driver':  return 'from-blue-500 to-blue-600';
    case 'vendor':  return 'from-purple-500 to-purple-600';
    case 'courier': return 'from-amber-500 to-amber-600';
    default:        return 'from-gray-500 to-gray-600';
  }
}

function playMessageSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // AudioContext not available
  }
}

/* ─── Status Badge ───────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'open' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

/* ─── Role Badge ─────────────────────────────────────────────────────────── */

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_COLORS[role];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

/* ─── Unread Badge ───────────────────────────────────────────────────────── */

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/* ─── Chat List Item ─────────────────────────────────────────────────────── */

function ChatListItem({
  chat,
  isSelected,
  onClick,
}: {
  chat: SupportChat;
  isSelected: boolean;
  onClick: () => void;
}) {
  const roleCfg = ROLE_COLORS[chat.user_role] ?? ROLE_COLORS.client;
  const initials = getInitials(chat.user_name || 'User');
  const preview = chat.last_message_preview || 'Sin mensajes';
  const truncatedPreview = preview.length > 42 ? preview.substring(0, 42) + '...' : preview;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 rounded-xl transition-all duration-200 group ${
        isSelected
          ? 'glass-strong border-cyan-500/30 bg-cyan-500/5'
          : 'hover:bg-white/5 border border-transparent'
      }`}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(chat.user_role)} flex items-center justify-center ring-2 ${roleCfg.ring}`}>
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          {chat.status === 'open' && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0a0e1a]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-white truncate">
                {chat.user_name || 'Usuario'}
              </span>
              <RoleBadge role={chat.user_role} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <UnreadBadge count={chat.unread_by_admin} />
              <span className="text-[10px] text-gray-500">{timeAgo(chat.last_message_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className={`text-xs truncate flex-1 ${chat.unread_by_admin > 0 ? 'text-gray-200 font-medium' : 'text-gray-500'}`}>
              {truncatedPreview}
            </p>
            <StatusBadge status={chat.status} />
          </div>
          {chat.subject && (
            <p className="text-[10px] text-gray-600 mt-1 truncate">{chat.subject}</p>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ─── Chat List Skeleton ─────────────────────────────────────────────────── */

function ChatListSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3.5 rounded-xl">
          <Skeleton className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 bg-white/10" />
              <Skeleton className="h-3 w-12 bg-white/5" />
            </div>
            <Skeleton className="h-3 w-full bg-white/5" />
            <Skeleton className="h-3 w-20 bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────────────────────────────── */

function MessageBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isAdmin = message.sender_type === 'admin';
  const isSystem = message.message_type === 'system';

  if (isSystem) {
    return (
      <motion.div
        className="flex justify-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03, duration: 0.2 }}
      >
        <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5">
          <p className="text-[11px] text-gray-500 italic">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
    >
      <div className={`max-w-[75%] sm:max-w-[65%]`}>
        <div
          className={`px-4 py-2.5 rounded-2xl ${
            isAdmin
              ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-br-md'
              : 'glass text-gray-100 rounded-bl-md'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className={`flex items-center gap-1.5 mt-1 ${isAdmin ? 'justify-end' : 'justify-start'} px-1`}>
          <span className="text-[10px] text-gray-600">
            {formatMessageTime(message.created_at)}
          </span>
          {isAdmin && (
            <CheckCircle2 className="w-3 h-3 text-cyan-500/60" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Empty State ────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center mb-6">
        <Inbox className="w-10 h-10 text-cyan-400/60" />
      </div>
      <h3 className="text-lg font-semibold text-gray-300 mb-2">Bandeja de Soporte</h3>
      <p className="text-sm text-gray-500 text-center max-w-xs">
        Selecciona una conversacion de la lista para ver los mensajes y responder.
      </p>
    </motion.div>
  );
}

function NoChatsState({ searchQuery }: { searchQuery: string }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <MessageSquare className="w-8 h-8 text-gray-600" />
      </div>
      <p className="text-sm text-gray-500 text-center">
        {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones de soporte'}
      </p>
    </motion.div>
  );
}

/* ─── Status Action Menu ─────────────────────────────────────────────────── */

function StatusActionMenu({
  currentStatus,
  onStatusChange,
}: {
  currentStatus: string;
  onStatusChange: (status: 'open' | 'closed' | 'resolved') => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const availableStatuses = (['open', 'resolved', 'closed'] as const).filter(s => s !== currentStatus);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs"
      >
        <MoreVertical className="w-3.5 h-3.5" />
        <span>Estado</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full mt-1 w-40 rounded-xl glass-strong border border-white/10 overflow-hidden z-20"
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {availableStatuses.map(status => {
              const cfg = STATUS_CONFIG[status];
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => { onStatusChange(status); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-white/5"
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={cfg.text}>{cfg.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AdminChatPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();

  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatsRef = useRef<SupportChat[]>(chats);
  const soundEnabledRef = useRef(soundEnabled);

  // Keep refs in sync with state without triggering re-creations of callbacks
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  /* ── Derived State ────────────────────────────────────────────────── */

  const selectedChat = chats.find(c => c.id === selectedChatId) ?? null;

  const filteredChats = chats.filter(chat => {
    // Status filter
    if (statusFilter !== 'all' && chat.status !== statusFilter) return false;
    // Search filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      chat.user_name?.toLowerCase().includes(q) ||
      chat.subject?.toLowerCase().includes(q) ||
      chat.last_message_preview?.toLowerCase().includes(q) ||
      chat.user_role.toLowerCase().includes(q)
    );
  });

  /* ── Fetch Chats ──────────────────────────────────────────────────── */

  const fetchChats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('support_chats')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching chats:', error.message);
        return;
      }

      setChats((data as SupportChat[]) ?? []);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  /* ── Fetch Messages ───────────────────────────────────────────────── */

  const fetchMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error.message);
        return;
      }

      const msgs = (data as ChatMessage[]) ?? [];
      const prevCount = prevMessageCountRef.current;
      setMessages(msgs);
      prevMessageCountRef.current = msgs.length;

      // New messages from user arrived while we had this chat open
      if (msgs.length > prevCount && prevCount > 0 && soundEnabledRef.current) {
        playMessageSound();
      }

      // Mark admin unread as 0
      const currentChat = chatsRef.current.find(c => c.id === chatId);
      if (currentChat && currentChat.unread_by_admin > 0) {
        await supabase
          .from('support_chats')
          .update({ unread_by_admin: 0 })
          .eq('id', chatId);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  /* ── Select Chat ──────────────────────────────────────────────────── */

  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setMessageInput('');
    prevMessageCountRef.current = 0;
    fetchMessages(chatId);
  }, [fetchMessages]);

  /* ── Send Message ─────────────────────────────────────────────────── */

  const handleSendMessage = useCallback(async () => {
    const trimmed = messageInput.trim();
    if (!trimmed || !selectedChatId || sendingMessage) return;

    setSendingMessage(true);
    try {
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: selectedChatId,
          sender_type: 'admin',
          sender_id: user?.id,
          content: trimmed,
          message_type: 'text',
        });

      if (msgError) {
        toast.error('Error al enviar mensaje: ' + msgError.message);
        return;
      }

      const preview = trimmed.length > 80 ? trimmed.substring(0, 80) + '...' : trimmed;
      await supabase
        .from('support_chats')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
          unread_by_user: (selectedChat?.unread_by_user ?? 0) + 1,
        })
        .eq('id', selectedChatId);

      setMessageInput('');

      // Refetch messages from DB (no optimistic update — avoids duplicates)
      await Promise.all([fetchMessages(selectedChatId), fetchChats()]);
    } catch {
      toast.error('Error de conexion al enviar mensaje');
    } finally {
      setSendingMessage(false);
    }
  }, [messageInput, selectedChatId, sendingMessage, user, selectedChat, fetchMessages, fetchChats]);
  // NOTE: selectedChat is intentionally a dependency here so unread_by_user is current

  /* ── Change Chat Status ───────────────────────────────────────────── */

  const handleStatusChange = useCallback(async (newStatus: 'open' | 'closed' | 'resolved') => {
    if (!selectedChatId || updatingStatus) return;

    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('support_chats')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', selectedChatId);

      if (error) {
        toast.error('Error al actualizar estado: ' + error.message);
        return;
      }

      toast.success('Estado actualizado a ' + STATUS_CONFIG[newStatus].label);

      const statusMessages: Record<string, string> = {
        closed: 'El administrador cerro esta conversacion.',
        resolved: 'El administrador marco esta conversacion como resuelta.',
        open: 'El administrador reabrio esta conversacion.',
      };

      await supabase.from('chat_messages').insert({
        chat_id: selectedChatId,
        sender_type: 'admin',
        sender_id: user?.id,
        content: statusMessages[newStatus],
        message_type: 'system',
      });

      await Promise.all([fetchChats(), fetchMessages(selectedChatId)]);
    } catch {
      toast.error('Error de conexion al actualizar estado');
    } finally {
      setUpdatingStatus(false);
    }
  }, [selectedChatId, updatingStatus, user, fetchChats, fetchMessages]);

  /* ── Polling ──────────────────────────────────────────────────────── */

  useEffect(() => {
    fetchChats();

    const interval = setInterval(() => {
      fetchChats();
      if (selectedChatId) fetchMessages(selectedChatId);
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchChats, fetchMessages, selectedChatId]);

  /* ── Supabase Realtime ────────────────────────────────────────────── */

  useEffect(() => {
    // Subscribe to all support_chats changes
    const chatChannel = supabase
      .channel('admin-support-chats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_chats' },
        () => { fetchChats(); }
      )
      .subscribe();

    // Subscribe to active chat messages
    let msgChannel: ReturnType<typeof supabase.channel> | null = null;
    if (selectedChatId) {
      msgChannel = supabase
        .channel(`admin-chat-messages-${selectedChatId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `chat_id=eq.${selectedChatId}`,
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;
            // Skip messages sent by this admin — handleSendMessage already refetches
            if (newMsg.sender_type === 'admin') return;
            if (soundEnabled) {
              playMessageSound();
            }
            fetchMessages(selectedChatId);
          }
        )
        .subscribe();
      realtimeChannelRef.current = msgChannel;
    }

    return () => {
      supabase.removeChannel(chatChannel);
      if (msgChannel) supabase.removeChannel(msgChannel);
    };
  }, [fetchChats, fetchMessages, selectedChatId, soundEnabled]);

  /* ── Auto-scroll on new messages ──────────────────────────────────── */

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  /* ── Focus input on mobile ────────────────────────────────────────── */

  useEffect(() => {
    if (isMobile && selectedChatId && messages.length > 0) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isMobile, selectedChatId, messages.length]);

  /* ── Keyboard submit ──────────────────────────────────────────────── */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  /* ── Mobile back ──────────────────────────────────────────────────── */

  const handleBack = useCallback(() => {
    setSelectedChatId(null);
    setMessages([]);
  }, []);

  /* ── Counts ───────────────────────────────────────────────────────── */

  const totalUnread = chats.reduce((sum, c) => sum + (c.unread_by_admin || 0), 0);
  const openCount = chats.filter(c => c.status === 'open').length;

  /* ─── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center glow-cyan">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Chat de Soporte</h1>
            <p className="text-sm text-gray-500">
              {totalUnread > 0
                ? `${totalUnread} mensaje${totalUnread > 1 ? 's' : ''} sin leer`
                : `${chats.length} conversacion${chats.length !== 1 ? 'es' : ''} de soporte`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              soundEnabled
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-gray-500 border border-white/10'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {soundEnabled ? 'Sonido ON' : 'Sonido OFF'}
          </button>
        </div>
      </div>

      {/* Two-panel Layout */}
      <div className="glass rounded-2xl overflow-hidden flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}>
        {/* ── Left Panel: Chat List ────────────────────────────────── */}
        <div
          className={`w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-r border-white/5 flex flex-col ${
            isMobile && selectedChatId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Search + Status Filter */}
          <div className="p-3 border-b border-white/5 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Buscar conversaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-white/5 border-white/10 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
              />
            </div>
            {/* Status Filter */}
            <div className="flex gap-1">
              {([
                { key: 'all', label: 'Todos' },
                { key: 'open', label: `Abiertos${openCount > 0 ? ` (${openCount})` : ''}` },
                { key: 'resolved', label: 'Resueltos' },
                { key: 'closed', label: 'Cerrados' },
              ] as const).map(sf => (
                <button
                  key={sf.key}
                  type="button"
                  onClick={() => setStatusFilter(sf.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex-1 text-center ${
                    statusFilter === sf.key
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-white/5 text-gray-500 hover:text-white border border-transparent'
                  }`}
                >
                  {sf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {loadingChats ? (
              <ChatListSkeleton />
            ) : filteredChats.length > 0 ? (
              <div className="p-2 space-y-1">
                {filteredChats.map((chat, i) => (
                  <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.15 }}
                  >
                    <ChatListItem
                      chat={chat}
                      isSelected={chat.id === selectedChatId}
                      onClick={() => handleSelectChat(chat.id)}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <NoChatsState searchQuery={searchQuery} />
            )}
          </div>
        </div>

        {/* ── Right Panel: Messages ─────────────────────────────────── */}
        <div
          className={`flex-1 flex flex-col min-w-0 ${
            isMobile && !selectedChatId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {isMobile && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(selectedChat.user_role)} flex items-center justify-center ring-2 ${ROLE_COLORS[selectedChat.user_role]?.ring ?? 'ring-gray-500/40'}`}>
                    <span className="text-[11px] font-bold text-white">
                      {getInitials(selectedChat.user_name || 'User')}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {selectedChat.user_name || 'Usuario'}
                      </span>
                      <RoleBadge role={selectedChat.user_role} />
                      <StatusBadge status={selectedChat.status} />
                    </div>
                    {selectedChat.subject && (
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {selectedChat.subject}
                      </p>
                    )}
                  </div>
                </div>
                <StatusActionMenu
                  currentStatus={selectedChat.status}
                  onStatusChange={handleStatusChange}
                />
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {loadingMessages ? (
                  <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                        <Skeleton className={`h-12 ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'} rounded-2xl bg-white/5`} />
                      </div>
                    ))}
                  </div>
                ) : messages.length > 0 ? (
                  <div className="space-y-3">
                    {messages.map((msg, i) => (
                      <MessageBubble key={msg.id} message={msg} index={i} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                      <User className="w-7 h-7 text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-500">Sin mensajes aun</p>
                    <p className="text-xs text-gray-600 mt-1">Envia el primer mensaje</p>
                  </div>
                )}
              </div>

              {/* Message Input */}
              {selectedChat.status !== 'closed' && (
                <div className="px-4 py-3 border-t border-white/5 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Escribe un mensaje..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sendingMessage}
                      className="flex-1 h-10 bg-white/5 border-white/10 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:ring-cyan-500/20 disabled:opacity-50"
                    />
                    <Button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sendingMessage}
                      className="h-10 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white border-0 transition-all disabled:opacity-40"
                    >
                      {sendingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Closed chat notice */}
              {selectedChat.status === 'closed' && (
                <div className="px-4 py-3 border-t border-white/5 flex-shrink-0">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <XCircle className="w-4 h-4" />
                    <span className="text-xs">Esta conversacion esta cerrada. Cambia el estado para responder.</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}
