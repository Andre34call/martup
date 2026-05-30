"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { PageHeader, SectionHeader, EmptyState } from "../shared"
import { useState, useRef, useCallback } from "react"
import { Star, Camera, Send, Lock, Package, ImagePlus, Video, Play, X, Eye, ThumbsUp, ThumbsDown, Meh, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

// --- Media types ---
interface ReviewImage {
  id: string
  url: string
  file: File
}

interface ReviewVideo {
  id: string
  url: string
  file: File
}

const MAX_IMAGES = 5
const MAX_VIDEO_SIZE_MB = 30
const MAX_IMAGE_SIZE_MB = 5

// Rating labels
const ratingLabels: Record<number, { text: string; color: string; icon: React.ReactNode }> = {
  1: { text: "Sangat Buruk", color: "text-red-500", icon: <ThumbsDown className="w-4 h-4" /> },
  2: { text: "Buruk", color: "text-orange-500", icon: <ThumbsDown className="w-4 h-4" /> },
  3: { text: "Biasa", color: "text-amber-500", icon: <Meh className="w-4 h-4" /> },
  4: { text: "Bagus", color: "text-emerald-500", icon: <ThumbsUp className="w-4 h-4" /> },
  5: { text: "Sangat Bagus", color: "text-emerald-600", icon: <ThumbsUp className="w-4 h-4" /> },
}

export function ReviewScreen() {
  const { showToast, goBack, navigate, orders, reviews: storeReviews, reviewedOrderIds, addReview, currentUser, avatarUrl } = useAppStore()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [reviewTexts, setReviewTexts] = useState<Record<string, string>>({})
  const [images, setImages] = useState<Record<string, ReviewImage[]>>({})
  const [videos, setVideos] = useState<Record<string, ReviewVideo | null>>({})
  const [anonymous, setAnonymous] = useState<Record<string, boolean>>({})
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewVideo, setPreviewVideo] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const activeOrderIdRef = useRef<string | null>(null)

  // Get actual delivered orders that haven't been reviewed yet
  const deliveredOrders = orders.filter(o => o.status === 'delivered' && !reviewedOrderIds.includes(o.id))
  // Get delivered orders that have been reviewed
  const reviewedOrders = orders.filter(o => reviewedOrderIds.includes(o.id))

  // --- Image Upload Handlers ---
  const handleImageUpload = useCallback((orderId: string) => {
    activeOrderIdRef.current = orderId
    imageInputRef.current?.click()
  }, [])

  const onImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const orderId = activeOrderIdRef.current
    if (!orderId) return

    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const currentImages = images[orderId] || []
    const remainingSlots = MAX_IMAGES - currentImages.length
    const filesToAdd = files.slice(0, remainingSlots)

    if (files.length > remainingSlots) {
      showToast(`Maksimal ${MAX_IMAGES} foto per ulasan`, "error")
    }

    const newImages: ReviewImage[] = []
    for (const file of filesToAdd) {
      // Validate size
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        showToast(`Foto "${file.name}" melebihi ${MAX_IMAGE_SIZE_MB}MB`, "error")
        continue
      }
      // Validate type
      if (!file.type.startsWith("image/")) {
        showToast(`"${file.name}" bukan file gambar`, "error")
        continue
      }
      newImages.push({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(file),
        file,
      })
    }

    setImages(prev => ({
      ...prev,
      [orderId]: [...(prev[orderId] || []), ...newImages],
    }))

    // Reset input
    e.target.value = ""
  }, [images, showToast])

  const handleRemoveImage = useCallback((orderId: string, imageId: string) => {
    setImages(prev => {
      const updated = (prev[orderId] || []).filter(img => {
        if (img.id === imageId) {
          URL.revokeObjectURL(img.url)
          return false
        }
        return true
      })
      return { ...prev, [orderId]: updated }
    })
  }, [])

  // --- Video Upload Handlers ---
  const handleVideoUpload = useCallback((orderId: string) => {
    activeOrderIdRef.current = orderId
    videoInputRef.current?.click()
  }, [])

  const onVideoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const orderId = activeOrderIdRef.current
    if (!orderId) return

    const file = e.target.files?.[0]
    if (!file) return

    // Validate size
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      showToast(`Video melebihi ${MAX_VIDEO_SIZE_MB}MB`, "error")
      e.target.value = ""
      return
    }

    // Validate type
    if (!file.type.startsWith("video/")) {
      showToast("File harus berupa video", "error")
      e.target.value = ""
      return
    }

    // Remove existing video if any
    const existing = videos[orderId]
    if (existing) {
      URL.revokeObjectURL(existing.url)
    }

    setVideos(prev => ({
      ...prev,
      [orderId]: {
        id: `vid-${Date.now()}`,
        url: URL.createObjectURL(file),
        file,
      },
    }))

    e.target.value = ""
  }, [videos, showToast])

  const handleRemoveVideo = useCallback((orderId: string) => {
    const existing = videos[orderId]
    if (existing) {
      URL.revokeObjectURL(existing.url)
    }
    setVideos(prev => ({ ...prev, [orderId]: null }))
  }, [videos])

  const handleRating = useCallback((orderId: string, star: number) => {
    setRatings(prev => ({ ...prev, [orderId]: star }))
  }, [])

  const handleSubmitReview = useCallback((orderId: string) => {
    const rating = ratings[orderId]
    if (!rating) {
      showToast("Pilih rating terlebih dahulu", "error")
      return
    }

    const order = orders.find(o => o.id === orderId)
    if (!order) return

    // Get the first item's productId and orderItemId for the review
    const orderItem = order.items[0]
    const productId = orderItem?.productId || ''
    const orderItemId = orderItem?.id || ''

    // Cleanup object URLs for images
    const orderImages = images[orderId] || []
    const imageUrls = orderImages.map(img => img.url)
    // Don't revoke URLs yet since they may be used for display in submitted reviews
    const orderVideo = videos[orderId]

    // Create the review object
    const review = {
      id: `rev-${Date.now()}`,
      userId: currentUser?.id || 'u1',
      productId,
      orderItemId,
      rating,
      content: reviewTexts[orderId] || undefined,
      images: imageUrls.length > 0 ? imageUrls : undefined,
      userName: anonymous[orderId] ? 'Pembeli' : (currentUser?.name || 'User'),
      userAvatar: anonymous[orderId] ? undefined : (avatarUrl || undefined),
      createdAt: new Date().toISOString(),
    }

    // Save to store — pass orderItemId for purchase verification
    addReview(review, orderId, orderItemId)

    // Clear local state
    setImages(prev => ({ ...prev, [orderId]: [] }))
    setVideos(prev => ({ ...prev, [orderId]: null }))
    setRatings(prev => ({ ...prev, [orderId]: 0 }))
    setReviewTexts(prev => ({ ...prev, [orderId]: "" }))

    // Show success animation
    setShowSuccess(true)
    setTimeout(() => {
      setShowSuccess(false)
      showToast("Ulasan berhasil dikirim! 🎉", "success")
      // Navigate to orders page after short delay
      setTimeout(() => {
        navigate("orders")
      }, 500)
    }, 1500)
  }, [ratings, images, videos, reviewTexts, anonymous, orders, currentUser, avatarUrl, addReview, showToast, navigate])

  return (
    <div className="pb-24">
      <PageHeader title="Ulasan" />

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onImageChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onVideoChange}
      />

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={e => e.stopPropagation()}
            >
              <img src={previewImage} alt="Preview" className="max-w-[90vw] max-h-[80vh] rounded-xl object-contain" />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Preview Modal */}
      <AnimatePresence>
        {previewVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={e => e.stopPropagation()}
            >
              <video
                src={previewVideo}
                controls
                autoPlay
                className="max-w-[90vw] max-h-[80vh] rounded-xl"
              />
              <button
                onClick={() => setPreviewVideo(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-card rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </motion.div>
              <p className="text-lg font-bold text-foreground">Ulasan Terkirim!</p>
              <p className="text-sm text-muted-foreground text-center">Terima kasih atas ulasanmu 🎉</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 space-y-6">
        {/* ===== Belum Diulas ===== */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Belum Diulas" icon={<Star className="w-4 h-4" />} />
          <div className="space-y-4 mt-3">
            {deliveredOrders.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="w-10 h-10 text-muted-foreground" />}
                title="Semua Pesanan Diulas"
                subtitle="Tidak ada pesanan yang perlu diulas"
              />
            ) : (
              deliveredOrders.map((order, i) => {
                const orderImages = images[order.id] || []
                const orderVideo = videos[order.id]
                const rating = ratings[order.id] || 0
                const ratingInfo = ratingLabels[rating]
                const firstItem = order.items[0]

                return (
                  <motion.div key={order.id} custom={i} variants={stagger} initial="initial" animate="animate">
                    <Card className="p-4 space-y-4">
                      {/* Product Info */}
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                          {firstItem?.image ? (
                            <img src={firstItem.image} alt={firstItem.productName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-2">{firstItem?.productName || 'Produk'}</p>
                          <p className="text-xs text-muted-foreground">{order.seller.storeName}</p>
                          <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(firstItem?.price || 0)}</p>
                        </div>
                      </div>

                      {/* Star Rating */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Bagaimana kualitas produk?</p>
                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <motion.button
                              key={idx}
                              whileTap={{ scale: 0.75 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => handleRating(order.id, idx + 1)}
                              className="p-0.5"
                            >
                              <Star
                                className={`w-8 h-8 transition-all duration-150 ${
                                  rating >= idx + 1
                                    ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                                    : "text-gray-300 dark:text-gray-600 hover:text-amber-200"
                                }`}
                              />
                            </motion.button>
                          ))}
                          {ratingInfo && (
                            <motion.div
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex items-center gap-1 ml-2 ${ratingInfo.color}`}
                            >
                              {ratingInfo.icon}
                              <span className="text-xs font-semibold">{ratingInfo.text}</span>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Review Text */}
                      <div className="space-y-1.5">
                        <textarea
                          value={reviewTexts[order.id] || ""}
                          onChange={(e) => setReviewTexts(prev => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="Ceritakan pengalamanmu menggunakan produk ini..."
                          rows={3}
                          maxLength={500}
                          className="w-full rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none placeholder:text-muted-foreground/60"
                        />
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">Ulasan yang detail membantu pembeli lain</p>
                          <p className="text-[10px] text-muted-foreground">{(reviewTexts[order.id] || "").length}/500</p>
                        </div>
                      </div>

                      {/* Image Upload Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5" />
                            Foto Produk
                          </p>
                          <span className="text-[10px] text-muted-foreground">{orderImages.length}/{MAX_IMAGES}</span>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {/* Image Previews */}
                          {orderImages.map((img) => (
                            <motion.div
                              key={img.id}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="relative group"
                            >
                              <div
                                className="w-20 h-20 rounded-lg overflow-hidden border border-border/50 cursor-pointer"
                                onClick={() => setPreviewImage(img.url)}
                              >
                                <img src={img.url} alt="Upload" className="w-full h-full object-cover" />
                              </div>
                              <button
                                onClick={() => handleRemoveImage(order.id, img.id)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setPreviewImage(img.url)}
                                className="absolute bottom-0.5 right-0.5 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            </motion.div>
                          ))}

                          {/* Add Image Button */}
                          {orderImages.length < MAX_IMAGES && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleImageUpload(order.id)}
                              className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-emerald-400 bg-muted/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 flex flex-col items-center justify-center gap-0.5 transition-colors"
                            >
                              <ImagePlus className="w-5 h-5 text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground font-medium">Tambah</span>
                            </motion.button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Format: JPG, PNG, WebP · Maks {MAX_IMAGE_SIZE_MB}MB/foto</p>
                      </div>

                      {/* Video Upload Section */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5" />
                          Video Ulasan
                        </p>

                        {orderVideo ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative group"
                          >
                            <div
                              className="relative w-full h-36 rounded-lg overflow-hidden border border-border/50 bg-black cursor-pointer"
                              onClick={() => setPreviewVideo(orderVideo.url)}
                            >
                              <video
                                src={orderVideo.url}
                                className="w-full h-full object-cover"
                                muted
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                  <Play className="w-5 h-5 text-foreground ml-0.5" />
                                </div>
                              </div>
                              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-medium">
                                VIDEO
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveVideo(order.id)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleVideoUpload(order.id)}
                            className="w-full h-20 rounded-lg border-2 border-dashed border-border hover:border-emerald-400 bg-muted/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 flex items-center gap-3 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                              <Video className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-medium text-foreground">Upload Video</p>
                              <p className="text-[10px] text-muted-foreground">Maks {MAX_VIDEO_SIZE_MB}MB · MP4, MOV, WebM</p>
                            </div>
                          </motion.button>
                        )}
                      </div>

                      {/* Anonymous Toggle */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">Ulasan Anonim</p>
                            <p className="text-[10px] text-muted-foreground">Nama tidak ditampilkan</p>
                          </div>
                        </div>
                        <Switch
                          checked={anonymous[order.id] || false}
                          onCheckedChange={(v) => setAnonymous(prev => ({ ...prev, [order.id]: v }))}
                        />
                      </div>

                      {/* Submit Button */}
                      <Button
                        disabled={!rating}
                        onClick={() => handleSubmitReview(order.id)}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-10 disabled:opacity-40 text-sm font-semibold"
                      >
                        <Send className="w-4 h-4 mr-1.5" /> Kirim Ulasan
                      </Button>
                    </Card>
                  </motion.div>
                )
              })
            )}
          </div>
        </motion.div>

        {/* ===== Sudah Diulas ===== */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Sudah Diulas" />
          <div className="space-y-3 mt-3">
            {reviewedOrders.length === 0 ? (
              <EmptyState
                icon={<Star className="w-10 h-10 text-muted-foreground" />}
                title="Belum Ada Ulasan"
                subtitle="Ulasan yang sudah dikirim akan muncul di sini"
              />
            ) : (
              reviewedOrders.map((order, i) => {
                // Find the review for this order
                const orderReview = storeReviews.find(r =>
                  r.productId === (order.items[0]?.productId || '') &&
                  reviewedOrderIds.includes(order.id)
                )
                if (!orderReview) return null

                return (
                  <motion.div key={order.id} custom={i} variants={stagger} initial="initial" animate="animate">
                    <Card className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{order.items[0]?.productName || 'Produk'}</p>
                            {orderReview.userName === 'Pembeli' && (
                              <Badge className="text-[8px] h-4 bg-muted text-muted-foreground border-0">Anonim</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 mt-1">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star key={idx} className={`w-3.5 h-3.5 ${idx < orderReview.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                            ))}
                            <span className="text-[10px] font-medium text-foreground ml-1">{orderReview.rating}/5</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {new Date(orderReview.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {orderReview.content && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{orderReview.content}</p>
                      )}

                      {/* Seller Reply */}
                      {orderReview.sellerReply && (
                        <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Penjual</span>
                            {orderReview.sellerReplyAt && (
                              <span className="text-[9px] text-muted-foreground">
                                {new Date(orderReview.sellerReplyAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{orderReview.sellerReply}</p>
                        </div>
                      )}

                      {/* Submitted review images */}
                      {orderReview.images && orderReview.images.length > 0 && (
                        <div className="flex gap-2">
                          {orderReview.images.map((img, idx) => (
                            <div
                              key={idx}
                              className="w-16 h-16 rounded-lg overflow-hidden border border-border/50 cursor-pointer"
                              onClick={() => setPreviewImage(img)}
                            >
                              <img src={img} alt="Review" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                )
              })
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
