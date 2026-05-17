import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;

  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (message: string) => Promise<void>;
  clearChat: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  messages: [],
  isOpen: false,
  isLoading: false,

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  sendMessage: async (message: string) => {
    if (!message.trim() || get().isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, userMsg],
      isLoading: true,
    }));

    try {
      const { data: { session } } = await (
        await import('@/lib/supabase')
      ).supabase.auth.getSession();

      const history = get().messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ message: message.trim(), context: history }),
      });

      const data = await res.json();

      if (data.success && data.response) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };
        set((state) => ({
          messages: [...state.messages, aiMsg],
          isLoading: false,
        }));
      } else {
        throw new Error(data.error || 'Sin respuesta');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Lo siento, hubo un error de conexion. Intenta de nuevo.',
        timestamp: new Date(),
      };
      set((state) => ({
        messages: [...state.messages, errorMsg],
        isLoading: false,
      }));
    }
  },

  clearChat: () => set({ messages: [] }),
}));
