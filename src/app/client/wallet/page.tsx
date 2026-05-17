'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft,
  CreditCard, Loader2, AlertCircle, Info, X, Banknote,
  TrendingUp, TrendingDown, History, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useCallback } from 'react';

export default function ClientWallet() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeLoading, setRechargeLoading] = useState(false);

  const fetchWalletData = useCallback(async () => {
    if (!user?.id) return;
    try {
      // 1. Get Balance from Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .single();
      
      if (profile) setBalance(profile.balance || 0);

      // 2. Get Transactions
      const { data: txs } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (txs) setTransactions(txs);
    } catch (err) {
      console.error('Wallet fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const handleRecharge = async () => {
    const amount = parseInt(rechargeAmount);
    if (!amount || amount < 500) {
      toast.error('El monto mínimo es ₡500');
      return;
    }

    setRechargeLoading(true);
    try {
      const { error } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user?.id,
          amount: amount,
          type: 'credit',
          category: 'deposit',
          description: 'Recarga de saldo via App'
        });

      if (error) throw error;

      toast.success('¡Recarga exitosa!', {
        description: `Se han añadido ₡${amount.toLocaleString()} a tu cuenta.`
      });
      setShowRecharge(false);
      setRechargeAmount('');
      fetchWalletData();
    } catch (err) {
      toast.error('Error al procesar recarga');
    } finally {
      setRechargeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 h-screen">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Cargando tus finanzas...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-rida-dark p-4 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-2xl font-black text-white">Billetera</h1>
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
          <WalletIcon className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Balance Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-amber-600 rounded-[2.5rem] p-8 shadow-xl shadow-orange-500/20"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <WalletIcon className="w-32 h-32 rotate-12" />
        </div>
        
        <p className="text-orange-100/70 text-xs font-bold uppercase tracking-widest mb-1">Saldo Disponible</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-white">₡{balance.toLocaleString()}</span>
          <span className="text-orange-100/50 text-sm">CRC</span>
        </div>

        <div className="mt-8 flex gap-3">
          <button 
            onClick={() => setShowRecharge(true)}
            className="flex-1 bg-white text-orange-600 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-black/10 active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" />
            Recargar
          </button>
          <button 
            onClick={() => toast.info('Función de retiro próximamente')}
            className="flex-1 bg-black/20 backdrop-blur-md text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-white/10 active:scale-95 transition-transform"
          >
            <Banknote className="w-4 h-4" />
            Retirar
          </button>
        </div>
      </motion.div>

      {/* Stats Mini Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-3xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Ingresos</p>
            <p className="text-sm font-bold text-white">₡{transactions.filter(t => t.type === 'credit').reduce((a,b) => a + b.amount, 0).toLocaleString()}</p>
          </div>
        </div>
        <div className="glass rounded-3xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Gastos</p>
            <p className="text-sm font-bold text-white">₡{transactions.filter(t => t.type === 'debit').reduce((a,b) => a + b.amount, 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Transactions History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-orange-400" />
            Actividad Reciente
          </h3>
          <button className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ver todo</button>
        </div>

        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="glass rounded-3xl p-8 text-center">
              <Info className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-xs">No hay movimientos registrados aún.</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <motion.div 
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass rounded-3xl p-4 flex items-center justify-between border border-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    tx.type === 'credit' ? 'bg-emerald-500/10' : 'bg-white/5'
                  }`}>
                    {tx.type === 'credit' ? (
                      <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{tx.description || 'Transacción'}</p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(tx.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black ${
                    tx.type === 'credit' ? 'text-emerald-400' : 'text-white'
                  }`}>
                    {tx.type === 'credit' ? '+' : '-'} ₡{tx.amount.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-gray-600 uppercase font-black">{tx.category}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Recharge Modal */}
      <AnimatePresence>
        {showRecharge && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowRecharge(false)}
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-[#0c1018] rounded-t-[2.5rem] p-8 space-y-6 border-t border-white/10"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white">Recargar Saldo</h3>
                <button onClick={() => setShowRecharge(false)} className="p-2 rounded-full bg-white/5">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-gray-400">Ingresa el monto que deseas recargar en tu billetera Rid@.</p>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-orange-500">₡</span>
                  <input 
                    type="number"
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-3xl py-6 pl-14 pr-6 text-3xl font-black text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[2000, 5000, 10000].map((amt) => (
                    <button 
                      key={amt}
                      onClick={() => setRechargeAmount(amt.toString())}
                      className="py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:bg-orange-500/10 hover:border-orange-500/30 transition-all"
                    >
                      + ₡{amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleRecharge}
                  disabled={rechargeLoading}
                  className="w-full py-5 rounded-[1.5rem] bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2"
                >
                  {rechargeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Recarga'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
