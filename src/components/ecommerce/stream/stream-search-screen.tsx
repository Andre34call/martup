"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Search, X, Clock, TrendingUp, Flame, Trash2,
  Heart, MessageCircle, Play, Package, Loader2, Sparkles, Verified,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { apiClient } from "@/lib/api-client"
import { StreamCommentSheet } from "./stream-comment-sheet"
import { formatRelativeTime, formatPrice, truncateText } from "@/lib/utils"
import { fadeIn } from "@/lib/animations"
import { Input } from "@/components/ui/input"
import { MentionText } from "./mention-components"
import { StreamPost } from "./stream-types"

interface StreamSearchResponse {
  success: boolean
  data: StreamPost[]
  pagination: { nextCursor?: string | null; hasMore: boolean; limit: number }
}

const STREAM_TRENDING = [
  { tag: "#FlashSale", emoji: "⚡" },
  { tag: "#Review", emoji: "⭐" },
  { tag: "#Unboxing", emoji: "📦" },
  { tag: "#OOTD", emoji: "👗" },
  { tag: "#TipsHemat", emoji: "💰" },
  { tag: "#Kuliner", emoji: "🍜" },
]

const avatarColors = ["bg-emerald-500", "bg-orange-500", "bg-pink-500", "bg-violet-500", "bg-cyan-500", "bg-amber-500"]
function getAvatarColor(name: string): string {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

// ==================== STREAM SEARCH SCREEN ====================
export function StreamSearchScreen() {
  const { navigate, showToast, streamSearchHistory, addStreamSearchHistory, clearStreamSearchHistory } = useAppStore()

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<StreamPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [activeCommentPost, setActiveCommentPost] = useState<StreamPost | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Debounce input
  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(value.trim())
    }, 300)
  }, [])

  const handleClearQuery = useCallback(() => {
    setQuery("")
    setDebouncedQuery("")
    setResults([])
    setCursor(undefined)
    setHasMore(false)
    inputRef.current?.focus()
  }, [])

  const handleSearch = useCallback((value: string) => {
    const trimmed = value.trim()
    if (trimmed) {
      setDebouncedQuery(trimmed)
      addStreamSearchHistory(trimmed)
    }
  }, [addStreamSearchHistory])

  // Fetch search results
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    const fetchResults = async () => {
      setIsLoading(true)
      try {
        const params: Record<string, string | undefined> = {
          limit: "10",
          search: debouncedQuery,
        }
        const data = await apiClient.get<StreamSearchResponse>("/api/stream", params)
        if (!cancelled && data.success && data.data) {
          setResults(data.data)
          setCursor(data.pagination?.nextCursor ?? undefined)
          setHasMore(data.pagination?.hasMore ?? false)
        }
      } catch {
        if (!cancelled) showToast("Gagal mencari postingan", "error")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchResults()
    return () => { cancelled = true }
  }, [debouncedQuery, showToast])

  // Like toggle
  const handleLike = useCallback(async (postId: string) => {
    setResults(prev => prev.map(p =>
      p.id === postId ? { ...p, isLiked: !p.isLiked, likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1 } : p
    ))
    try {
      const data = await apiClient.post<{ success: boolean; isLiked: boolean; likeCount: number }>(`/api/stream/${postId}/like`)
      if (data.success) {
        setResults(prev => prev.map(p =>
          p.id === postId ? { ...p, isLiked: data.isLiked, likeCount: data.likeCount } : p
        ))
      }
    } catch {
      setResults(prev => prev.map(p =>
        p.id === postId ? { ...p, isLiked: !p.isLiked, likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1 } : p
      ))
    }
  }, [])

  const isSearching = debouncedQuery.length >= 2

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Search Header */}
      <div className="sticky top-0 z-40 glass">
        <div className="h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
        <div className="flex items-center gap-2 h-14 px-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("stream")}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(query) }}
              placeholder="Cari postingan di Stream..."
              className="pl-9 pr-9 h-10 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
            {query && (
              <button onClick={handleClearQuery} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          {query.trim() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => handleSearch(query)}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex-shrink-0"
            >
              Cari
            </motion.button>
          )}
        </div>
      </div>

      <div className="flex-1 pb-20">
        <AnimatePresence mode="wait">
          {isSearching ? (
            <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {/* Loading */}
              {isLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                    <p className="text-sm text-muted-foreground">Mencari postingan...</p>
                  </div>
                </div>
              )}

              {/* Results */}
              {!isLoading && results.length > 0 && (
                <div className="px-4 pt-3 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    {results.length} postingan ditemukan untuk &quot;{debouncedQuery}&quot;
                  </p>
                  {results.map((post, index) => (
                    <StreamSearchResultCard
                      key={post.id}
                      post={post}
                      index={index}
                      onLike={handleLike}
                      onComment={() => setActiveCommentPost(post)}
                      onProductClick={(productId) => {
                        useAppStore.getState().setSelectedProduct(productId)
                        navigate("product-detail")
                      }}
                    />
                  ))}
                </div>
              )}

              {/* No results */}
              {!isLoading && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Tidak ditemukan</p>
                  <p className="text-xs text-muted-foreground max-w-[240px]">
                    Tidak ada postingan untuk &quot;{debouncedQuery}&quot;. Coba kata kunci lain.
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="default" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              {/* Search History */}
              {streamSearchHistory && streamSearchHistory.length > 0 && (
                <div className="px-4 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">Pencarian Terakhir</span>
                    </div>
                    <button
                      onClick={clearStreamSearchHistory}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Hapus
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {streamSearchHistory.map((term: string, idx: number) => (
                      <motion.button
                        key={`${term}-${idx}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setQuery(term); setDebouncedQuery(term) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/70 hover:bg-muted text-sm text-foreground transition-colors"
                      >
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>{term}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending in Stream */}
              <div className="px-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-semibold text-foreground">Trending di Stream</span>
                </div>
                <div className="space-y-1">
                  {STREAM_TRENDING.map((item, idx) => (
                    <motion.button
                      key={item.tag}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => { setQuery(item.tag); setDebouncedQuery(item.tag); addStreamSearchHistory(item.tag) }}
                      className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold ${
                        idx < 3 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-sm">{item.emoji}</span>
                      <span className="flex-1 text-left text-sm font-medium text-foreground">{item.tag}</span>
                      {idx < 3 && <Flame className="w-4 h-4 text-orange-500" />}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Comment sheet */}
      <StreamCommentSheet
        post={activeCommentPost}
        onClose={() => setActiveCommentPost(null)}
        onCommentAdded={(postId) => {
          setResults(prev => prev.map(p =>
            p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p
          ))
        }}
      />
    </div>
  )
}

// ==================== SEARCH RESULT CARD ====================
interface StreamSearchResultCardProps {
  post: StreamPost
  index: number
  onLike: (id: string) => void
  onComment: () => void
  onProductClick: (productId: string) => void
}

function StreamSearchResultCard({ post, index, onLike, onComment, onProductClick }: StreamSearchResultCardProps) {
  const userName = post.user?.name || "User"
  const userAvatar = post.user?.avatar

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 p-[2px]">
            <div className="w-full h-full rounded-full bg-card p-[1.5px]">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-full h-full rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              ) : null}
              <div className={`w-full h-full rounded-full ${getAvatarColor(userName)} text-white font-bold items-center justify-center text-xs`}
                style={{ display: userAvatar ? "none" : "flex" }}>
                {userName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-foreground truncate">{userName}</p>
            {post.likeCount > 50 && <Verified className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" />}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-muted-foreground">{formatRelativeTime(post.createdAt)}</p>
            {post.type === "video" && (
              <span className="text-[9px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-md">VIDEO</span>
            )}
            {post.type === "image" && (
              <span className="text-[9px] font-bold text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30 px-1.5 py-0.5 rounded-md">FOTO</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-2">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed line-clamp-3">
            <MentionText
              content={post.content}
              maxChars={300}
            />
          </p>
        </div>
      )}

      {/* Media thumbnail */}
      {post.mediaUrl && (
        <div className="relative">
          {post.type === "video" ? (
            <div className="relative bg-black/5 dark:bg-black/20">
              <video src={post.mediaUrl ?? undefined} poster={post.thumbnailUrl ?? undefined} className="w-full max-h-80 object-contain bg-black" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                  <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                </div>
              </div>
            </div>
          ) : post.type === "image" ? (
            <div className="px-4 pb-2">
              <img src={post.mediaUrl} alt="Post image" className="w-full max-h-80 object-cover rounded-xl" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
            </div>
          ) : null}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5">
        <motion.button whileTap={{ scale: 0.8 }} onClick={() => onLike(post.id)}
          className="flex items-center gap-1 px-2.5 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
          <Heart className={`w-[18px] h-[18px] ${post.isLiked ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
          {post.likeCount > 0 && <span className={`text-xs font-semibold ${post.isLiked ? "text-red-500" : "text-muted-foreground"}`}>{post.likeCount}</span>}
        </motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onComment}
          className="flex items-center gap-1 px-2.5 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors">
          <MessageCircle className="w-[18px] h-[18px] text-muted-foreground" />
          {post.commentCount > 0 && <span className="text-xs font-semibold text-muted-foreground">{post.commentCount}</span>}
        </motion.button>
      </div>

      {/* Product link */}
      {post.product && (
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => onProductClick(post.product!.id)}
          className="mx-4 mb-3 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {post.product.image ? <img src={post.product.image} alt={post.product.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold text-foreground line-clamp-1">{post.product.name}</p>
            <p className="text-sm font-bold text-emerald-600">{formatPrice(post.product.discountPrice ?? post.product.price)}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 bg-emerald-500 text-white px-3 py-1.5 rounded-lg">
            <span className="text-[11px] font-bold">Beli</span>
          </div>
        </motion.button>
      )}
    </motion.div>
  )
}
