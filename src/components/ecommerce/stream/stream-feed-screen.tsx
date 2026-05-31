"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Heart, MessageCircle, Share2, Play, Pause, Plus, Package,
  Search, Bell, ShoppingCart, RefreshCw, TrendingUp, Flame,
  Bookmark, MoreHorizontal, Verified, Sparkles, Camera
} from "lucide-react"
import { useAppStore, useCartStore } from "@/lib/store"
import { apiClient } from "@/lib/api-client"
import { StreamCommentSheet } from "./stream-comment-sheet"
import { formatRelativeTime, formatPrice, truncateText } from "@/lib/utils"
import { fadeIn } from "@/lib/animations"

// ==================== LOCAL TYPES ====================
interface StreamPost {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  type: "text" | "image" | "video"
  content: string
  mediaUrl?: string
  thumbnailUrl?: string
  productId?: string
  product?: {
    id: string
    name: string
    price: number
    discountPrice?: number
    image?: string
    slug: string
  }
  likeCount: number
  commentCount: number
  isLiked: boolean
  createdAt: string
  viewCount?: number
}

interface StreamFeedResponse {
  success: boolean
  data: StreamPost[]
  nextCursor?: string
  hasMore: boolean
}

interface LikeResponse {
  success: boolean
  isLiked: boolean
  likeCount: number
}

// ==================== AVATAR HELPER ====================
const avatarColors = [
  "bg-emerald-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-amber-500",
]

