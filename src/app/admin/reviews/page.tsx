'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Search, MessageSquare, Loader2, Eye, X, ChevronLeft,
  ChevronRight, ChevronsLeft, ChevronsRight, User, TrendingUp,
  AlertTriangle, ThumbsUp, ArrowLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ReviewRow {
  id: string;
  rideId: string;
  reviewerName: string;
  revieweeName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  fiveStars: number;
  oneStar: number;
}

const PAGE_SIZE = 20;

function formatCreatedAt(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Star display component
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }[size];

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'fill-gray-700 text-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
              <div className="w-4 h-4 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="h-7 w-12 bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
      {/* Filter bar skeleton */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 w-20 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      {/* Table skeleton */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="border-b border-white/5">
          <div className="flex gap-4 px-5 py-3">
            {['w-16', 'w-24', 'w-24', 'w-20', 'w-32', 'w-16'].map((w, i) => (
              <div key={i} className={`h-3 ${w} bg-white/5 rounded animate-pulse`} />
            ))}
          </div>
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-white/5">
            <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
            <div className="flex items-center gap-2 w-32">
              <div className="w-7 h-7 rounded-full bg-white/5 animate-pulse" />
              <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="w-3.5 h-3.5 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
            <div className="h-4 w-40 bg-white/5 rounded animate-pulse" />
            <div className="w-8 h-8 bg-white/5 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

const RATING_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: '5', label: '5 estrellas' },
  { key: '4', label: '4 estrellas' },
  { key: '3', label: '3 estrellas' },
  { key: '2', label: '2 estrellas' },
  { key: '1', label: '1 estrella' },
];

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setReviews([]);
        setLoading(false);
        return;
      }

      // Gather all reviewer and reviewee user IDs
      const allUserIds = [...new Set([
        ...data.map(r => r.reviewer_id),
        ...data.map(r => r.reviewee_id),
      ].filter(Boolean))];

      const profileMap: Record<string, string> = {};

      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', allUserIds);
        if (profiles) {
          profiles.forEach(p => { profileMap[p.id] = p.name; });
        }
      }

      const mapped: ReviewRow[] = data.map(r => ({
        id: r.id,
        rideId: r.ride_id || '',
        reviewerName: profileMap[r.reviewer_id] || 'Desconocido',
        revieweeName: profileMap[r.reviewee_id] || 'Desconocido',
        rating: Number(r.rating) || 0,
        comment: r.comment || '',
        createdAt: formatCreatedAt(r.created_at),
      }));

      setReviews(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al cargar resenas: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Filtered data
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      const matchSearch = !search ||
        r.reviewerName.toLowerCase().includes(search.toLowerCase()) ||
        r.revieweeName.toLowerCase().includes(search.toLowerCase()) ||
        r.comment.toLowerCase().includes(search.toLowerCase());

      const matchRating = ratingFilter === 'all' || r.rating === parseInt(ratingFilter);

      return matchSearch && matchRating;
    });
  }, [reviews, search, ratingFilter]);

  // Stats from all reviews
  const stats: ReviewStats = useMemo(() => {
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return {
      totalReviews: total,
      averageRating: total > 0 ? parseFloat((sum / total).toFixed(1)) : 0,
      fiveStars: reviews.filter(r => r.rating === 5).length,
      oneStar: reviews.filter(r => r.rating === 1).length,
    };
  }, [reviews]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE));
  const paginatedReviews = filteredReviews.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = filteredReviews.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, filteredReviews.length);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, ratingFilter]);

  // Rating distribution for the detail modal
  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    reviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++;
    });
    return dist;
  }, [reviews]);

  const statCards = [
    { label: 'Total Resenas', value: stats.totalReviews.toLocaleString(), color: 'text-cyan-400', icon: MessageSquare },
    { label: 'Promedio General', value: stats.averageRating.toFixed(1), color: 'text-amber-400', icon: TrendingUp },
    { label: '5 Estrellas', value: stats.fiveStars.toLocaleString(), color: 'text-emerald-400', icon: ThumbsUp },
    { label: '1 Estrella', value: stats.oneStar.toLocaleString(), color: 'text-red-400', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Resenas y Calificaciones</h1>
        <p className="text-gray-400 mt-1">Monitoreo de resenas, calificaciones y satisfaccion de usuarios</p>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRightIcon className="w-3 h-3" />
        <span className="text-white font-medium">Resenas</span>
      </div>

      {/* Stats */}
      {!loading && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              className="glass rounded-xl p-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <Icon className={`w-4 h-4 ${stat.color} opacity-60`} />
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </motion.div>
          );
        })}
      </div>
      )}

      {/* Search & Filters */}
      {!loading && (
      <div className="glass rounded-2xl p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre de pasajero o conductor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {RATING_FILTERS.map((rf) => (
            <button
              key={rf.key}
              onClick={() => setRatingFilter(rf.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                ratingFilter === rf.key
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {rf.key !== 'all' && (
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              )}
              {rf.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Table */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Pasajero</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Conductor</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Calificacion</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Comentario</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {paginatedReviews.map((r, i) => (
                      <motion.tr
                        key={r.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 + i * 0.02 }}
                      >
                        <td className="px-5 py-3 text-sm text-gray-400 whitespace-nowrap">{r.createdAt}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                              <User className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <span className="text-sm text-white">{r.reviewerName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-400 hidden md:table-cell">{r.revieweeName}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <StarRating rating={r.rating} />
                            <span className="text-xs text-gray-500">{Number(r.rating).toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-400 hidden lg:table-cell max-w-[200px] truncate">{r.comment || 'Sin comentario'}</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setSelectedReview(r)}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all ml-auto"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {filteredReviews.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron resenas</p>
              </div>
            )}

            {/* Pagination */}
            {filteredReviews.length > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-white/5">
                <p className="text-xs text-gray-400">
                  Mostrando {showingFrom}-{showingTo} de {filteredReviews.length} resenas
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {pageNumbers.map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`min-w-[2rem] h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                        page === pageNum
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Review Detail Modal */}
      <AnimatePresence>
        {selectedReview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedReview(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Detalle de Resena</h2>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Rating + Stars */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-amber-400">{Number(selectedReview.rating).toFixed(1)}</span>
                </div>
                <div className="flex-1">
                  <StarRating rating={selectedReview.rating} size="lg" />
                  <p className="text-xs text-gray-500 mt-1">{selectedReview.createdAt}</p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500">Pasajero</p>
                  <p className="text-sm text-white mt-0.5">{selectedReview.reviewerName}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500">Conductor</p>
                  <p className="text-sm text-white mt-0.5">{selectedReview.revieweeName}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500">ID Viaje</p>
                  <p className="text-sm text-cyan-400 font-mono mt-0.5">
                    {selectedReview.rideId ? selectedReview.rideId.slice(0, 8).toUpperCase() : 'N/A'}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500">ID Resena</p>
                  <p className="text-sm text-cyan-400 font-mono mt-0.5">
                    {selectedReview.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Comment */}
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Comentario</p>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {selectedReview.comment || 'Sin comentario'}
                </p>
              </div>

              {/* Rating Distribution */}
              <div className="mt-4 bg-white/5 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Distribucion de Calificaciones</p>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = ratingDistribution[star - 1];
                    const maxCount = Math.max(...ratingDistribution, 1);
                    const pct = (count / maxCount) * 100;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{star}</span>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-amber-400/60 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, delay: star * 0.05 }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
