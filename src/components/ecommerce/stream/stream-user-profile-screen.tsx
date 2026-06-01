"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Heart, MessageCircle, Eye, Play, Pause, Package, Store, Verified, Mail, Calendar, Grid3X3, Share2, Bookmark, MoreHorizontal, Lock, ShoppingBag } from "lucide-react"
import { useAppStore } from "@/lib/store"
import { apiClient } from "@/lib/api-client"
import { formatRelativeTime, formatPrice, truncateText } from "@/lib/utils"
import { MentionText } from "./mention-components"
import { StreamCommentSheet } from "./stream-comment-sheet"
import { PostActionMenu } from "./stream-post-menu"
import { StreamReportDialog } from "./stream-report-dialog"
import { StreamEditScreen } from "./stream-edit-screen"
import { ConfirmDialog } from "../confirm-dialog"
import type { StreamPost, LikeResponse } from "./stream-types"

// ==================== TYPES ====================
interface UserProfile {
  id: string
  name: string
  username?: string
  avatar?: string
  role: string
  isVerified: boolean
  createdAt: string
  email?: string
}

interface UserProduct {
  id: string
  name: string
  slug: string
  price: number
  discountPrice?: number
  image?: string
  sold: number
  rating: number
}

interface SellerInfo {
  storeName: string
  storeSlug: string
  storeAvatar?: string
  isVerified: boolean
  rating: number
  totalProducts: number
  totalSales: number
}

interface ProfileResponse {
  success: boolean
  data: {
    user: UserProfile
    seller: SellerInfo | null
    posts: StreamPost[]
    products: UserProduct[]
    stats: { totalPosts: number; totalLikes: number }
  }
}

// ==================== HELPERS ====================
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

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatMemberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })
}

function formatStreamTime(dateStr: string): string {
  return formatRelativeTime(dateStr)
}

// ==================== RATING STARS ====================
function RatingStars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const starSize = size === "md" ? "w-4 h-4" : "w-3 h-3"
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${starSize} ${star <= Math.round(rating) ? "text-amber-400" : "text-muted-foreground/30"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className={`ml-1 ${size === "md" ? "text-sm" : "text-xs"} font-semibold text-foreground`}>
        {rating.toFixed(1)}
      </span>
    </div>
  )
}

// ==================== SKELETON ====================
function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header skeleton */}
      <div className="sticky top-0 z-40">
        <div className="h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
        <div className="glass">
          <div className="flex items-center gap-2 h-14 px-4">
            <div className="w-9 h-9 rounded-xl bg-muted animate-pulse" />
            <div className="flex-1 flex justify-center">
              <div className="w-24 h-4 rounded bg-muted animate-pulse" />
            </div>
            <div className="w-9 h-9" />
          </div>
        </div>
      </div>

      {/* Profile skeleton */}
      <div className="px-4 pt-8 pb-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-muted animate-pulse" />
          <div className="w-32 h-5 rounded bg-muted animate-pulse" />
          <div className="w-24 h-3 rounded bg-muted animate-pulse" />
          <div className="flex gap-8 mt-2">
            <div className="w-16 h-10 rounded bg-muted animate-pulse" />
            <div className="w-16 h-10 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      {/* Seller card skeleton */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl border border-border/50 p-4 space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-3.5 w-28 rounded bg-muted" />
              <div className="h-2.5 w-20 rounded bg-muted" />
            </div>
          </div>
          <div className="h-9 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Tab skeleton */}
      <div className="flex border-b border-border/50">
        <div className="flex-1 py-3 flex justify-center">
          <div className="w-20 h-3 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex-1 py-3 flex justify-center">
          <div className="w-20 h-3 rounded bg-muted animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="px-4 pt-3 space-y-3">
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
            <div className="h-40 rounded-xl bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================
