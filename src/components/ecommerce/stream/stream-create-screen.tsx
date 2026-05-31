"use client"

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Image as ImageIcon,
  Video,
  Type,
  X,
  Upload,
  Loader2,
  Search,
  Package,
  ChevronRight,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { apiClient, ApiClientError } from "@/lib/api-client"
import { uploadFile } from "@/lib/upload"
import { PageHeader } from "../shared"
import { ConfirmDialog } from "../confirm-dialog"
import { formatPrice } from "@/lib/utils"
import { fadeIn } from "@/lib/animations"

// ==================== LOCAL TYPES ====================
type PostType = "text" | "image" | "video"

interface CreatePostResponse {
  success: boolean
  data?: {
    id: string
  }
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

// ==================== STREAM CREATE SCREEN ====================
export function StreamCreateScreen() {
  const { navigate, showToast, isAuthenticated } = useAppStore()

  // Form state
  const [postType, setPostType] = useState<PostType>("text")
  const [content, setContent] = useState("")
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null)

  // Product search
  const [productSearchQuery, setProductSearchQuery] = useState("")
  const [productSearchResults, setProductSearchResults] = useState<
    ProductSearchResponse["data"]
  >([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState(false)

  // Upload state
  const [isPosting, setIsPosting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>("")

  // Confirm dialog state
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // ==================== GO BACK ====================
  const handleGoBack = useCallback(() => {
    // Warn if there's unsaved content
    if (content || mediaFile || selectedProductId) {
      setShowExitConfirm(true)
      return
    }
    navigate("stream" as any)
  }, [content, mediaFile, selectedProductId, navigate])

  const handleConfirmExit = useCallback(() => {
    navigate("stream" as any)
  }, [navigate])

  // ==================== MEDIA HANDLING ====================
  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith("image/")) {
        showToast("Pilih file gambar yang valid", "error")
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        showToast("Ukuran gambar maksimal 10MB", "error")
        return
      }

      setMediaFile(file)
      setPostType("image")
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

      if (file.size > 100 * 1024 * 1024) {
        showToast("Ukuran video maksimal 100MB", "error")
        return
      }

      setMediaFile(file)
      setPostType("video")
      const url = URL.createObjectURL(file)
      setMediaPreview(url)
    },
    [showToast]
  )