function getAvatarColor(name: string): string {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

// ==================== TRENDING TOPICS ====================
const trendingTopics = [
  { tag: "#FlashSale", emoji: "⚡", color: "from-orange-500 to-red-500" },
  { tag: "#Review", emoji: "⭐", color: "from-amber-500 to-yellow-500" },
  { tag: "#Unboxing", emoji: "📦", color: "from-violet-500 to-purple-500" },
  { tag: "#OOTD", emoji: "👗", color: "from-pink-500 to-rose-500" },
  { tag: "#TipsHemat", emoji: "💰", color: "from-emerald-500 to-teal-500" },
  { tag: "#Kuliner", emoji: "🍜", color: "from-red-500 to-orange-500" },
]

// ==================== STREAM FEED SCREEN ====================
export function StreamFeedScreen() {
  const { navigate, showToast, isAuthenticated, unreadNotificationCount } = useAppStore()
  const { getTotalItemCount } = useCartStore()
  const cartCount = getTotalItemCount()

  // Feed state
  const [posts, setPosts] = useState<StreamPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = useState(true)

  // Tab state
  const [activeTab, setActiveTab] = useState<"foryou" | "following">("foryou")

  // Comment sheet state
  const [activeCommentPost, setActiveCommentPost] = useState<StreamPost | null>(null)

  // Video playback state
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})

  // Infinite scroll sentinel ref
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ==================== FETCH FEED ====================
  const fetchFeed = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else if (posts.length === 0) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }

      const params: Record<string, string | undefined> = { limit: "10" }
      if (!isRefresh && cursor) {
        params.cursor = cursor
      }

      const data = await apiClient.get<StreamFeedResponse>("/api/stream", params)

      if (data.success && data.data) {
        if (isRefresh) {
          setPosts(data.data)
        } else {
          setPosts((prev) => [...prev, ...data.data])
        }
        setCursor(data.nextCursor)
        setHasMore(data.hasMore)
      }
    } catch (error) {
      showToast("Gagal memuat feed", "error")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
      setIsLoadingMore(false)
    }
  }, [cursor, posts.length, showToast])

  // Initial fetch — only on mount
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true)
      try {
        const data = await apiClient.get<StreamFeedResponse>("/api/stream", { limit: "10" })
        if (data.success && data.data) {
          setPosts(data.data)
          setCursor(data.nextCursor)
          setHasMore(data.hasMore)
        }
      } catch {
        showToast("Gagal memuat feed", "error")
      } finally {
        setIsLoading(false)
      }
    }
    loadInitial()
  }, [])

  // ==================== INFINITE SCROLL ====================
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          fetchFeed()
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, isLoading, fetchFeed])

  // ==================== PULL TO REFRESH ====================
  const handleRefresh = useCallback(async () => {
    setCursor(undefined)
    setHasMore(true)
    await fetchFeed(true)
  }, [fetchFeed])

  // ==================== LIKE TOGGLE ====================
  const handleLike = useCallback(async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1 }
          : p
      )
    )

    try {
      const data = await apiClient.post<LikeResponse>(`/api/stream/${postId}/like`)
      if (data.success) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, isLiked: data.isLiked, likeCount: data.likeCount } : p
          )
        )
      }
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: !p.isLiked, likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1 }
            : p
        )
      )
      showToast("Gagal menyukai postingan", "error")
    }
  }, [showToast])

  // ==================== VIDEO PLAY/PAUSE ====================
  const handleVideoToggle = useCallback((postId: string) => {
    if (playingVideoId === postId) {
      const video = videoRefs.current[postId]
      if (video) video.pause()
      setPlayingVideoId(null)
    } else {
      if (playingVideoId) {
        const prevVideo = videoRefs.current[playingVideoId]
        if (prevVideo) prevVideo.pause()
      }
      const video = videoRefs.current[postId]
      if (video) video.play()
      setPlayingVideoId(postId)
    }
  }, [playingVideoId])

  // ==================== SHARE ====================
  const handleShare = useCallback(async (post: StreamPost) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Postingan dari ${post.userName}`,
          text: truncateText(post.content, 100),
          url: window.location.href,
        })
      } catch { /* User cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href)
        showToast("Link berhasil disalin!", "success")
      } catch {
        showToast("Gagal menyalin link", "error")
      }
    }
  }, [showToast])

  // ==================== NAVIGATE TO CREATE ====================
  const handleCreatePost = useCallback(() => {
    if (!isAuthenticated) {
      showToast("Silakan login terlebih dahulu", "warning")
      navigate("login")
      return
    }
    navigate("stream-create" as any)
  }, [isAuthenticated, navigate, showToast])

  // ==================== LOADING SKELETON ====================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <StreamNavTop onRefresh={handleRefresh} isRefreshing={isRefreshing} navigate={navigate} unreadNotificationCount={unreadNotificationCount} cartCount={cartCount} />
        {/* Story skeleton */}
        <div className="px-4 py-3 flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
              <div className="w-12 h-2.5 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        {/* Feed skeleton */}
        <div className="px-4 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/50 p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-24 rounded bg-muted" />
                  <div className="h-2.5 w-16 rounded bg-muted" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
              <div className="h-48 rounded-xl bg-muted" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ==================== EMPTY STATE ====================
  if (posts.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <StreamNavTop onRefresh={handleRefresh} isRefreshing={isRefreshing} navigate={navigate} unreadNotificationCount={unreadNotificationCount} cartCount={cartCount} />
        <motion.div
          {...fadeIn}
          className="flex flex-col items-center justify-center py-16 px-6 text-center"
        >
          {/* Animated illustration */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="relative mb-6"
          >
            <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <Sparkles className="w-14 h-14 text-white" strokeWidth={1.5} />
            </div>
            {/* Floating dots */}
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-orange-400"
            />
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
              className="absolute -bottom-1 -left-3 w-4 h-4 rounded-full bg-pink-400"
            />
          </motion.div>

          <h3 className="text-lg font-bold text-foreground mb-1.5">
            Mulai Streamingmu!
          </h3>
          <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
            Bagikan review, unboxing, atau momen belanjamu di Stream. Jadilah yang pertama! 🎉
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCreatePost}
            className="mt-5 flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:from-emerald-700 active:to-teal-700 text-white rounded-2xl px-6 py-3 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all"
          >
            <Camera className="w-4 h-4" />
            Buat Postingan Pertama
          </motion.button>
        </motion.div>

        {/* Floating create button */}
        <FloatingCreateButton onClick={handleCreatePost} />
      </div>
    )
  }

  // ==================== MAIN FEED ====================
  return (
    <div className="min-h-screen bg-background pb-20">
      <StreamNavTop onRefresh={handleRefresh} isRefreshing={isRefreshing} navigate={navigate} unreadNotificationCount={unreadNotificationCount} cartCount={cartCount} />

      {/* ===== STORY / QUICK POST CIRCLES ===== */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {/* Your story / create */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleCreatePost}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className="relative w-[62px] h-[62px]">
              <div className="w-full h-full rounded-full bg-muted border-2 border-dashed border-emerald-400 flex items-center justify-center">
                <Plus className="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
              </div>
            </div>
            <span className="text-[10px] font-medium text-emerald-600">Posting</span>
          </motion.button>

          {/* Top posters (derived from feed) */}
          {posts.slice(0, 8).map((post, idx) => (
            <motion.button
              key={post.userId}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="relative w-[62px] h-[62px]">
                {/* Gradient ring */}
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${
                  idx % 3 === 0 ? "from-orange-400 via-pink-500 to-rose-500" :
                  idx % 3 === 1 ? "from-emerald-400 via-teal-500 to-cyan-500" :
                  "from-violet-400 via-purple-500 to-fuchsia-500"
                } p-[2px]`}>
                  <div className="w-full h-full rounded-full bg-background p-[2px]">
                    <div className="w-full h-full rounded-full overflow-hidden">
                      {post.userAvatar ? (
                        <img
                          src={post.userAvatar}
                          alt={post.userName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement
                            img.style.display = "none"
                            const fallback = img.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = "flex"
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full rounded-full ${getAvatarColor(post.userName)} text-white font-bold items-center justify-center text-lg`}
                        style={{ display: post.userAvatar ? "none" : "flex" }}
                      >
                        {post.userName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Live / New indicator */}
                {idx === 0 && (
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[8px] font-bold leading-none">
                    NEW
                  </div>
                )}
              </div>
              <span className="text-[10px] font-medium text-foreground max-w-[62px] truncate">
                {post.userName.split(" ")[0]}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ===== TRENDING TOPICS ===== */}
      <div className="px-4 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 flex-shrink-0">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Trending</span>
          </div>
          {trendingTopics.map((topic) => (
            <motion.button
              key={topic.tag}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                showToast(`Mencari ${topic.tag}...`, "info")
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted/60 border border-border/40 flex-shrink-0 hover:bg-muted transition-colors"
            >
              <span className="text-xs">{topic.emoji}</span>
              <span className="text-[11px] font-semibold text-foreground">{topic.tag}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ===== TAB BAR: For You / Following ===== */}
      <div className="flex border-b border-border/50">
        {(["foryou", "following"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="relative flex-1 py-3 text-sm font-semibold text-center transition-colors"
          >
            <span className={activeTab === tab ? "text-foreground" : "text-muted-foreground"}>
              {tab === "foryou" ? "For You" : "Following"}
            </span>
            {activeTab === tab && (
              <motion.div
                layoutId="stream-tab"
                className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ===== FEED ===== */}
      <div className="px-4 pt-3 space-y-4">
        <AnimatePresence mode="popLayout">
          {posts.map((post, index) => (
            <StreamPostCard
              key={post.id}
              post={post}
              index={index}
              isVideoPlaying={playingVideoId === post.id}
              onLike={handleLike}
              onComment={() => setActiveCommentPost(post)}
              onShare={handleShare}
              onVideoToggle={handleVideoToggle}
              onProductClick={(productId) => {
                useAppStore.getState().setSelectedProduct(productId)
                navigate("product-detail")
              }}
              videoRef={(el) => {
                videoRefs.current[post.id] = el
              }}
            />
          ))}
        </AnimatePresence>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-2" />

        {/* Loading more indicator */}
        <AnimatePresence>
          {isLoadingMore && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-6 gap-2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
              />
              <span className="text-sm text-muted-foreground">Memuat lebih banyak...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* End of feed */}
        {!hasMore && posts.length > 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-2">
              <Sparkles className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Kamu sudah lihat semua postingan</p>
          </div>
        )}
      </div>

      {/* Floating create button */}
      <FloatingCreateButton onClick={handleCreatePost} />

      {/* Comment sheet */}
      <StreamCommentSheet
        post={activeCommentPost}
        onClose={() => setActiveCommentPost(null)}
        onCommentAdded={(postId) => {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p
            )
          )
        }}
      />
    </div>
  )
}

// ==================== STREAM NAV TOP ====================
interface StreamNavTopProps {
  onRefresh: () => void
  isRefreshing: boolean
  navigate: (screen: string) => void
  unreadNotificationCount: number
  cartCount: number
}

function StreamNavTop({ onRefresh, isRefreshing, navigate, unreadNotificationCount, cartCount }: StreamNavTopProps) {
  return (
    <div className="sticky top-0 z-40">
      {/* Gradient top accent */}
      <div className="h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
      <div className="glass">
        <div className="flex items-center gap-2 px-4 h-14">
          {/* Logo / Title with icon */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center">
              <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="white" />
            </div>
            <span className="text-xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">
              Stream
            </span>
          </div>

          {/* Search bar */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("search")}
            className="flex-1 flex items-center gap-2 h-9 px-3 rounded-xl bg-muted/60 border border-border/50 text-muted-foreground text-sm"
          >
            <Search className="w-4 h-4" />
            <span>Cari postingan...</span>
          </motion.button>

          {/* Refresh button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <RefreshCw
              className={`w-[18px] h-[18px] text-foreground ${isRefreshing ? "animate-spin" : ""}`}
            />
          </motion.button>

          {/* Notification bell */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("notification")}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <Bell className="w-[18px] h-[18px] text-foreground" />
            {unreadNotificationCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1"
              >
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </motion.span>
            )}
          </motion.button>

          {/* Cart icon */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("cart")}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <ShoppingCart className="w-[18px] h-[18px] text-foreground" />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold px-1"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </motion.span>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ==================== STREAM POST CARD ====================
interface StreamPostCardProps {
  post: StreamPost
  index: number
  isVideoPlaying: boolean
  onLike: (id: string) => void
  onComment: () => void
  onShare: (post: StreamPost) => void
  onVideoToggle: (id: string) => void
  onProductClick: (productId: string) => void
  videoRef: (el: HTMLVideoElement | null) => void
}

function StreamPostCard({
  post,
  index,
  isVideoPlaying,
  onLike,
  onComment,
  onShare,
  onVideoToggle,
  onProductClick,
  videoRef,
}: StreamPostCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm"
    >
      {/* ===== POST HEADER ===== */}
      <div className="flex items-center gap-3 p-4 pb-2">
        {/* Avatar with gradient ring */}
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 p-[2px]">
            <div className="w-full h-full rounded-full bg-card p-[1.5px]">
              {post.userAvatar ? (
                <img
                  src={post.userAvatar}
                  alt={post.userName}
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement
                    img.style.display = "none"
                    const fallback = img.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = "flex"
                  }}
                />
              ) : null}
              <div
                className={`w-full h-full rounded-full ${getAvatarColor(post.userName)} text-white font-bold items-center justify-center text-sm`}
                style={{ display: post.userAvatar ? "none" : "flex" }}
              >
                {post.userName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
          {/* Online indicator */}
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
        </div>

        {/* Name & time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-foreground truncate">{post.userName}</p>
            {post.likeCount > 50 && (
              <Verified className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-muted-foreground">{formatStreamTime(post.createdAt)}</p>
            {post.type === "video" && (
              <span className="text-[9px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-md">VIDEO</span>
            )}
          </div>
        </div>

        {/* More button */}
        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* ===== POST CONTENT ===== */}
      {post.content && (
        <div className="px-4 pb-2">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {post.content.length > 500 ? (
              <>
                {post.content.slice(0, 500)}
                <span className="text-muted-foreground">... </span>
                <button className="text-emerald-600 font-semibold text-xs hover:text-emerald-700">Baca selengkapnya</button>
              </>
            ) : (
              post.content
            )}
          </p>
        </div>
      )}

      {/* ===== MEDIA ===== */}
      {post.mediaUrl && (
        <div className="relative">
          {post.type === "video" ? (
            <div className="relative bg-black/5 dark:bg-black/20">
              <video
                ref={videoRef}
                src={post.mediaUrl}
                poster={post.thumbnailUrl}
                className="w-full max-h-80 object-contain bg-black"
                playsInline
                loop
                onClick={() => onVideoToggle(post.id)}
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => onVideoToggle(post.id)}
                className="absolute inset-0 flex items-center justify-center"
              >
                <AnimatePresence>
                  {!isVideoPlaying && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center shadow-xl"
                    >
                      <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              {isVideoPlaying && (
                <button
                  onClick={() => onVideoToggle(post.id)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
                >
                  <Pause className="w-4 h-4 text-white" fill="white" />
                </button>
              )}
              {/* View count on video */}
              {post.viewCount !== undefined && post.viewCount > 0 && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm">
                  <Play className="w-3 h-3 text-white" fill="white" />
                  <span className="text-[10px] font-medium text-white">{formatCount(post.viewCount)}</span>
                </div>
              )}
            </div>
          ) : post.type === "image" ? (
            <div className="px-4 pb-2">
              <img
                src={post.mediaUrl}
                alt="Post image"
                className="w-full max-h-96 object-cover rounded-xl"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = "none"
                }}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* ===== ACTION BAR ===== */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-0.5">
          {/* Like */}
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => onLike(post.id)}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <motion.div
              animate={post.isLiked ? { scale: [1, 1.4, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Heart
                className={`w-[20px] h-[20px] ${
                  post.isLiked
                    ? "text-red-500 fill-red-500"
                    : "text-muted-foreground"
                }`}
              />
            </motion.div>
            {post.likeCount > 0 && (
              <span className={`text-xs font-semibold ${post.isLiked ? "text-red-500" : "text-muted-foreground"}`}>
                {formatCount(post.likeCount)}
              </span>
            )}
          </motion.button>

          {/* Comment */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onComment}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors"
          >
            <MessageCircle className="w-[20px] h-[20px] text-muted-foreground" />
            {post.commentCount > 0 && (
              <span className="text-xs font-semibold text-muted-foreground">
                {formatCount(post.commentCount)}
              </span>
            )}
          </motion.button>

          {/* Share */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onShare(post)}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-colors"
          >
            <Share2 className="w-[20px] h-[20px] text-muted-foreground" />
          </motion.button>
        </div>

        {/* Bookmark */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsBookmarked(!isBookmarked)}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
        >
          <Bookmark
            className={`w-[20px] h-[20px] ${
              isBookmarked ? "text-amber-500 fill-amber-500" : "text-muted-foreground"
            }`}
          />
        </motion.button>
      </div>

      {/* ===== PRODUCT LINK CARD ===== */}
      {post.product && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onProductClick(post.product!.id)}
          className="mx-4 mb-3 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/50 dark:border-emerald-800/30 hover:shadow-md transition-all"
        >
          {/* Product image */}
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 border border-border/30">
            {post.product.image ? (
              <img
                src={post.product.image}
                alt={post.product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = "none"
                  const fallback = target.nextElementSibling as HTMLElement
                  if (fallback) fallback.style.display = "flex"
                }}
              />
            ) : null}
            <div
              className="w-full h-full items-center justify-center"
              style={{ display: post.product.image ? "none" : "flex" }}
            >
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold text-foreground line-clamp-1">
              {post.product.name}
            </p>
            <p className="text-sm font-bold text-emerald-600 mt-0.5">
              {formatPrice(post.product.discountPrice ?? post.product.price)}
            </p>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-1 flex-shrink-0 bg-emerald-500 text-white px-3 py-1.5 rounded-lg">
            <span className="text-[11px] font-bold">Beli</span>
          </div>
        </motion.button>
      )}
    </motion.div>
  )
}

// ==================== FLOATING CREATE BUTTON ====================
function FloatingCreateButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 shadow-xl shadow-emerald-500/30 flex items-center justify-center transition-all"
    >
      <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
      {/* Glow ring */}
      <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '3s' }} />
    </motion.button>
  )
}

// ==================== HELPERS ====================
function formatStreamTime(dateStr: string): string {
  return formatRelativeTime(dateStr)
}

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}jt`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}rb`
  return count.toString()
}
