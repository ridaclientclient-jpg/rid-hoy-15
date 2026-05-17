'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface RideMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  sender_role: 'client' | 'driver';
  content: string;
  message_type: 'text' | 'system';
  is_read: boolean;
  created_at: string;
}

interface RideChatProps {
  rideId: string;
  currentUserRole: 'client' | 'driver';
  currentUserId: string;
  otherUserName: string;
  isOpen: boolean;
  onClose: () => void;
}

const MAX_MESSAGE_LENGTH = 500;

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}

export default function RideChat({
  rideId,
  currentUserRole,
  currentUserId,
  otherUserName,
  isOpen,
  onClose,
}: RideChatProps) {
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hasSentInitialSystem = useRef(false);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Fetch messages on mount
  useEffect(() => {
    if (!rideId) return;

    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('ride_messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (!error && data) {
        setMessages(data as RideMessage[]);
      }
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`ride-chat-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_messages',
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const newMsg = payload.new as RideMessage;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [rideId]);

  // Send initial system message when chat opens for the first time
  useEffect(() => {
    if (isOpen && !hasSentInitialSystem.current && currentUserId && rideId) {
      hasSentInitialSystem.current = true;
      // Check if there's already a system message for this ride
      const hasSystemMsg = messages.some(
        (m) => m.message_type === 'system' && m.content === 'Chat de viaje iniciado'
      );
      if (!hasSystemMsg) {
        supabase.from('ride_messages').insert({
          ride_id: rideId,
          sender_id: currentUserId,
          sender_role: currentUserRole,
          content: 'Chat de viaje iniciado',
          message_type: 'system',
          is_read: true,
        }).then(({ error }) => {
          if (error) {
            console.error('Failed to send system message:', error);
          }
        });
      }
    }
  }, [isOpen, currentUserId, rideId, currentUserRole, messages]);

  // Mark messages as read
  useEffect(() => {
    if (!rideId || !currentUserId) return;
    const unreadIds = messages
      .filter((m) => m.sender_id !== currentUserId && !m.is_read)
      .map((m) => m.id);

    if (unreadIds.length === 0) return;

    supabase
      .from('ride_messages')
      .update({ is_read: true })
      .in('id', unreadIds)
      .then(() => {
        // Optimistically update local state
        setMessages((prev) =>
          prev.map((m) => (unreadIds.includes(m.id) ? { ...m, is_read: true } : m))
        );
      });
  }, [messages.length, rideId, currentUserId]);

  const sendMessage = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || sending) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) return;

    setSending(true);
    try {
      const { error } = await supabase.from('ride_messages').insert({
        ride_id: rideId,
        sender_id: currentUserId,
        sender_role: currentUserRole,
        content: trimmed,
        message_type: 'text',
        is_read: false,
      });

      if (error) {
        console.error('Failed to send message:', error);
        return;
      }

      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isOwnMessage = (msg: RideMessage) => msg.sender_id === currentUserId;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-20 right-3 z-50 w-[340px] max-w-[calc(100vw-24px)] h-[480px] max-h-[70vh] flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40"
          style={{
            background: 'rgba(15, 15, 20, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {otherUserName}
              </p>
              <p className="text-[10px] text-cyan-400">
                Chat de viaje
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <MessageSquare className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-xs text-gray-500">Aun no hay mensajes</p>
                <p className="text-[10px] text-gray-600 mt-1">
                  Escribe un mensaje para {otherUserName}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                // System message
                if (msg.message_type === 'system') {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <span className="text-[10px] text-gray-500 bg-white/5 px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                const own = isOwnMessage(msg);

                return (
                  <div
                    key={msg.id}
                    className={`flex ${own ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                        own
                          ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-br-md'
                          : 'bg-white/10 text-gray-100 rounded-bl-md'
                      }`}
                    >
                      {/* Show sender name for other user's messages */}
                      {!own && (
                        <p className="text-[10px] font-semibold text-cyan-400 mb-0.5">
                          {msg.sender_role === 'driver' ? 'Conductor' : otherUserName}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      <div className={`flex items-center gap-1 mt-1 ${own ? 'justify-end' : 'justify-start'}`}>
                        <p className="text-[9px] opacity-60">
                          {formatTime(msg.created_at)}
                        </p>
                        {own && (
                          <svg
                            className={`w-3 h-3 ${msg.is_read ? 'text-blue-200' : 'opacity-40'}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                    setNewMessage(e.target.value);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={`Mensaje para ${otherUserName}...`}
                maxLength={MAX_MESSAGE_LENGTH}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-cyan-500/50 focus:bg-white/8 transition-all"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed hover:from-cyan-400 hover:to-blue-500 transition-all shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            {newMessage.length > 0 && (
              <p className="text-[9px] text-gray-600 mt-1 text-right">
                {newMessage.length}/{MAX_MESSAGE_LENGTH}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Floating Chat Toggle Button — use this in both client and driver views
interface ChatToggleProps {
  onClick: () => void;
  unreadCount?: number;
}

export function ChatToggleButton({ onClick, unreadCount = 0 }: ChatToggleProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 transition-all active:scale-95"
    >
      <MessageSquare className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center border-2 border-[rgba(15,15,20,0.92)] animate-pulse">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
