'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Send, Loader2, MessageSquare,
  PlusCircle, XCircle, CheckCircle2, User, ShieldCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase, type SupportChat, type ChatMessage } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'client' | 'driver' | 'vendor' | 'courier';

interface SupportChatComponentProps {
  userRole: UserRole;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 5000;

// ── Role labels and colors ────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; text: string; border: string; icon: string }> = {
  client:  { label: 'Cliente',     bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/30',    icon: '●' },
  driver:  { label: 'Conductor',   bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '●' },
  vendor:  { label: 'Vendedor',    bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',   icon: '●' },
  courier: { label: 'Repartidor',  bg: 'bg-purple-500/15',  text: 'text-purple-400',  border: 'border-purple-500/30', icon: '●' },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  open:     { bg: 'bg-emerald-500/15',  text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400',    label: 'Abierto' },
  resolved: { bg: 'bg-blue-500/15',     text: 'text-blue-400',    border: 'border-blue-500/30',    dot: 'bg-blue-400',       label: 'Resuelto' },
  closed:   { bg: 'bg-gray-500/15',     text: 'text-gray-400',    border: 'border-gray-500/30',    dot: 'bg-gray-400',       label: 'Cerrado' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status === 'open' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.sender_type === 'user';
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
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
    >
      <div className="max-w-[80%] sm:max-w-[65%]">
        <div
          className={`px-4 py-2.5 rounded-2xl ${
            isUser
              ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-br-md'
              : 'glass text-gray-100 rounded-bl-md'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className={`flex items-center gap-1.5 mt-1 ${isUser ? 'justify-end' : 'justify-start'} px-1`}>
          <span className="text-[10px] text-gray-600">
            {formatMessageTime(message.created_at)}
          </span>
          {isUser && (
            <CheckCircle2 className="w-3 h-3 text-cyan-500/60" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Loading State ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
      <p className="text-sm text-gray-400">Cargando chat...</p>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center mb-4">
        <MessageSquare className="w-8 h-8 text-cyan-400/60" />
      </div>
      <h3 className="text-base font-semibold text-gray-300 mb-2">Sin mensajes aun</h3>
      <p className="text-sm text-gray-500 text-center max-w-xs">
        Escribe tu primer mensaje y nuestro equipo de soporte te ayudara lo antes posible.
      </p>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SupportChatComponent({ userRole }: SupportChatComponentProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  const [chat, setChat] = useState<SupportChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const chatIdRef = useRef<string | null>(null);

  // ── Create a new chat ───────────────────────────────────────────────

  const createChat = useCallback(async (): Promise<string | null> => {
    if (!user || creatingChat) return null;

    setCreatingChat(true);
    try {
      const { data, error } = await supabase
        .from('support_chats')
        .insert({
          user_id: user.id,
          user_name: user.name,
          user_role: userRole,
          subject: 'Soporte general',
          status: 'open',
          last_message_at: new Date().toISOString(),
          last_message_preview: '',
          unread_by_admin: 0,
          unread_by_user: 0,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating chat:', error.message);
        toast.error('Error al crear el chat de soporte');
        return null;
      }

      return (data as SupportChat).id;
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Error de conexion al crear chat');
      return null;
    } finally {
      setCreatingChat(false);
    }
  }, [user, userRole, creatingChat]);

  // ── Find or create chat on mount ────────────────────────────────────

  const initializeChat = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Check for existing open chat
      const { data: existingChats, error: fetchError } = await supabase
        .from('support_chats')
        .select('*')
        .eq('user_id', user.id)
        .eq('user_role', userRole)
        .order('last_message_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('Error fetching chat:', fetchError.message);
        setLoading(false);
        return;
      }

      // Find an open chat first, otherwise use the most recent one
      const openChat = (existingChats as SupportChat[]).find((c) => c.status === 'open');
      const latestChat = (existingChats as SupportChat[])[0];

      const activeChat = openChat ?? latestChat;

      if (activeChat) {
        setChat(activeChat);
        chatIdRef.current = activeChat.id;

        // Mark admin messages as read (reset unread_by_user)
        if (activeChat.unread_by_user > 0) {
          await supabase
            .from('support_chats')
            .update({ unread_by_user: 0 })
            .eq('id', activeChat.id);
        }

        // Fetch messages
        const { data: msgs, error: msgsError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_id', activeChat.id)
          .order('created_at', { ascending: true });

        if (!msgsError) {
          setMessages((msgs as ChatMessage[]) ?? []);
          prevMessageCountRef.current = (msgs as ChatMessage[])?.length ?? 0;
        }
      } else {
        // Create new chat
        const newChatId = await createChat();
        if (newChatId) {
          const { data: newChat } = await supabase
            .from('support_chats')
            .select('*')
            .eq('id', newChatId)
            .single();

          if (newChat) {
            setChat(newChat as SupportChat);
            chatIdRef.current = newChatId;
          }
        }
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      toast.error('Error al cargar el chat de soporte');
    } finally {
      setLoading(false);
    }
  }, [user, userRole, createChat]);

  // ── Refresh messages and chat status ────────────────────────────────

  const refreshData = useCallback(async () => {
    const currentChatId = chatIdRef.current;
    if (!currentChatId) return;

    try {
      // Fetch latest messages
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', currentChatId)
        .order('created_at', { ascending: true });

      if (msgs) {
        setMessages(msgs as ChatMessage[]);
        prevMessageCountRef.current = msgs.length;
      }

      // Refresh chat status
      const { data: chatData } = await supabase
        .from('support_chats')
        .select('*')
        .eq('id', currentChatId)
        .single();

      if (chatData) {
        setChat(chatData as SupportChat);

        // Mark admin messages as read
        if ((chatData as SupportChat).unread_by_user > 0) {
          await supabase
            .from('support_chats')
            .update({ unread_by_user: 0 })
            .eq('id', currentChatId);
        }
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }, []);

  // ── Send message ────────────────────────────────────────────────────

  const handleSendMessage = useCallback(async () => {
    const trimmed = messageInput.trim();
    if (!trimmed || !chatIdRef.current || sendingMessage) return;

    setSendingMessage(true);
    try {
      // Insert message
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatIdRef.current,
          sender_type: 'user',
          sender_id: user?.id,
          content: trimmed,
          message_type: 'text',
        });

      if (msgError) {
        toast.error('Error al enviar mensaje: ' + msgError.message);
        return;
      }

      // Update chat's last message info
      const preview = trimmed.length > 80 ? trimmed.substring(0, 80) + '...' : trimmed;
      const currentChat = chat;
      const { error: chatError } = await supabase
        .from('support_chats')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
          unread_by_admin: (currentChat?.unread_by_admin ?? 0) + 1,
        })
        .eq('id', chatIdRef.current);

      if (chatError) {
        console.error('Error updating chat:', chatError.message);
      }

      setMessageInput('');

      // Optimistically add message
      const optimisticMsg: ChatMessage = {
        id: 'temp-' + Date.now(),
        chat_id: chatIdRef.current,
        sender_type: 'user',
        sender_id: user?.id,
        content: trimmed,
        message_type: 'text',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      // Refresh from server
      await refreshData();
    } catch (error) {
      toast.error('Error de conexion al enviar mensaje');
      console.error('Send message error:', error);
    } finally {
      setSendingMessage(false);
    }
  }, [messageInput, sendingMessage, user, chat, refreshData]);

  // ── Handle creating a new chat (when current is closed/resolved) ───

  const handleNewChat = useCallback(async () => {
    const newChatId = await createChat();
    if (newChatId) {
      const { data: newChat } = await supabase
        .from('support_chats')
        .select('*')
        .eq('id', newChatId)
        .single();

      if (newChat) {
        setChat(newChat as SupportChat);
        chatIdRef.current = newChatId;
        setMessages([]);
        prevMessageCountRef.current = 0;
        setMessageInput('');
        toast.success('Nuevo chat creado');
      }
    }
  }, [createChat]);

  // ── Initialize on mount ─────────────────────────────────────────────

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  // ── Polling every 5 seconds ────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [refreshData]);

  // ── Auto-scroll on new messages ────────────────────────────────────

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // ── Keyboard submit ────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // ── Check if chat is active ────────────────────────────────────────

  const isChatActive = chat && (chat.status === 'open' || chat.status === 'resolved');

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-[#0a0e1a] flex flex-col z-50">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-white">Soporte RIDA</h1>
              {chat && <StatusBadge status={chat.status} />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {user && (
                <>
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                    <User className="w-3 h-3" />
                    {user.name}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${ROLE_CONFIG[userRole].bg} ${ROLE_CONFIG[userRole].text} ${ROLE_CONFIG[userRole].border}`}>
                    {ROLE_CONFIG[userRole].icon} {ROLE_CONFIG[userRole].label}
                  </span>
                </>
              )}
              {!isChatActive && (
                <span className="text-[11px] text-gray-600 ml-1">
                  Conversacion finalizada
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Messages Area ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <LoadingState />
        ) : messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <MessageBubble key={msg.id} message={msg} index={i} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <EmptyState />
        )}

        {/* Closed/Resolved Notice */}
        {!loading && chat && !isChatActive && (
          <motion.div
            className="mt-6 mx-auto max-w-xs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col items-center gap-3 px-5 py-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 text-gray-400">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">
                  {chat.status === 'closed'
                    ? 'Esta conversacion esta cerrada.'
                    : 'Esta conversacion fue resuelta.'}
                </span>
              </div>
              <Button
                type="button"
                onClick={handleNewChat}
                disabled={creatingChat}
                className="w-full h-10 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white border-0 transition-all text-sm font-medium"
              >
                {creatingChat ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Nuevo chat
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Input Area ────────────────────────────────────────────────── */}
      {isChatActive && (
        <div className="px-4 py-3 border-t border-white/5 flex-shrink-0 bg-[#0a0e1a]">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Escribe tu mensaje..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sendingMessage}
              className="flex-1 h-11 bg-white/5 border-white/10 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:ring-cyan-500/20 disabled:opacity-50 rounded-xl"
            />
            <Button
              type="button"
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sendingMessage}
              className="h-11 w-11 px-0 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white border-0 transition-all rounded-xl disabled:opacity-40 flex items-center justify-center"
            >
              {sendingMessage ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
