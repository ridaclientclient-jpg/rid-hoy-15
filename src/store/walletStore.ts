import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface WalletData {
  id: string;
  user_id: string;
  balance: number;
  total_earnings: number;
  total_withdrawn: number;
}

export interface TransactionItem {
  id: string;
  wallet_id: string;
  amount: number;
  type: 'credit' | 'debit' | 'withdrawal' | 'commission' | 'ride_payment';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  description?: string;
  ride_id?: string;
  created_at: string;
}

interface WalletState {
  wallet: WalletData | null;
  transactions: TransactionItem[];
  isLoading: boolean;
  isWithdrawing: boolean;
  isTopUp: boolean;
  pageSize: number;
  currentPage: number;
  filterType: string;
  dateFrom: string | null;
  dateTo: string | null;
  totalTxCount: number;
  hasMore: boolean;

  fetchWallet: (userId: string) => Promise<void>;
  fetchTransactions: (walletId: string) => Promise<void>;
  requestWithdrawal: (walletId: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  addBalance: (walletId: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  subscribeToChanges: (walletId: string) => () => void;
  setFilterType: (type: string) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  loadMore: (walletId: string) => Promise<void>;
  resetFilters: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  transactions: [],
  isLoading: false,
  isWithdrawing: false,
  isTopUp: false,
  pageSize: 10,
  currentPage: 1,
  filterType: 'all',
  dateFrom: null,
  dateTo: null,
  totalTxCount: 0,
  hasMore: false,

  fetchWallet: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Wallet might not exist yet — create one
        if (error.code === 'PGRST116') {
          const { data: newWallet, error: insertError } = await supabase
            .from('wallets')
            .insert({ user_id: userId })
            .select()
            .single();
          if (!insertError && newWallet) {
            set({ wallet: newWallet as WalletData, isLoading: false });
            return;
          }
        }
        set({ isLoading: false });
        return;
      }

      set({ wallet: data as WalletData, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchTransactions: async (walletId: string) => {
    const state = get();
    try {
      // Build count query
      let countQuery = supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_id', walletId);

      if (state.filterType !== 'all') {
        countQuery = countQuery.eq('type', state.filterType);
      }
      if (state.dateFrom) {
        countQuery = countQuery.gte('created_at', state.dateFrom + 'T00:00:00');
      }
      if (state.dateTo) {
        countQuery = countQuery.lte('created_at', state.dateTo + 'T23:59:59');
      }

      const { count } = await countQuery;
      const total = count || 0;

      // Build data query
      let dataQuery = supabase
        .from('transactions')
        .select('*')
        .eq('wallet_id', walletId);

      if (state.filterType !== 'all') {
        dataQuery = dataQuery.eq('type', state.filterType);
      }
      if (state.dateFrom) {
        dataQuery = dataQuery.gte('created_at', state.dateFrom + 'T00:00:00');
      }
      if (state.dateTo) {
        dataQuery = dataQuery.lte('created_at', state.dateTo + 'T23:59:59');
      }

      const end = state.currentPage * state.pageSize;
      const { data, error } = await dataQuery
        .order('created_at', { ascending: false })
        .range(0, end - 1);

      if (!error && data) {
        set({
          transactions: data as TransactionItem[],
          totalTxCount: total,
          hasMore: data.length < total,
        });
      }
    } catch {
      // Silently ignore
    }
  },

  setFilterType: (type: string) => {
    set({ filterType: type, currentPage: 1 });
  },

  setDateRange: (from: string | null, to: string | null) => {
    set({ dateFrom: from, dateTo: to, currentPage: 1 });
  },

  loadMore: async (walletId: string) => {
    const nextPage = get().currentPage + 1;
    set({ currentPage: nextPage });
    await get().fetchTransactions(walletId);
  },

  resetFilters: () => {
    set({
      filterType: 'all',
      dateFrom: null,
      dateTo: null,
      currentPage: 1,
    });
  },

  requestWithdrawal: async (walletId: string, amount: number) => {
    const state = get();
    if (!state.wallet || state.wallet.balance < amount) {
      return { success: false, error: 'Saldo insuficiente' };
    }

    set({ isWithdrawing: true });
    try {
      // Check daily withdrawal limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_id', walletId)
        .eq('type', 'withdrawal')
        .gte('created_at', today.toISOString());

      if ((count || 0) >= 1) {
        set({ isWithdrawing: false });
        return { success: false, error: 'Ya realizaste un retiro hoy. Maximo 1 retiro por dia.' };
      }

      // Check minimum withdrawal amount
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'min_withdrawal_amount')
        .single();
      const minAmount = Number(settings?.value || 10000);
      if (amount < minAmount) {
        set({ isWithdrawing: false });
        return { success: false, error: `Monto minimo de retiro: ₡${minAmount.toLocaleString()}` };
      }

      // Create withdrawal transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          wallet_id: walletId,
          amount: -amount,
          type: 'withdrawal',
          status: 'processing',
          description: `Retiro de ₡${amount.toLocaleString()} — Procesando en 24h`,
        });

      if (txError) {
        set({ isWithdrawing: false });
        return { success: false, error: 'Error al procesar retiro' };
      }

      // Update wallet balance
      const newBalance = state.wallet.balance - amount;
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance, total_withdrawn: state.wallet.total_withdrawn + amount })
        .eq('id', walletId);

      if (updateError) {
        set({ isWithdrawing: false });
        return { success: false, error: 'Error al actualizar saldo' };
      }

      set({
        wallet: { ...state.wallet, balance: newBalance, total_withdrawn: state.wallet.total_withdrawn + amount },
        isWithdrawing: false,
      });

      // Refresh transactions
      get().fetchTransactions(walletId);

      return { success: true };
    } catch {
      set({ isWithdrawing: false });
      return { success: false, error: 'Error de conexion' };
    }
  },

  addBalance: async (walletId: string, amount: number) => {
    const state = get();
    if (amount <= 0) {
      return { success: false, error: 'El monto debe ser mayor a 0' };
    }
    if (amount > 500000) {
      return { success: false, error: 'Monto maximo por recarga: ₡500,000' };
    }

    set({ isTopUp: true });
    try {
      // Create credit transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          wallet_id: walletId,
          amount: amount,
          type: 'credit',
          status: 'completed',
          description: `Recarga de saldo — ₡${amount.toLocaleString()}`,
        });

      if (txError) {
        set({ isTopUp: false });
        return { success: false, error: 'Error al procesar recarga' };
      }

      // Update wallet balance
      const newBalance = (state.wallet?.balance || 0) + amount;
      const newEarnings = (state.wallet?.total_earnings || 0) + amount;
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance, total_earnings: newEarnings })
        .eq('id', walletId);

      if (updateError) {
        set({ isTopUp: false });
        return { success: false, error: 'Error al actualizar saldo' };
      }

      set({
        wallet: {
          ...(state.wallet as WalletData),
          balance: newBalance,
          total_earnings: newEarnings,
        },
        isTopUp: false,
      });

      // Refresh transactions
      get().fetchTransactions(walletId);

      return { success: true };
    } catch {
      set({ isTopUp: false });
      return { success: false, error: 'Error de conexion' };
    }
  },

  subscribeToChanges: (walletId: string) => {
    const channel = supabase
      .channel(`wallet-${walletId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `id=eq.${walletId}` },
        (payload) => {
          set({ wallet: payload.new as WalletData });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `wallet_id=eq.${walletId}` },
        () => {
          get().fetchTransactions(walletId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
