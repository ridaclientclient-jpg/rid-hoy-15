'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Car, TrendingUp, Award, Diamond, Crown, Medal, ChevronDown } from 'lucide-react';

interface DriverEntry {
  rank: number;
  driver_id: string;
  driver_name: string;
  avatar_url: string | null;
  vehicle: string | null;
  plate: string | null;
  total_rides: number;
  total_earnings: number;
  avg_rating: number;
  acceptance_rate: number;
  level: string;
}

const LEVEL_STYLES: Record<string, { color: string; bg: string; icon: any }> = {
  Diamante: { color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Diamond },
  Platino: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: Diamond },
  Oro: { color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Trophy },
  Plata: { color: 'text-gray-300', bg: 'bg-gray-300/20', icon: Medal },
  Bronce: { color: 'text-amber-600', bg: 'bg-amber-700/20', icon: Award },
  Basico: { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: Star },
};

export default function AdminLeaderboard() {
  const [drivers, setDrivers] = useState<DriverEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  const periods = [
    { id: 'today', label: 'Hoy' },
    { id: 'week', label: 'Esta Semana' },
    { id: 'month', label: 'Este Mes' },
    { id: 'all', label: 'Historico' },
  ];

  useEffect(() => {
    fetchLeaderboard();
  }, [period]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?period=${period}&limit=20`);
      const data = await res.json();
      if (data.success) setDrivers(data.drivers);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-amber-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-700" />;
    return <span className="text-sm font-bold text-gray-500">#{rank}</span>;
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/20';
    if (rank === 2) return 'bg-gradient-to-r from-gray-400/10 to-gray-300/10 border-gray-400/20';
    if (rank === 3) return 'bg-gradient-to-r from-amber-700/10 to-amber-600/10 border-amber-700/20';
    return 'glass';
  };

  const topThree = drivers.slice(0, 3);
  const rest = drivers.slice(3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            Leaderboard Conductores
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Top conductores por ganancias y rendimiento
          </p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              period === p.id
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/20'
                : 'glass text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : drivers.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No hay datos disponibles para este periodo</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {topThree.length >= 3 && (
            <div className="grid grid-cols-3 gap-3">
              {/* 2nd Place */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-2xl p-4 text-center border border-gray-400/10 mt-6"
              >
                <div className="flex justify-center mb-2">{getRankBadge(2)}</div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-300 flex items-center justify-center text-white font-bold mx-auto mb-2">
                  {topThree[1].driver_name?.charAt(0) || 'C'}
                </div>
                <p className="text-sm font-semibold text-white truncate">{topThree[1].driver_name}</p>
                <p className="text-[10px] text-gray-500 truncate">{topThree[1].vehicle}</p>
                <p className="text-lg font-bold text-white mt-2">
                  ₡{topThree[1].total_earnings >= 1000000
                    ? `${(topThree[1].total_earnings / 1000000).toFixed(1)}M`
                    : `${Math.round(topThree[1].total_earnings / 1000)}k`}
                </p>
                <p className="text-[10px] text-gray-500">{topThree[1].total_rides} viajes</p>
              </motion.div>

              {/* 1st Place */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                className="glass-strong rounded-2xl p-4 text-center border border-amber-500/30 shadow-lg shadow-amber-500/10"
              >
                <div className="flex justify-center mb-2">{getRankBadge(1)}</div>
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-white font-bold mx-auto mb-2 text-lg">
                  {topThree[0].driver_name?.charAt(0) || 'C'}
                </div>
                <p className="text-sm font-semibold text-white truncate">{topThree[0].driver_name}</p>
                <p className="text-[10px] text-gray-500 truncate">{topThree[0].vehicle}</p>
                <p className="text-xl font-bold text-amber-400 mt-2">
                  ₡{topThree[0].total_earnings >= 1000000
                    ? `${(topThree[0].total_earnings / 1000000).toFixed(1)}M`
                    : `${Math.round(topThree[0].total_earnings / 1000)}k`}
                </p>
                <p className="text-[10px] text-gray-500">{topThree[0].total_rides} viajes</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-[10px] text-amber-400">{topThree[0].avg_rating}</span>
                </div>
              </motion.div>

              {/* 3rd Place */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass rounded-2xl p-4 text-center border border-amber-700/10 mt-6"
              >
                <div className="flex justify-center mb-2">{getRankBadge(3)}</div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-700 to-amber-600 flex items-center justify-center text-white font-bold mx-auto mb-2">
                  {topThree[2].driver_name?.charAt(0) || 'C'}
                </div>
                <p className="text-sm font-semibold text-white truncate">{topThree[2].driver_name}</p>
                <p className="text-[10px] text-gray-500 truncate">{topThree[2].vehicle}</p>
                <p className="text-lg font-bold text-white mt-2">
                  ₡{topThree[2].total_earnings >= 1000000
                    ? `${(topThree[2].total_earnings / 1000000).toFixed(1)}M`
                    : `${Math.round(topThree[2].total_earnings / 1000)}k`}
                </p>
                <p className="text-[10px] text-gray-500">{topThree[2].total_rides} viajes</p>
              </motion.div>
            </div>
          )}

          {/* Rest of the list */}
          <div className="space-y-2">
            {rest.map((d, i) => {
              const levelStyle = LEVEL_STYLES[d.level] || LEVEL_STYLES.Basico;
              const LevelIcon = levelStyle.icon;
              return (
                <motion.div
                  key={d.driver_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className={`rounded-xl p-3 border ${getRankBg(d.rank)}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 flex justify-center shrink-0">{getRankBadge(d.rank)}</div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {d.driver_name?.charAt(0) || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-white truncate">{d.driver_name}</p>
                        <div className={`px-1.5 py-0.5 rounded-md ${levelStyle.bg} flex items-center gap-0.5 shrink-0`}>
                          <LevelIcon className={`w-2.5 h-2.5 ${levelStyle.color}`} />
                          <span className={`text-[8px] font-bold ${levelStyle.color}`}>{d.level}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-gray-500 truncate">{d.vehicle}</span>
                        <div className="flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                          <span className="text-[10px] text-amber-400">{d.avg_rating}</span>
                        </div>
                        <span className="text-[10px] text-gray-500">{d.total_rides} viajes</span>
                        <span className="text-[10px] text-emerald-400">{d.acceptance_rate}% acept.</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white">
                        ₡{d.total_earnings >= 1000000
                          ? `${(d.total_earnings / 1000000).toFixed(1)}M`
                          : `${Math.round(d.total_earnings / 1000)}k`}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-white">{drivers.length}</p>
              <p className="text-[10px] text-gray-500">Conductores activos</p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-400">
                ₡{drivers.reduce((s, d) => s + d.total_earnings, 0) >= 1000000
                  ? `${(drivers.reduce((s, d) => s + d.total_earnings, 0) / 1000000).toFixed(1)}M`
                  : `${Math.round(drivers.reduce((s, d) => s + d.total_earnings, 0) / 1000)}k`}
              </p>
              <p className="text-[10px] text-gray-500">Total ganado</p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-cyan-400">
                {(drivers.reduce((s, d) => s + d.total_rides, 0))}
              </p>
              <p className="text-[10px] text-gray-500">Total viajes</p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-emerald-400">
                {drivers.length > 0 ? (drivers.reduce((s, d) => s + d.avg_rating, 0) / drivers.length).toFixed(2) : '0'}
              </p>
              <p className="text-[10px] text-gray-500">Rating promedio</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