  const handleRemoveMedia = useCallback(() => {
    setMediaFile(null)
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview)
    }
    setMediaPreview(null)
    setPostType("text")
  }, [mediaPreview])

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
    (product: { id: string; name: string }) => {
      setSelectedProductId(product.id)
      setSelectedProductName(product.name)
      setShowProductSearch(false)
      setProductSearchQuery("")
      setProductSearchResults([])
    },
    []
  )

  const handleRemoveProduct = useCallback(() => {
    setSelectedProductId(null)
    setSelectedProductName(null)
  }, [])

  // ==================== SUBMIT POST ====================
  const handleSubmit = useCallback(async () => {
    // Validation
    if (!content.trim() && !mediaFile) {
      showToast("Tambahkan konten atau media untuk postingan", "warning")
      return
    }

    if (content.length > MAX_CAPTION_LENGTH) {
      showToast("Konten terlalu panjang", "error")
      return
    }

    if (!isAuthenticated) {
      showToast("Silakan login terlebih dahulu", "warning")
      navigate("login")
      return
    }

    setIsPosting(true)
    setUploadProgress("Mengupload...")

    try {
      let mediaUrl: string | undefined
      let thumbnailUrl: string | undefined

      // Upload media if present
      if (mediaFile) {
        setUploadProgress(
          postType === "video" ? "Mengupload video..." : "Mengupload gambar..."
        )
        const bucket = "streams"
        const folder = postType === "video" ? "videos" : "images"
        const result = await uploadFile(mediaFile, bucket, folder)
        mediaUrl = result.url

        // For video, the thumbnail might be auto-generated
        if (postType === "video" && result.url) {
          thumbnailUrl = result.url.replace(/\.[^.]+$/, "_thumb.jpg")
        }
      }

      setUploadProgress("Memposting...")

      // Create the post
      const payload: Record<string, unknown> = {
        type: postType,
        content: content.trim(),
        productId: selectedProductId || undefined,
      }

      if (mediaUrl) {
        payload.mediaUrl = mediaUrl
      }
      if (thumbnailUrl) {
        payload.thumbnailUrl = thumbnailUrl
      }

      await apiClient.post<CreatePostResponse>("/api/stream", payload)

      showToast("Postingan berhasil dibuat!", "success")
      navigate("stream" as any)
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, "error")
      } else {
        showToast("Gagal membuat postingan", "error")
      }
    } finally {
      setIsPosting(false)
      setUploadProgress("")
    }
  }, [content, mediaFile, postType, selectedProductId, isAuthenticated, navigate, showToast])

  // ==================== CAN SUBMIT ====================
  const canSubmit = (content.trim() || mediaFile) && !isPosting

  // ==================== TYPE TOGGLE CONFIG ====================
  const postTypeOptions: { key: PostType; label: string; icon: React.ReactNode }[] = [
    { key: "text", label: "Teks", icon: <Type className="w-4 h-4" /> },
    { key: "image", label: "Gambar", icon: <ImageIcon className="w-4 h-4" /> },
    { key: "video", label: "Video", icon: <Video className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader title="Buat Postingan" onBack={handleGoBack} />

      <div className="px-4 pt-4 space-y-5">
        {/* ===== POST TYPE TOGGLE ===== */}
        <div className="flex gap-2">
          {postTypeOptions.map((option) => (
            <motion.button
              key={option.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (option.key !== "text" && !mediaFile) {
                  // Trigger file picker
                  if (option.key === "image") {
                    imageInputRef.current?.click()
                  } else {
                    videoInputRef.current?.click()
                  }
                  return
                }
                if (option.key === "text" && mediaFile) {
                  // Don't allow switching to text if media is set
                  return
                }
                setPostType(option.key)
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                postType === option.key
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {option.icon}
              {option.label}
            </motion.button>
          ))}
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

        {/* ===== CAPTION TEXT AREA ===== */}
        <motion.div {...fadeIn}>
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis caption untuk postinganmu..."
              maxLength={MAX_CAPTION_LENGTH}
              rows={5}
              className="w-full resize-none rounded-xl border border-border/50 bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
            />
            {/* Character counter */}
            <div className="absolute bottom-2 right-3 flex items-center gap-1">
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
        </motion.div>

        {/* ===== MEDIA PREVIEW ===== */}
        <AnimatePresence>
          {mediaPreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="relative rounded-xl overflow-hidden bg-card border border-border/50"
            >
              {postType === "video" ? (
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

              {/* Remove media button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleRemoveMedia}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </motion.button>

              {/* Media type label */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
                {postType === "video" ? (
                  <Video className="w-3 h-3 text-white" />
                ) : (
                  <ImageIcon className="w-3 h-3 text-white" />
                )}
                <span className="text-[10px] font-medium text-white capitalize">
                  {postType}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== UPLOAD BUTTON (when no media yet) ===== */}
        {!mediaPreview && postType !== "text" && (
          <motion.div {...fadeIn} className="space-y-3">
            {postType === "image" && (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-dashed border-border/50 hover:border-emerald-500/50 bg-muted/20 hover:bg-emerald-50/10 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Pilih Gambar
                </span>
                <span className="text-[10px] text-muted-foreground">
                  JPG, PNG, WebP (maks. 10MB)
                </span>
              </button>
            )}

            {postType === "video" && (
              <button
                onClick={() => videoInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-dashed border-border/50 hover:border-violet-500/50 bg-muted/20 hover:bg-violet-50/10 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Pilih Video
                </span>
                <span className="text-[10px] text-muted-foreground">
                  MP4, WebM (maks. 100MB)
                </span>
              </button>
            )}
          </motion.div>
        )}

        {/* ===== LINK PRODUCT ===== */}
        <motion.div {...fadeIn}>
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
                  <p className="text-sm font-medium text-foreground">
                    Link Produk
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedProductName || "Opsional - tautkan produk"}
                  </p>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  showProductSearch ? "rotate-90" : ""
                }`}
              />
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
                    <Package className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 truncate flex-1">
                      {selectedProductName}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={handleRemoveProduct}
                      className="flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5 text-emerald-600" />
                    </motion.button>
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
                    {/* Search input */}
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

                    {/* Search results */}
                    <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                      {isSearchingProducts ? (
                        <div className="flex items-center justify-center py-4">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
                          />
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
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground line-clamp-1">
                                {product.name}
                              </p>
                              <p className="text-xs font-bold text-emerald-600">
                                {formatPrice(
                                  product.discountPrice ?? product.price
                                )}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : productSearchQuery.length >= 2 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Produk tidak ditemukan
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Ketik nama produk untuk mencari
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ===== SUBMIT BUTTON ===== */}
        <motion.button
          whileTap={canSubmit ? { scale: 0.98 } : {}}
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-semibold transition-colors ${
            canSubmit
              ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {isPosting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{uploadProgress || "Memposting..."}</span>
            </>
          ) : (
            <span>Posting</span>
          )}
        </motion.button>

        {/* Upload progress detail */}
        <AnimatePresence>
          {isPosting && uploadProgress && (
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

      {/* Exit confirmation dialog */}
      <ConfirmDialog
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={handleConfirmExit}
        title="Buang Postingan?"
        message="Postingan belum dikirim. Perubahan yang belum disimpan akan hilang."
        confirmLabel="Keluar"
        cancelLabel="Tetap Di Sini"
        variant="warning"
      />
    </div>
  )
}
