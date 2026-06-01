"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  Image as ImageIcon,
  Video,
  Upload,
  Loader2,
  Search,
  Package,
  ChevronRight,
  Trash2,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { MentionTextarea } from "./mention-components"
import { apiClient, ApiClientError } from "@/lib/api-client"
import { uploadFile } from "@/lib/upload"
import { UPLOAD_LIMITS } from "@/lib/upload-limits"
import { formatPrice } from "@/lib/utils"

// ==================== LOCAL TYPES ====================
interface StreamPost {
  id: string
  userId: string
  type: "text" | "image" | "video"
  content: string | null
  mediaUrl?: string | null
  mediaType?: string | null
  productId?: string | null
  isPrivate: boolean
}

interface EditPostResponse {
  success: boolean
  data?: StreamPost
  error?: string
}

interface ProductSearchResponse {
  success: boolean
  data: Array<{
    id: string
    name: string
    price: number
    discountPrice?: number
    image?: string
    slug: string
  }>
}

const MAX_CAPTION_LENGTH = 2000

// ==================== STREAM EDIT SCREEN ====================
interface StreamEditScreenProps {
  post: StreamPost | null
  onClose: () => void
  onSaved: (updatedPost: StreamPost) => void
}

export function StreamEditScreen({ post, onClose, onSaved }: StreamEditScreenProps) {
  const { showToast, setOverlayOpen } = useAppStore()

  // Form state
  const [content, setContent] = useState(post?.content || "")
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(post?.mediaUrl || null)
  const [mediaType, setMediaType] = useState<string | null>(post?.mediaType || null)
  const [isRemovingMedia, setIsRemovingMedia] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(post?.productId || null)
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null)
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null)

  // Product search
  const [productSearchQuery, setProductSearchQuery] = useState("")
  const [productSearchResults, setProductSearchResults] = useState<ProductSearchResponse["data"]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState(false)

  // Upload state
  const [isSaving, setIsSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>("")

  // Signal overlay state to hide bottom nav
  useEffect(() => {
    if (post) {
      setOverlayOpen(true)
    }
    return () => {
      if (post) {
        setOverlayOpen(false)
      }
    }
  }, [post, setOverlayOpen])

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // ==================== MEDIA HANDLING ====================
  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith("image/")) {
        showToast("Pilih file gambar yang valid", "error")
        return
      }

      if (file.size > UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_STREAM_IMAGE_SIZE_MB)) {
        showToast(`Ukuran gambar maksimal ${UPLOAD_LIMITS.MAX_STREAM_IMAGE_SIZE_MB}MB`, "error")
        return
      }

      setMediaFile(file)
      setMediaType(file.type)
      setIsRemovingMedia(false)
      const url = URL.createObjectURL(file)
      setMediaPreview(url)
    },
    [showToast]
  )

  const handleVideoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith("video/")) {
        showToast("Pilih file video yang valid", "error")
        return
      }

      if (file.size > UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_STREAM_VIDEO_SIZE_MB)) {
        showToast(`Ukuran video maksimal ${UPLOAD_LIMITS.MAX_STREAM_VIDEO_SIZE_MB}MB`, "error")
        return
      }

      setMediaFile(file)
      setMediaType(file.type)
      setIsRemovingMedia(false)
      const url = URL.createObjectURL(file)
      setMediaPreview(url)
    },
    [showToast]
  )

  const handleRemoveMedia = useCallback(() => {
    setMediaFile(null)
    if (mediaPreview && mediaPreview !== post?.mediaUrl) {
      URL.revokeObjectURL(mediaPreview)
    }
    setMediaPreview(null)
    setMediaType(null)
    setIsRemovingMedia(true)
  }, [mediaPreview, post?.mediaUrl])

  // ==================== PRODUCT SEARCH ====================
  const handleProductSearch = useCallback(
    async (query: string) => {
      setProductSearchQuery(query)
      if (query.length < 2) {
        setProductSearchResults([])
        return
      }

      setIsSearchingProducts(true)
      try {
        const data = await apiClient.get<ProductSearchResponse>("/api/search", {
          q: query,
          limit: "10",
        })
        if (data.success && data.data) {
          setProductSearchResults(data.data)
        }
      } catch {
        setProductSearchResults([])
      } finally {
        setIsSearchingProducts(false)
      }
    },
    []
  )

  const handleSelectProduct = useCallback(
    (product: { id: string; name: string; image?: string }) => {
      setSelectedProductId(product.id)
      setSelectedProductName(product.name)
      setSelectedProductImage(product.image ?? null)
      setShowProductSearch(false)
      setProductSearchQuery("")
      setProductSearchResults([])
    },
    []
  )

  const handleRemoveProduct = useCallback(() => {
    setSelectedProductId(null)
    setSelectedProductName(null)
    setSelectedProductImage(null)
  }, [])

  // ==================== SAVE ====================
  const handleSave = useCallback(async () => {
    if (!post) return

    // Validation
    if (!content.trim() && !mediaPreview && !isRemovingMedia && post.mediaUrl) {
      // Has media, ok
    } else if (!content.trim() && !mediaPreview && isRemovingMedia) {
      showToast("Konten atau media harus diisi", "warning")
      return
    }
    if (!content.trim() && !mediaPreview && !post.mediaUrl) {
      showToast("Konten atau media harus diisi", "warning")
      return
    }

    if (content.length > MAX_CAPTION_LENGTH) {
      showToast("Konten terlalu panjang", "error")
      return
    }

    setIsSaving(true)
    setUploadProgress("Menyimpan...")

    try {
      const payload: Record<string, unknown> = {
        content: content.trim() || null,
        productId: selectedProductId || null,
      }

      // Handle media changes
      if (isRemovingMedia) {
        // Remove existing media
        payload.mediaUrl = null
        payload.mediaType = null
        payload.thumbnailUrl = null
      } else if (mediaFile) {
        // Upload new media
        setUploadProgress(mediaType?.startsWith("video/") ? "Mengupload video..." : "Mengupload gambar...")
        const bucket = "streams"
        const folder = mediaType?.startsWith("video/") ? "videos" : "images"
        const result = await uploadFile(mediaFile, bucket, folder)
        payload.mediaUrl = result.url
        payload.mediaType = mediaFile.type
      }
      // If no changes to media, don't include in payload

      setUploadProgress("Menyimpan perubahan...")

      const data = await apiClient.put<EditPostResponse>(`/api/stream/${post.id}`, payload)

      if (data.success && data.data) {
        showToast("Postingan berhasil diperbarui!", "success")
        onSaved(data.data)
        onClose()
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, "error")
      } else {
        showToast("Gagal menyimpan perubahan", "error")
      }
    } finally {
      setIsSaving(false)
      setUploadProgress("")
    }
  }, [post, content, mediaFile, mediaPreview, mediaType, isRemovingMedia, selectedProductId, onSaved, onClose, showToast])

  // ==================== CAN SUBMIT ====================
  const canSubmit = !isSaving && (content.trim() || mediaPreview || (post?.mediaUrl && !isRemovingMedia))

  if (!post) return null

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border/50">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-foreground" />
        </motion.button>
        <h2 className="text-base font-bold text-foreground">Edit Postingan</h2>
        <motion.button
          whileTap={canSubmit ? { scale: 0.95 } : {}}
          onClick={handleSave}
          disabled={!canSubmit}
          className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
            canSubmit
              ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {isSaving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Simpan
            </span>
          ) : (
            "Simpan"
          )}
        </motion.button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-5">
        {/* ===== CAPTION TEXT AREA ===== */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => {
                setContent(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + '@')
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
            >
              <span className="text-sm font-bold">@</span>
              Mention
            </button>
          </div>
          <div className="relative">
            <MentionTextarea
              value={content}
              onChange={setContent}
              placeholder="Tulis caption untuk postinganmu..."
              maxLength={MAX_CAPTION_LENGTH}
              rows={5}
              className="w-full resize-none rounded-xl border border-border/50 bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
            />
            <div className="absolute bottom-2 right-3">
              <span
                className={`text-[10px] font-medium ${
                  content.length > MAX_CAPTION_LENGTH * 0.9
                    ? content.length >= MAX_CAPTION_LENGTH
                      ? "text-red-500"
                      : "text-amber-500"
                    : "text-muted-foreground"
                }`}
              >
                {content.length}/{MAX_CAPTION_LENGTH}
              </span>
            </div>
          </div>
        </div>

        {/* ===== MEDIA PREVIEW ===== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Media</span>
            {mediaPreview && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleRemoveMedia}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium"
              >
                <Trash2 className="w-3 h-3" />
                Hapus
              </motion.button>
            )}
          </div>

          {mediaPreview ? (
            <div className="relative rounded-xl overflow-hidden bg-card border border-border/50">
              {mediaType?.startsWith("video/") || post?.type === "video" ? (
                <video
                  src={mediaPreview}
                  className="w-full max-h-64 object-contain bg-black"
                  controls
                  playsInline
                />
              ) : (
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="w-full max-h-64 object-cover"
                />
              )}
            </div>
          ) : isRemovingMedia ? (
            <div className="text-xs text-muted-foreground py-2">
              Media akan dihapus saat disimpan
            </div>
          ) : null}

          {/* Replace media buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border/50 hover:border-emerald-500/50 bg-muted/20 hover:bg-emerald-50/10 transition-colors text-sm text-muted-foreground"
            >
              <ImageIcon className="w-4 h-4" />
              {mediaPreview ? "Ganti Gambar" : "Tambah Gambar"}
            </button>
            <button
              onClick={() => videoInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border/50 hover:border-violet-500/50 bg-muted/20 hover:bg-violet-50/10 transition-colors text-sm text-muted-foreground"
            >
              <Video className="w-4 h-4" />
              {mediaPreview ? "Ganti Video" : "Tambah Video"}
            </button>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoSelect}
          />
        </div>

        {/* ===== LINK PRODUCT ===== */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <button
            onClick={() => setShowProductSearch(!showProductSearch)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Package className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">Link Produk</p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedProductName || "Opsional — tautkan produk"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedProductId && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveProduct()
                  }}
                  className="text-xs text-red-500 hover:text-red-600 font-medium"
                >
                  Hapus
                </motion.button>
              )}
              <ChevronRight
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  showProductSearch ? "rotate-90" : ""
                }`}
              />
            </div>
          </button>

          {/* Selected product chip */}
          <AnimatePresence>
            {selectedProductName && !showProductSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-3"
              >
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                  {selectedProductImage ? (
                    <img
                      src={selectedProductImage}
                      alt={selectedProductName}
                      className="w-7 h-7 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <Package className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 truncate flex-1">
                    {selectedProductName}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Product search dropdown */}
          <AnimatePresence>
            {showProductSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-border/50"
              >
                <div className="p-3 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => handleProductSearch(e.target.value)}
                      placeholder="Cari produk..."
                      className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                    {isSearchingProducts ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                      </div>
                    ) : productSearchResults.length > 0 ? (
                      productSearchResults.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleSelectProduct(product)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-muted/50 transition-colors ${
                            selectedProductId === product.id
                              ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50"
                              : ""
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground line-clamp-1">{product.name}</p>
                            <p className="text-xs font-bold text-emerald-600">
                              {formatPrice(product.discountPrice ?? product.price)}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : productSearchQuery.length >= 2 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Produk tidak ditemukan</p>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">Ketik nama produk untuk mencari</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Upload progress */}
        <AnimatePresence>
          {isSaving && uploadProgress && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-muted-foreground"
            >
              {uploadProgress}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
