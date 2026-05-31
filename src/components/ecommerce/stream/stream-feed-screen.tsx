"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Heart, MessageCircle, Share2, Play, Pause, Plus, Package, Search, Bell, ShoppingCart, RefreshCw } from "lucide-react"
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

// ==================== RELATIVE TIME (Indonesian) ====================
function formatStreamTime(dateStr: string): string {
  return formatRelativeTime(dateStr)
}

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
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLiked: !p.isLiked,
              likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1,
            }
          : p
      )
    )

    try {
      const data = await apiClient.post<LikeResponse>(`/api/stream/${postId}/like`)
      // Sync with server state
      if (data.success) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, isLiked: data.isLiked, likeCount: data.likeCount }
              : p
          )
        )
      }
    } catch {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isLiked: !p.isLiked,
                likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1,
              }
            : p
        )
      )
      showToast("Gagal menyukai postingan", "error")
    }
  }, [showToast])

  // ==================== VIDEO PLAY/PAUSE ====================
  const handleVideoToggle = useCallback((postId: string) => {
    if (playingVideoId === postId) {
      // Pause current
      const video = videoRefs.current[postId]
      if (video) video.pause()
      setPlayingVideoId(null)
    } else {
      // Pause previous
      if (playingVideoId) {
        const prevVideo = videoRefs.current[playingVideoId]
        if (prevVideo) prevVideo.pause()
      }
      // Play new
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
      } catch {
        // User cancelled or share failed silently
      }
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
        <div className="px-4 pt-4 space-y-4">
          {[1, 2, 3].map((i) => (
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
              <div className="flex gap-6">
                <div className="h-4 w-12 rounded bg-muted" />
                <div className="h-4 w-12 rounded bg-muted" />
                <div className="h-4 w-12 rounded bg-muted" />
              </div>
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
          className="flex flex-col items-center justify-center py-20 px-6 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <MessageCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Belum Ada Postingan
          </h3>
          <p className="text-sm text-muted-foreground max-w-[250px]">
            Jadilah yang pertama membagikan momen belanjamu!
          </p>
          <button
            onClick={handleCreatePost}
            className="mt-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Buat Postingan
          </button>
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

      <div className="px-4 pt-2 space-y-4">
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
                // Navigate to product detail
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
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">Sudah tidak ada postingan lagi</p>
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
    <div className="sticky top-0 z-40 glass">
      <div className="flex items-center gap-2 px-4 h-14">
        {/* Logo / Title */}
        <span className="text-xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent flex-shrink-0">
          Stream
        </span>

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
          whileTap={{ scale: 0.9, rotate: 180 }}
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className="bg-card rounded-2xl border border-border/50 overflow-hidden"
    >
      {/* ===== POST HEADER ===== */}
      <div className="flex items-center gap-3 p-4 pb-2">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {post.userAvatar ? (
            <img
              src={post.userAvatar}
              alt={post.userName}
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement
                img.style.display = "none"
                const fallback = img.nextElementSibling as HTMLElement
                if (fallback) fallback.style.display = "flex"
              }}
            />
          ) : null}
          <div
            className={`w-10 h-10 rounded-full ${getAvatarColor(post.userName)} text-white font-bold items-center justify-center text-sm`}
            style={{ display: post.userAvatar ? "none" : "flex" }}
          >
            {post.userName.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Name & time */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{post.userName}</p>
          <p className="text-[11px] text-muted-foreground">{formatStreamTime(post.createdAt)}</p>
        </div>
      </div>

      {/* ===== POST CONTENT ===== */}
      {post.content && (
        <div className="px-4 pb-2">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {post.content.length > 500 ? (
              <>
                {post.content.slice(0, 500)}
                <span className="text-muted-foreground">... </span>
                <button className="text-emerald-600 font-medium text-xs">Baca selengkapnya</button>
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
                onEnded={() => {
                  // Keep in playing state for loop
                }}
                onClick={() => onVideoToggle(post.id)}
              />
              {/* Play/Pause overlay */}
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
                      className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                    >
                      <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              {/* Small play indicator when playing */}
              {isVideoPlaying && (
                <button
                  onClick={() => onVideoToggle(post.id)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
                >
                  <Pause className="w-3.5 h-3.5 text-white" fill="white" />
                </button>
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
      <div className="flex items-center gap-1 px-4 py-2">
        {/* Like */}
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => onLike(post.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted/60 transition-colors"
        >
          <motion.div
            animate={post.isLiked ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <Heart
              className={`w-[18px] h-[18px] ${
                post.isLiked
                  ? "text-red-500 fill-red-500"
                  : "text-muted-foreground"
              }`}
            />
          </motion.div>
          {post.likeCount > 0 && (
            <span
              className={`text-xs font-medium ${
                post.isLiked ? "text-red-500" : "text-muted-foreground"
              }`}
            >
              {formatCount(post.likeCount)}
            </span>
          )}
        </motion.button>

        {/* Comment */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onComment}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted/60 transition-colors"
        >
          <MessageCircle className="w-[18px] h-[18px] text-muted-foreground" />
          {post.commentCount > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              {formatCount(post.commentCount)}
            </span>
          )}
        </motion.button>

        {/* Share */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onShare(post)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted/60 transition-colors"
        >
          <Share2 className="w-[18px] h-[18px] text-muted-foreground" />
        </motion.button>
      </div>

      {/* ===== PRODUCT LINK CARD ===== */}
      {post.product && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onProductClick(post.product!.id)}
          className="mx-4 mb-3 flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50 hover:bg-muted/80 transition-colors"
        >
          {/* Product image */}
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
            <p className="text-xs font-medium text-foreground line-clamp-1">
              {post.product.name}
            </p>
            <p className="text-sm font-bold text-emerald-600 mt-0.5">
              {formatPrice(
                post.product.discountPrice ?? post.product.price
              )}
            </p>
          </div>

          {/* Arrow */}
          <span className="text-xs text-emerald-600 font-medium flex-shrink-0">
            Lihat
          </span>
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
      className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-colors"
    >
      <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
    </motion.button>
  )
}

// ==================== HELPERS ====================
function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}jt`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}rb`
  return count.toString()
}