export function StreamUserProfileScreen() {
  const selectedUserId = useAppStore(s => s.selectedUserId)
  const navigate = useAppStore(s => s.navigate)
  const setSelectedProduct = useAppStore(s => s.setSelectedProduct)
  const setSelectedSeller = useAppStore(s => s.setSelectedSeller)
  const showToast = useAppStore(s => s.showToast)
  const currentUser = useAppStore(s => s.currentUser)
  const currentUserId = currentUser?.id || null

  // Data state
  const [profileData, setProfileData] = useState<ProfileResponse["data"] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"posts" | "products">("posts")

  // Post interaction state
  const [posts, setPosts] = useState<StreamPost[]>([])
  const [activeCommentPost, setActiveCommentPost] = useState<StreamPost | null>(null)
  const [editingPost, setEditingPost] = useState<StreamPost | null>(null)
  const [deletingPost, setDeletingPost] = useState<StreamPost | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [reportingPost, setReportingPost] = useState<StreamPost | null>(null)
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null)

  // Video playback state
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})

  // Navigate back if no selected user
  useEffect(() => {
    if (!selectedUserId) {
      navigate("stream")
    }
  }, [selectedUserId, navigate])

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!selectedUserId) return
    setIsLoading(true)
    try {
      const data = await apiClient.get<ProfileResponse>(`/api/user/${selectedUserId}/profile`)
      if (data.success && data.data) {
        setProfileData(data.data)
        setPosts(data.data.posts)
      }
    } catch {
      showToast("Gagal memuat profil pengguna", "error")
      navigate("stream")
    } finally {
      setIsLoading(false)
    }
  }, [selectedUserId, showToast, navigate])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Derived data
  const user = profileData?.user
  const seller = profileData?.seller
  const products = profileData?.products ?? []
  const stats = profileData?.stats

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
      if (video) video.play().catch(() => {})
      setPlayingVideoId(postId)
    }
  }, [playingVideoId])

  // ==================== SHARE ====================
  const handleShare = useCallback(async (post: StreamPost) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Postingan dari ${post.user?.name || 'User'}`,
          text: truncateText(post.content || '', 100),
          url: `${window.location.origin}/stream/post/${post.id}`,
        })
      } catch { /* User cancelled */ }
    } else {
      try {
        const postUrl = `${window.location.origin}/stream/post/${post.id}`
        await navigator.clipboard.writeText(postUrl)
        showToast("Link berhasil disalin!", "success")
      } catch {
        showToast("Gagal menyalin link", "error")
      }
    }
  }, [showToast])

  // ==================== EDIT POST ====================
  const handleEditPost = useCallback((post: StreamPost) => {
    setEditingPost(post)
  }, [])

  const handleEditSaved = useCallback((updatedPost: StreamPost) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? { ...p, ...updatedPost, isEdited: true } : p))
    )
    setEditingPost(null)
  }, [])

  // ==================== DELETE POST ====================
  const handleDeletePost = useCallback(async () => {
    if (!deletingPost) return
    setIsDeleting(true)
    try {
      await apiClient.del(`/api/stream/${deletingPost.id}`)
      setPosts((prev) => prev.filter((p) => p.id !== deletingPost.id))
      showToast("Postingan berhasil dihapus", "success")
    } catch {
      showToast("Gagal menghapus postingan", "error")
    } finally {
      setIsDeleting(false)
      setDeletingPost(null)
    }
  }, [deletingPost, showToast])

  // ==================== TOGGLE PRIVATE ====================
  const handleTogglePrivate = useCallback(async (post: StreamPost) => {
    const newPrivate = !post.isPrivate
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, isPrivate: newPrivate } : p))
    )
    try {
      await apiClient.put(`/api/stream/${post.id}`, { isPrivate: newPrivate })
      showToast(
        newPrivate ? "Postingan dijadikan privat" : "Postingan dijadikan publik",
        "success"
      )
    } catch {
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, isPrivate: !newPrivate } : p))
      )
      showToast("Gagal mengubah privasi postingan", "error")
    }
  }, [showToast])

  // ==================== COPY LINK ====================
  const handleCopyLink = useCallback(async (post: StreamPost) => {
    try {
      const postUrl = `${window.location.origin}/stream/post/${post.id}`
      await navigator.clipboard.writeText(postUrl)
      showToast("Link berhasil disalin!", "success")
    } catch {
      showToast("Gagal menyalin link", "error")
    }
  }, [showToast])

  // ==================== LOADING STATE ====================
  if (isLoading) {
    return <ProfileSkeleton />
  }

  if (!user) return null

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ===== HEADER ===== */}
      <div className="sticky top-0 z-40">
        <div className="h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
        <div className="glass">
          <div className="flex items-center gap-2 h-14 px-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("stream")}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div className="flex-1 text-center min-w-0">
              <p className="text-sm font-bold text-foreground truncate">
                {user.username ? `@${user.username}` : user.name}
              </p>
            </div>
            <div className="w-9 h-9 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* ===== PROFILE CARD ===== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="px-4 pt-8 pb-4"
      >
        <div className="flex flex-col items-center gap-3">
          {/* Avatar with gradient ring */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 p-[2.5px] shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full rounded-full bg-background p-[2px]">
                <div className="w-full h-full rounded-full overflow-hidden">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
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
                    className={`w-full h-full rounded-full ${getAvatarColor(user.name)} text-white font-bold items-center justify-center text-2xl`}
                    style={{ display: user.avatar ? "none" : "flex" }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
            {/* Verified indicator */}
            {user.isVerified && (
              <div className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full bg-emerald-500 border-[2.5px] border-background flex items-center justify-center">
                <Verified className="w-3 h-3 text-white" fill="white" />
              </div>
            )}
          </div>

          {/* Name & username */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-lg font-bold text-foreground">{user.name}</h1>
              {user.isVerified && (
                <Verified className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0" fill="currentColor" />
              )}
            </div>
            {user.username && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                @{user.username}
              </p>
            )}
          </div>

          {/* Member since & email */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs">Bergabung {formatMemberSince(user.createdAt)}</span>
            </div>
            {user.email && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                <span className="text-xs">{user.email}</span>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-8 mt-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center"
            >
              <span className="text-lg font-bold text-foreground">{formatCount(stats?.totalPosts ?? 0)}</span>
              <span className="text-[11px] text-muted-foreground font-medium">Postingan</span>
            </motion.div>
            <div className="w-px h-8 bg-border/50" />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col items-center"
            >
              <span className="text-lg font-bold text-foreground">{formatCount(stats?.totalLikes ?? 0)}</span>
              <span className="text-[11px] text-muted-foreground font-medium">Suka</span>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ===== SELLER SECTION ===== */}
      <AnimatePresence>
        {seller && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="px-4 mb-4"
          >
            <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-cyan-50/50 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-cyan-950/20">
              <div className="p-4">
                {/* Seller info */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 p-[2px] flex-shrink-0">
                    <div className="w-full h-full rounded-[10px] bg-card p-[1.5px]">
                      <div className="w-full h-full rounded-[8px] overflow-hidden">
                        {seller.storeAvatar ? (
                          <img
                            src={seller.storeAvatar}
                            alt={seller.storeName}
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
                          className="w-full h-full items-center justify-center bg-emerald-100 dark:bg-emerald-900/40"
                          style={{ display: seller.storeAvatar ? "none" : "flex" }}
                        >
                          <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-foreground truncate">{seller.storeName}</span>
                      {seller.isVerified && (
                        <Verified className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" />
                      )}
                    </div>
                    <RatingStars rating={seller.rating} />
                  </div>
                </div>

                {/* Seller stats */}
                <div className="flex items-center gap-4 mb-3 text-center">
                  <div className="flex-1 py-1.5 rounded-xl bg-background/50">
                    <p className="text-sm font-bold text-foreground">{seller.totalProducts}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Produk</p>
                  </div>
                  <div className="flex-1 py-1.5 rounded-xl bg-background/50">
                    <p className="text-sm font-bold text-foreground">{formatCount(seller.totalSales)}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Terjual</p>
                  </div>
                </div>

                {/* Visit store button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedSeller(user.id)
                    navigate("seller-shop")
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:from-emerald-700 active:to-teal-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md shadow-emerald-500/20 transition-all"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Kunjungi Toko
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== TAB BAR ===== */}
      <div className="flex border-b border-border/50">
        {(["posts", "products"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="relative flex-1 py-3 text-sm font-semibold text-center transition-colors"
          >
            <span className={activeTab === tab ? "text-foreground" : "text-muted-foreground"}>
              {tab === "posts" ? "Postingan" : "Produk"}
            </span>
            {activeTab === tab && (
              <motion.div
                layoutId="profile-tab"
                className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div className="px-4 pt-3">
        <AnimatePresence mode="wait">
          {activeTab === "posts" ? (
            <motion.div
              key="posts"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {posts.length === 0 ? (
                <EmptyState
                  icon={<Grid3X3 className="w-8 h-8 text-muted-foreground" />}
                  title="Belum ada postingan"
                  description="Pengguna ini belum membagikan postingan apapun."
                />
              ) : (
                <div className="space-y-3">
                  {posts.map((post, index) => (
                    <ProfilePostCard
                      key={post.id}
                      post={post}
                      index={index}
                      currentUserId={currentUserId}
                      isVideoPlaying={playingVideoId === post.id}
                      isMenuOpen={activeMenuPostId === post.id}
                      onLike={handleLike}
                      onComment={() => setActiveCommentPost(post)}
                      onShare={handleShare}
                      onVideoToggle={handleVideoToggle}
                      onProductClick={(productId) => {
                        useAppStore.getState().setSelectedProduct(productId)
                        navigate("product-detail")
                      }}
                      onToggleMenu={(postId) => {
                        setActiveMenuPostId(prev => prev === postId ? null : postId)
                      }}
                      onEdit={handleEditPost}
                      onDelete={setDeletingPost}
                      onTogglePrivate={handleTogglePrivate}
                      onCopyLink={handleCopyLink}
                      onReport={setReportingPost}
                      videoRef={(el) => {
                        videoRefs.current[post.id] = el
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="products"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {products.length === 0 ? (
                <EmptyState
                  icon={<Package className="w-8 h-8 text-muted-foreground" />}
                  title="Belum ada produk"
                  description="Pengguna ini belum memiliki produk untuk dijual."
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {products.map((product, index) => (
                    <UserProductCard
                      key={product.id}
                      product={product}
                      index={index}
                      onSelect={(id) => {
                        setSelectedProduct(id)
                        navigate("product-detail")
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== COMMENT SHEET ===== */}
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

      {/* ===== EDIT SCREEN ===== */}
      <AnimatePresence>
        {editingPost && (
          <StreamEditScreen
            post={editingPost}
            onClose={() => setEditingPost(null)}
            onSaved={handleEditSaved}
          />
        )}
      </AnimatePresence>

      {/* ===== DELETE CONFIRMATION ===== */}
      <ConfirmDialog
        isOpen={!!deletingPost}
        onClose={() => setDeletingPost(null)}
        onConfirm={handleDeletePost}
        title="Hapus Postingan?"
        message="Postingan ini akan dihapus secara permanen dan tidak bisa dikembalikan."
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
      />

      {/* ===== REPORT DIALOG ===== */}
      <StreamReportDialog
        isOpen={!!reportingPost}
        onClose={() => setReportingPost(null)}
        postId={reportingPost?.id || ""}
        postOwnerName={reportingPost?.user?.name || "User"}
      />
    </div>
  )
}

// ==================== EMPTY STATE ====================
function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">{description}</p>
    </motion.div>
  )
}

// ==================== PROFILE POST CARD (Interactive) ====================
interface ProfilePostCardProps {
  post: StreamPost
  index: number
  currentUserId: string | null
  isVideoPlaying: boolean
  isMenuOpen: boolean
  onLike: (id: string) => void
  onComment: () => void
  onShare: (post: StreamPost) => void
  onVideoToggle: (id: string) => void
  onProductClick: (productId: string) => void
  onToggleMenu: (postId: string) => void
  onEdit: (post: StreamPost) => void
  onDelete: (post: StreamPost) => void
  onTogglePrivate: (post: StreamPost) => void
  onCopyLink: (post: StreamPost) => void
  onReport: (post: StreamPost) => void
  videoRef: (el: HTMLVideoElement | null) => void
}

function ProfilePostCard({
  post,
  index,
  currentUserId,
  isVideoPlaying,
  isMenuOpen,
  onLike,
  onComment,
  onShare,
  onVideoToggle,
  onProductClick,
  onToggleMenu,
  onEdit,
  onDelete,
  onTogglePrivate,
  onCopyLink,
  onReport,
  videoRef,
}: ProfilePostCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isContentExpanded, setIsContentExpanded] = useState(false)

  const userName = post.user?.name || 'User'
  const userAvatar = post.user?.avatar

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm relative"
    >
      {/* ===== POST HEADER ===== */}
      <div className="flex items-center gap-3 p-4 pb-2">
        {/* Avatar — small, matches the profile context */}
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 p-[1.5px]">
            <div className="w-full h-full rounded-full bg-card p-[1px]">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
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
                className={`w-full h-full rounded-full ${getAvatarColor(userName)} text-white font-bold items-center justify-center text-xs`}
                style={{ display: userAvatar ? "none" : "flex" }}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Name & time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-foreground truncate">{userName}</p>
            {post.user?.username && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate">@{post.user.username}</span>
            )}
            {post.isPrivate && (
              <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-muted-foreground">{formatStreamTime(post.createdAt)}</p>
            {post.type === "video" && (
              <span className="text-[9px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-md">VIDEO</span>
            )}
            {post.isEdited && (
              <span className="text-[9px] text-muted-foreground">· Diedit</span>
            )}
          </div>
        </div>

        {/* More button */}
        <button
          onClick={() => onToggleMenu(post.id)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Post action menu */}
        <PostActionMenu
          post={post}
          currentUserId={currentUserId}
          isOpen={isMenuOpen}
          onClose={() => onToggleMenu(post.id)}
          onEdit={onEdit}
          onDelete={onDelete}
          onTogglePrivate={onTogglePrivate}
          onCopyLink={onCopyLink}
          onReport={onReport}
        />
      </div>

      {/* ===== POST CONTENT ===== */}
      {post.content && (
        <div className="px-4 pb-2">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            <MentionText
              content={post.content}
              maxChars={500}
              isExpanded={isContentExpanded}
              onExpand={() => setIsContentExpanded(!isContentExpanded)}
            />
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
                poster={post.thumbnailUrl ?? undefined}
                className="w-full max-h-[500px] object-contain bg-black"
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
                      className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center shadow-xl"
                    >
                      <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
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
            </div>
          ) : post.type === "image" ? (
            <div className="px-4 pb-2">
              <img
                src={post.mediaUrl}
                alt="Post image"
                className="w-full max-h-[500px] object-cover rounded-xl"
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

      {/* ===== VIEW COUNT BAR ===== */}
      {post.viewCount > 0 && (
        <div className="px-4 pt-1.5 pb-0.5">
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">
              {formatCount(post.viewCount)} ditonton
            </span>
          </div>
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
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 border border-border/30">
            {post.product.image ? (
              <img
                src={post.product.image}
                alt={post.product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = "none"
                }}
              />
            ) : (
              <Package className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-md">Produk</span>
            </div>
            <p className="text-xs font-semibold text-foreground line-clamp-1">{post.product.name}</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {formatPrice(post.product.discountPrice ?? post.product.price)}
            </p>
          </div>
          <div className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold">
            Beli
          </div>
        </motion.button>
      )}
    </motion.div>
  )
}

// ==================== USER PRODUCT CARD ====================
interface UserProductCardProps {
  product: UserProduct
  index: number
  onSelect: (id: string) => void
}

function UserProductCard({ product, index, onSelect }: UserProductCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onSelect(product.id)}
      className="rounded-2xl border border-border/50 overflow-hidden shadow-sm bg-card text-left hover:shadow-md transition-shadow"
    >
      {/* Product image */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = "none"
              const fallback = target.nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = "flex"
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 items-center justify-center bg-muted"
          style={{ display: product.image ? "none" : "flex" }}
        >
          <Package className="w-8 h-8 text-muted-foreground/50" />
        </div>

        {/* Discount badge */}
        {product.discountPrice && product.discountPrice < product.price && (
          <span className="absolute top-2 left-2 text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md">
            {Math.round(((product.price - product.discountPrice) / product.price) * 100)}%
          </span>
        )}

        {/* Sold count */}
        <span className="absolute bottom-2 right-2 text-[9px] font-semibold text-white bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
          {formatCount(product.sold)} terjual
        </span>
      </div>

      {/* Product info */}
      <div className="p-2.5">
        <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight mb-1.5">
          {truncateText(product.name, 50)}
        </p>
        <div className="flex flex-col gap-0.5">
          {product.discountPrice && product.discountPrice < product.price ? (
            <>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {formatPrice(product.discountPrice)}
              </p>
              <p className="text-[10px] text-muted-foreground line-through">
                {formatPrice(product.price)}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {formatPrice(product.price)}
            </p>
          )}
        </div>
        {/* Rating */}
        <div className="flex items-center gap-1 mt-1.5">
          <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-[10px] font-medium text-muted-foreground">{product.rating.toFixed(1)}</span>
        </div>
      </div>
    </motion.button>
  )
}
