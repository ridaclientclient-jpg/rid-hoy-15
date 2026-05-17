'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { useAIStore } from '@/store/aiStore';

export default function AIAssistant() {
  const { messages, isOpen, isLoading, toggleChat, closeChat, sendMessage, clearChat } = useAIStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={toggleChat}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Asistente RIDA AI"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Bot className="w-6 h-6 text-white" />
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-36 right-4 z-50 w-[340px] max-h-[480px] rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(34, 211, 238, 0.15)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">RIDA AI</p>
                  <p className="text-xs text-green-400">En linea</p>
                </div>
              </div>
              <button onClick={closeChat} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[320px]">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="w-10 h-10 text-cyan-500/50 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Hola! Soy RIDA AI.</p>
                  <p className="text-xs text-gray-600 mt-1">En que puedo ayudarte?</p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[240px] rounded-2xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-cyan-600 text-white rounded-br-sm'
                        : 'bg-white/10 text-gray-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-3 h-3 text-gray-400" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-white/10 rounded-2xl px-3 py-2 rounded-bl-sm">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2 border-t border-white/10 flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta..."
                disabled={isLoading}
                maxLength={500}
                className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 flex items-center justify-center transition-colors"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>

            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-xs text-gray-600 hover:text-gray-400 py-1 transition-colors"
              >
                Limpiar chat
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
