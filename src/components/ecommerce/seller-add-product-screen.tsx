"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Plus, Minus, X, Camera, ChevronDown, Tag, Package, DollarSign, Upload, Image as ImageIcon, Video, Store, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { apiClient } from "@/lib/api-client"
import { uploadFile } from "@/lib/upload"
import { formatPrice } from "@/lib/utils"
import { fadeIn } from '@/lib/animations'
import { PageHeader } from "./shared"
import type { Product } from "@/lib/types"
import { logger } from '@/lib/logger'
import { mapSeller } from '@/lib/mappers'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'
import { useState, useRef } from "react"

// ==================== CONSTANTS ====================
const MAX_PRODUCT_IMAGES = UPLOAD_LIMITS.MAX_PRODUCT_IMAGES
const MAX_PRODUCT_IMAGE_SIZE_MB = UPLOAD_LIMITS.MAX_PRODUCT_IMAGE_SIZE_MB
const MAX_VIDEO_SIZE_MB = UPLOAD_LIMITS.MAX_PRODUCT_VIDEO_SIZE_MB

// ==================== VARIANT GROUP TYPE ====================
interface VariantGroup {
  id: string
  name: string
  values: string[]
}

// ==================== SELLER ADD PRODUCT SCREEN ====================
export function SellerAddProductScreen() {
  const { navigate, showToast, addProduct, updateProduct, selectedProductId, products, currentUser, categories, seller: storeSeller } = useAppStore()

  // Derive sellerId and seller info from store's seller object (real data from database)
  const seller = storeSeller
  const sellerId = seller?.id || ''
  const sellerInfo = seller ? {
    id: seller.id,
    userId: seller.userId,
    storeName: seller.storeName,
    storeSlug: seller.storeSlug,
    storeAvatar: seller.storeAvatar || '',
    isVerified: seller.isVerified,
    isPremium: seller.isPremium,
    rating: seller.rating,
    totalSales: seller.totalSales,
    totalProducts: seller.totalProducts,
  } : {
    id: '',
    userId: currentUser?.id || '',
    storeName: 'My Store',
    storeSlug: 'my-store',
    storeAvatar: '',
    isVerified: false,
    isPremium: false,
    rating: 0,
    totalSales: 0,
    totalProducts: 0,
  }

  // Pre-fill form if editing an existing product
  const editingProduct = selectedProductId ? products.find(p => p.id === selectedProductId) : null

  // Form state
  const [productName, setProductName] = useState(editingProduct?.name || "")
  const [category, setCategory] = useState(editingProduct?.categoryId || "")
  const [description, setDescription] = useState(editingProduct?.description || "")
  const [price, setPrice] = useState(editingProduct?.price?.toString() || "")
  const [discountPrice, setDiscountPrice] = useState(editingProduct?.discountPrice?.toString() || "")
  const [stock, setStock] = useState(editingProduct?.stock?.toString() || "")
  const [minOrder, setMinOrder] = useState(editingProduct?.minOrder?.toString() || "1")
  const [weight, setWeight] = useState(editingProduct?.weight?.toString() || "")
  const [condition, setCondition] = useState<"new" | "used">(editingProduct?.condition || "new")
  const [productType, setProductType] = useState<"product" | "jasa">((editingProduct as any)?.productType || "product")
  const [serviceDuration, setServiceDuration] = useState((editingProduct as any)?.serviceDuration || "")
  const [serviceLocation, setServiceLocation] = useState((editingProduct as any)?.serviceLocation || "")
  const [variants, setVariants] = useState<VariantGroup[]>(editingProduct?.variants ? Object.entries(
    editingProduct.variants.reduce((acc, v) => {
      if (!acc[v.name]) acc[v.name] = []
      acc[v.name].push(v.value)
      return acc
    }, {} as Record<string, string[]>)
  ).map(([name, values], idx) => ({
    id: `var_existing_${idx}`,
    name,
    values
  })) : [])
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>(editingProduct?.tags || [])
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [variantInputValues, setVariantInputValues] = useState<Record<string, { name: string; value: string }>>({})
  const [productImages, setProductImages] = useState<{ id: string; url: string; file?: File }[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const productImageInputRef = useRef<HTMLInputElement>(null)
  const [productVideo, setProductVideo] = useState<{ file: File; url: string } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // Derived
  const selectedCategory = categories.find(c => c.id === category)
  const priceNumber = parseInt(price.replace(/\D/g, "")) || 0
  const discountPriceNumber = parseInt(discountPrice.replace(/\D/g, "")) || 0

  // Price formatter
  const handlePriceInput = (value: string, setter: (v: string) => void) => {
    const raw = value.replace(/\D/g, "")
    setter(raw)
  }

  const formatInputPrice = (raw: string) => {
    if (!raw) return ""
    return parseInt(raw).toLocaleString("id-ID")
  }

  // Tags handler
  const handleTagInput = (value: string) => {
    setTagInput(value)
    if (value.includes(",")) {
      const newTags = value
        .split(",")
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0 && !tags.includes(t))
      if (newTags.length > 0) {
        setTags(prev => [...prev, ...newTags])
      }
      setTagInput("")
    }
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim().toLowerCase()
      if (!tags.includes(newTag)) {
        setTags(prev => [...prev, newTag])
      }
      setTagInput("")
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove))
  }

  // Variant handlers
  const addVariantGroup = () => {
    const id = `var_${Date.now()}`
    setVariants(prev => [...prev, { id, name: "", values: [] }])
    setVariantInputValues(prev => ({ ...prev, [id]: { name: "", value: "" } }))
  }

  const removeVariantGroup = (id: string) => {
    setVariants(prev => prev.filter(v => v.id !== id))
    setVariantInputValues(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const updateVariantName = (id: string, name: string) => {
    setVariants(prev => prev.map(v => v.id === id ? { ...v, name } : v))
    setVariantInputValues(prev => ({
      ...prev,
      [id]: { ...prev[id], name }
    }))
  }

  const addVariantValue = (id: string) => {
    const val = variantInputValues[id]?.value?.trim()
    if (!val) return
    setVariants(prev => prev.map(v =>
      v.id === id && !v.values.includes(val)
        ? { ...v, values: [...v.values, val] }
        : v
    ))
    setVariantInputValues(prev => ({
      ...prev,
      [id]: { ...prev[id], value: "" }
    }))
  }

  const removeVariantValue = (groupId: string, value: string) => {
    setVariants(prev => prev.map(v =>
      v.id === groupId
        ? { ...v, values: v.values.filter(val => val !== value) }
        : v
    ))
  }

  const handleVariantValueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, groupId: string) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addVariantValue(groupId)
    }
  }

  // Image upload handlers
  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const remainingSlots = MAX_PRODUCT_IMAGES - productImages.length
    const filesToAdd = files.slice(0, remainingSlots)

    if (files.length > remainingSlots) {
      showToast(`Maksimal ${MAX_PRODUCT_IMAGES} foto per produk`, "error")
    }

    setIsUploading(true)
    const newImages: { id: string; url: string; file?: File }[] = []

    for (const file of filesToAdd) {
      if (file.size > MAX_PRODUCT_IMAGE_SIZE_MB * 1024 * 1024) {
        showToast(`Foto "${file.name}" melebihi ${MAX_PRODUCT_IMAGE_SIZE_MB}MB`, "error")
        continue
      }
      if (!file.type.startsWith("image/")) {
        showToast(`"${file.name}" bukan file gambar`, "error")
        continue
      }

      try {
        const result = await uploadFile(file, 'products', 'images')
        newImages.push({
          id: `pimg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: result.url,
        })
      } catch (error) {
        logger.warn({ component: 'seller-product', err: error }, 'Image upload failed')
        newImages.push({
          id: `pimg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: URL.createObjectURL(file),
          file,
        })
        showToast(`Gagal upload "${file.name}", menggunakan preview sementara`, "error")
      }
    }

    setProductImages(prev => [...prev, ...newImages])
    setIsUploading(false)
    e.target.value = ""
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      showToast(`Video melebihi ${MAX_VIDEO_SIZE_MB}MB`, "error")
      return
    }

    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    if (!allowedVideoTypes.includes(file.type)) {
      showToast('Format video harus MP4, WebM, atau MOV', 'error')
      return
    }

    setIsUploading(true)
    try {
      const result = await uploadFile(file, 'products', 'videos')
      setProductVideo({ file, url: result.url })
      showToast('Video berhasil diupload', 'success')
    } catch (error) {
      logger.warn({ component: 'seller-product', err: error }, 'Video upload failed')
      setProductVideo({ file, url: URL.createObjectURL(file) })
      showToast('Gagal upload video ke server, menggunakan preview sementara', 'error')
    }
    setIsUploading(false)
    e.target.value = ""
  }

  const handleRemoveProductImage = (imageId: string) => {
    setProductImages(prev => {
      const img = prev.find(i => i.id === imageId)
      if (img?.file) URL.revokeObjectURL(img.url)
      return prev.filter(i => i.id !== imageId)
    })
  }

  const [isRegisteringSeller, setIsRegisteringSeller] = useState(false)

  // Auto-register as seller if not already registered — calls API directly
  // instead of going through switchRole() which can fail due to CSRF/auth issues
  const ensureSellerRegistered = async (): Promise<boolean> => {
    if (seller?.id) return true
    if (!currentUser?.id) {
      showToast("Anda harus login terlebih dahulu", "error")
      return false
    }

    setIsRegisteringSeller(true)
    showToast("Mendaftarkan akun seller Anda...", "info")

    try {
      // Pre-check: try to fetch existing seller data first (avoids unnecessary registration attempt)
      try {
        const userDataRaw = await apiClient.get<{ data?: any; seller?: any }>('/api/user-data', { userId: currentUser.id })
        const userData = userDataRaw.data || userDataRaw
        if (userData.seller) {
          const newSeller = mapSeller(userData.seller)
          useAppStore.setState({ seller: newSeller, userRole: 'seller' })
          showToast("Akun seller Anda sudah aktif!", "success")
          return true
        }
      } catch (preCheckErr) {
        logger.warn({ component: 'seller-product', err: preCheckErr }, 'Pre-check for existing seller data failed')
      }

      // No existing seller record — try to register as seller
      const registerRes = await apiClient.rawPost('/api/seller/register', {
        userId: currentUser.id,
        storeName: currentUser.name ? `${currentUser.name}'s Store` : 'My Store',
      })
      const registerData = await registerRes.json()

      if (registerData.success && registerData.data) {
        // New seller registered successfully
        const newSeller = mapSeller(registerData.data)
        useAppStore.setState({ seller: newSeller, userRole: 'seller' })
        showToast("Selamat! Akun seller Anda sudah aktif 🎉", "success")
        return true
      }

      if (registerRes.status === 409) {
        // Already a seller — fetch existing seller data
        try {
          const userDataRaw = await apiClient.get<{ data?: any; seller?: any }>('/api/user-data', { userId: currentUser.id })
          const userData = userDataRaw.data || userDataRaw
          if (userData.seller) {
            const newSeller = mapSeller(userData.seller)
            useAppStore.setState({ seller: newSeller, userRole: 'seller' })
            showToast("Akun seller Anda sudah aktif!", "success")
            return true
          }
        } catch (fetchErr) {
          logger.warn({ component: 'seller-product', err: fetchErr }, 'Failed to fetch existing seller data')
        }
      }

      // Registration failed with a non-409 error — show the actual error from the API
      const errorMsg = registerData.error || "Gagal mendaftar sebagai seller. Silakan coba lagi."
      showToast(errorMsg, "error")
      return false
    } catch (err) {
      logger.warn({ component: 'seller-product', err }, 'Auto seller register failed')
      // Show more specific error messages
      if (err instanceof Error) {
        if (err.message.toLowerCase().includes('csrf') || err.message.toLowerCase().includes('validasi keamanan')) {
          showToast("Validasi keamanan gagal. Refresh halaman dan coba lagi.", "error")
        } else if (err.message.toLowerCase().includes('autentikasi') || err.message.toLowerCase().includes('login') || err.message.toLowerCase().includes('sesi')) {
          showToast("Sesi Anda telah berakhir. Silakan login kembali.", "error")
        } else {
          showToast(err.message, "error")
        }
      } else {
        showToast("Gagal mendaftar sebagai seller. Silakan coba lagi.", "error")
      }
      return false
    } finally {
      setIsRegisteringSeller(false)
    }
  }

  // Submit handler
  const handleSubmit = async () => {
    // Validate form first, then auto-register seller if needed
    // This way user sees form validation errors before the registration attempt
    if (productImages.length === 0 && !editingProduct?.images?.length) {
      showToast("Upload minimal 1 foto produk", "error")
      return
    }
    if (!productName.trim()) {
      showToast("Nama produk harus diisi", "error")
      return
    }
    if (!description.trim()) {
      showToast("Deskripsi produk harus diisi", "error")
      return
    }
    if (!category) {
      showToast("Kategori harus dipilih", "error")
      return
    }
    if (!priceNumber || priceNumber <= 0) {
      showToast("Harga harus diisi", "error")
      return
    }
    if (!stock || parseInt(stock) <= 0) {
      showToast("Stok harus diisi", "error")
      return
    }
    if (!weight || parseInt(weight) <= 0) {
      showToast("Berat produk harus diisi", "error")
      return
    }

    // Auto-register as seller if needed (after form validation)
    if (!seller?.id) {
      const registered = await ensureSellerRegistered()
      if (!registered) return
    }
    // Re-read seller from store (might have been set by ensureSellerRegistered)
    const currentSeller = useAppStore.getState().seller
    const currentSellerId = currentSeller?.id || sellerId
    const selectedCategoryObj = categories.find(c => c.id === category)
    const productImages2 = productImages.length > 0
      ? productImages.map(img => img.url).filter(url => !url.startsWith('blob:'))
      : (editingProduct?.images || [])

    // SECURITY: Block submission if any images are blob: URLs (not properly uploaded)
    if (productImages.length > 0 && productImages2.length === 0) {
      showToast("Gambar gagal diupload ke server. Silakan hapus dan upload ulang.", "error")
      setIsUploading(false)
      return
    }
    if (productImages.length > 0 && productImages2.length < productImages.length) {
      showToast(`${productImages.length - productImages2.length} gambar gagal upload dan dilewati. Gunakan gambar yang berhasil.`, "warning")
    }

    // Build variant data for API
    const apiVariants = variants.flatMap(v =>
      v.values.map(val => ({
        name: v.name,
        value: val,
        stock: Math.floor(parseInt(stock) / (v.values.length || 1)),
      }))
    )

    setIsUploading(true)

    try {
      if (editingProduct) {
        // Update existing product via API
        const res = await apiClient.rawPut('/api/seller/products', {
            productId: editingProduct.id,
            name: productName.trim(),
            slug: productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            description: description.trim(),
            price: priceNumber,
            discountPrice: discountPriceNumber > 0 && discountPriceNumber < priceNumber ? discountPriceNumber : null,
            images: productImages2,
            stock: parseInt(stock),
            minOrder: parseInt(minOrder) || 1,
            weight: parseInt(weight) || 100,
            condition,
            productType,
            ...(productType === 'jasa' ? { serviceDuration: serviceDuration.trim() || null, serviceLocation: serviceLocation.trim() || null } : {}),
            status: 'active',
            categoryId: category,
            tags: tags.length > 0 ? tags : null,
            videoUrl: (productVideo?.url && !productVideo.url.startsWith('blob:')) ? productVideo.url : null,
            variants: apiVariants.length > 0 ? apiVariants : undefined,
          })
        const data = await res.json()
        if (!data.success) {
          showToast(data.error || "Gagal memperbarui produk", "error")
          setIsUploading(false)
          return
        }
        // Also update local store
        const productVariants = apiVariants.map((v, i) => ({
          id: `pv_${Date.now()}_${i}`,
          productId: editingProduct.id,
          name: v.name,
          value: v.value,
          stock: v.stock,
        }))
        updateProduct({
          ...editingProduct,
          name: productName.trim(),
          description: description.trim(),
          price: priceNumber,
          ...(discountPriceNumber > 0 && discountPriceNumber < priceNumber ? { discountPrice: discountPriceNumber } : {}),
          images: productImages2,
          stock: parseInt(stock),
          minOrder: parseInt(minOrder) || 1,
          weight: parseInt(weight) || 100,
          condition,
          productType: productType as any,
          ...(productType === 'jasa' ? { serviceDuration: serviceDuration.trim() || undefined, serviceLocation: serviceLocation.trim() || undefined } : {}),
          status: 'active',
          categoryId: category,
          variants: productVariants,
          ...(tags.length > 0 ? { tags } : {}),
          ...(productVideo ? { videoUrl: productVideo.url.startsWith('blob:') ? undefined : productVideo.url } : {}),
        })
      } else {
        // Create new product via API
        const res = await apiClient.rawPost('/api/seller/products', {
            sellerId: currentSellerId,
            categoryId: category,
            name: productName.trim(),
            slug: productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            description: description.trim(),
            price: priceNumber,
            discountPrice: discountPriceNumber > 0 && discountPriceNumber < priceNumber ? discountPriceNumber : null,
            images: productImages2,
            stock: productType === 'jasa' ? 999 : parseInt(stock),
            minOrder: parseInt(minOrder) || 1,
            weight: productType === 'jasa' ? 0 : parseInt(weight) || 100,
            condition: productType === 'jasa' ? 'new' : condition,
            productType,
            ...(productType === 'jasa' ? { serviceDuration: serviceDuration.trim() || null, serviceLocation: serviceLocation.trim() || null } : {}),
            status: 'active',
            variants: apiVariants,
            tags: tags.length > 0 ? tags : null,
            videoUrl: (productVideo?.url && !productVideo.url.startsWith('blob:')) ? productVideo.url : null,
          })
        const data = await res.json()
        if (!data.success) {
          showToast(data.error || "Gagal membuat produk", "error")
          setIsUploading(false)
          return
        }
        // Add to local store from API response
        const apiProduct = data.data
        const productVariants = (apiProduct.variants || []).map((v: any) => ({
          id: v.id,
          productId: apiProduct.id,
          name: v.name,
          value: v.value,
          stock: v.stock || 0,
        }))
        const newProduct: Product = {
          id: apiProduct.id,
          sellerId: currentSellerId,
          categoryId: category,
          name: productName.trim(),
          slug: apiProduct.slug,
          description: description.trim(),
          price: priceNumber,
          ...(discountPriceNumber > 0 && discountPriceNumber < priceNumber ? { discountPrice: discountPriceNumber } : {}),
          images: productImages2,
          stock: parseInt(stock),
          sold: 0,
          minOrder: parseInt(minOrder) || 1,
          weight: parseInt(weight) || 100,
          condition,
          status: 'active',
          rating: 0,
          reviewCount: 0,
          isFeatured: false,
          isFlashSale: false,
          variants: productVariants,
          seller: sellerInfo,
          category: selectedCategoryObj ? { id: selectedCategoryObj.id, name: selectedCategoryObj.name, slug: selectedCategoryObj.slug } : { id: category, name: category, slug: category },
          ...(tags.length > 0 ? { tags } : {}),
          ...(productVideo ? { videoUrl: productVideo.url.startsWith('blob:') ? undefined : productVideo.url } : {}),
        }
        addProduct(newProduct)
      }
      showToast(editingProduct ? "Produk berhasil diperbarui! 🎉" : "Produk berhasil dipublikasikan! 🎉", "success")
      // Refresh user data to populate seller object if it was just auto-created
      if (!seller?.id && currentUser?.id) {
        try {
          await useAppStore.getState().fetchUserData(currentUser.id)
        } catch {
          // Non-critical — seller data will load on next page refresh
        }
      }
      setTimeout(() => navigate("seller-products"), 1500)
    } catch (error) {
      logger.warn({ component: 'seller-product', err: error }, 'Product save failed')
      showToast("Terjadi kesalahan saat menyimpan produk", "error")
    }
    setIsUploading(false)
  }

  const handleDraft = () => {
    if (!productName.trim()) {
      showToast("Nama produk harus diisi", "error")
      return
    }

    const selectedCategoryObj = categories.find(c => c.id === category)
    const productImages2 = productImages.length > 0
      ? productImages.map(img => img.url)
      : (editingProduct?.images || [])

    const productVariants = variants.flatMap(v =>
      v.values.map(val => ({
        id: `pv_${Date.now()}_${v.name}_${val}`,
        productId: editingProduct?.id || `p_${Date.now()}`,
        name: v.name,
        value: val,
        stock: Math.floor(parseInt(stock || '0') / (v.values.length || 1)),
      }))
    )

    const draftProduct: Product = {
      id: editingProduct?.id || `p_${Date.now()}`,
      sellerId: sellerId,
      categoryId: category || editingProduct?.categoryId || '',
      name: productName.trim(),
      slug: productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      description: description.trim(),
      price: priceNumber || editingProduct?.price || 0,
      ...(discountPriceNumber > 0 && discountPriceNumber < priceNumber ? { discountPrice: discountPriceNumber } : {}),
      images: productImages2,
      stock: parseInt(stock) || editingProduct?.stock || 0,
      sold: editingProduct?.sold || 0,
      minOrder: parseInt(minOrder) || 1,
      weight: parseInt(weight) || 100,
      condition,
      status: 'draft',
      rating: editingProduct?.rating || 0,
      reviewCount: editingProduct?.reviewCount || 0,
      isFeatured: editingProduct?.isFeatured || false,
      isFlashSale: false,
      variants: productVariants,
      seller: sellerInfo,
      category: selectedCategoryObj ? { id: selectedCategoryObj.id, name: selectedCategoryObj.name, slug: selectedCategoryObj.slug } : (editingProduct?.category || { id: category || '', name: category || '', slug: category || '' }),
      ...(tags.length > 0 ? { tags } : {}),
      ...(productVideo ? { videoUrl: productVideo.url.startsWith('blob:') ? undefined : productVideo.url } : {}),
    }

    if (editingProduct) {
      updateProduct(draftProduct)
    } else {
      addProduct(draftProduct)
    }
    showToast("Produk disimpan sebagai draft", "info")
    setTimeout(() => navigate("seller-products"), 1000)
  }

  return (
    <div className="pb-24">
      <PageHeader title={editingProduct ? "Edit Produk" : "Tambah Produk"} />

      <div className="px-4 space-y-4">
        {/* ============ Product Images Section ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Foto Produk</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Wajib</span>
            </div>
            <p className="text-xs text-muted-foreground">Upload hingga {MAX_PRODUCT_IMAGES} foto. Foto utama adalah foto pertama.</p>

            {/* Hidden file input */}
            <input
              ref={productImageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleProductImageUpload}
            />

            <div className="grid grid-cols-5 gap-2">
              {/* Uploaded images */}
              {productImages.map((img, idx) => (
                <motion.div
                  key={img.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group aspect-square"
                >
                  <div
                    className="w-full h-full rounded-xl overflow-hidden border border-border/50 cursor-pointer"
                    onClick={() => setPreviewImage(img.url)}
                  >
                    <img src={img.url} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                  {idx === 0 && (
                    <div className="absolute top-0.5 left-0.5 bg-emerald-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-md">
                      UTAMA
                    </div>
                  )}
                  <button
                    onClick={() => handleRemoveProductImage(img.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}

              {/* Empty slots / Add button */}
              {productImages.length < MAX_PRODUCT_IMAGES && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => productImageInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-emerald-400 transition-colors flex flex-col items-center justify-center gap-1 bg-muted/20 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10"
                >
                  {productImages.length === 0 ? (
                    <>
                      <Camera className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground font-medium">Utama</span>
                    </>
                  ) : (
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  )}
                </motion.button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-lg gap-1.5"
                onClick={() => productImageInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Foto
              </Button>
              <span className="text-[10px] text-muted-foreground">{productImages.length}/{MAX_PRODUCT_IMAGES} · JPG, PNG, max {MAX_PRODUCT_IMAGE_SIZE_MB}MB</span>
            </div>
          </div>
        </motion.div>

        {/* ============ Product Video Section ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-foreground">Video Produk</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium">Opsional</span>
            </div>
            <p className="text-xs text-muted-foreground">Tambahkan video untuk menarik lebih banyak pembeli. Max {MAX_VIDEO_SIZE_MB}MB.</p>

            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={handleVideoUpload}
            />

            {productVideo ? (
              <div className="relative group">
                <div className="rounded-xl overflow-hidden border border-border/50">
                  <video
                    src={productVideo.url}
                    className="w-full h-40 object-cover"
                    controls
                    preload="metadata"
                  />
                </div>
                <button
                  onClick={() => setProductVideo(null)}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => videoInputRef.current?.click()}
                className="w-full py-4 rounded-xl border-2 border-dashed border-purple-300 hover:border-purple-400 transition-colors flex flex-col items-center gap-1.5 bg-purple-50/30 hover:bg-purple-50/50 dark:bg-purple-900/10 dark:hover:bg-purple-900/20"
              >
                <Video className="w-6 h-6 text-purple-400" />
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Upload Video</span>
                <span className="text-[10px] text-muted-foreground">MP4, WebM, MOV · Max {MAX_VIDEO_SIZE_MB}MB</span>
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* ============ Product Name ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
            <label className="text-sm font-semibold text-foreground">Nama Produk <span className="text-red-500">*</span></label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Contoh: iPhone 15 Pro Max 256GB"
              className="rounded-xl h-10 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
            <p className="text-[10px] text-muted-foreground text-right">{productName.length}/70 karakter</p>
          </div>
        </motion.div>

        {/* ============ Category ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
            <label className="text-sm font-semibold text-foreground">Kategori <span className="text-red-500">*</span></label>
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full h-10 rounded-xl border border-input bg-transparent px-3 text-sm text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <span className={selectedCategory ? "text-foreground" : "text-muted-foreground"}>
                  {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : "Pilih Kategori"}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showCategoryDropdown ? "rotate-180" : ""}`} />
              </button>

              {showCategoryDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto"
                >
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setCategory(cat.id)
                        setShowCategoryDropdown(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors ${
                        category === cat.id ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "text-foreground"
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                      {category === cat.id && (
                        <span className="ml-auto text-emerald-500">✓</span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ============ Description ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
            <label className="text-sm font-semibold text-foreground">Deskripsi <span className="text-red-500">*</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan produk kamu secara detail..."
              rows={4}
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">{description.length}/2000 karakter</p>
          </div>
        </motion.div>

        {/* ============ Price Section ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Harga</h3>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Harga Jual <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
                <Input
                  value={formatInputPrice(price)}
                  onChange={(e) => handlePriceInput(e.target.value, setPrice)}
                  placeholder="0"
                  className="pl-10 rounded-xl h-10 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
              {priceNumber > 0 && (
                <p className="text-xs text-emerald-600 font-medium">{formatPrice(priceNumber)}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Harga Diskon</label>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Opsional</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
                <Input
                  value={formatInputPrice(discountPrice)}
                  onChange={(e) => handlePriceInput(e.target.value, setDiscountPrice)}
                  placeholder="0"
                  className="pl-10 rounded-xl h-10 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
              {discountPriceNumber > 0 && priceNumber > 0 && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground line-through">{formatPrice(priceNumber)}</p>
                  <p className="text-xs text-emerald-600 font-bold">{formatPrice(discountPriceNumber)}</p>
                  <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                    -{Math.round(((priceNumber - discountPriceNumber) / priceNumber) * 100)}%
                  </span>
                </div>
              )}
              {discountPriceNumber > 0 && discountPriceNumber >= priceNumber && priceNumber > 0 && (
                <p className="text-xs text-red-500 font-medium">Harga diskon harus lebih rendah dari harga jual</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ============ Stock & Min Order ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Stok & Pengiriman</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Stok <span className="text-red-500">*</span></label>
                <Input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="rounded-xl h-10 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Min. Order</label>
                <Input
                  type="number"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  min="1"
                  className="rounded-xl h-10 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Berat (gram) <span className="text-red-500">*</span></label>
              <Input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0"
                min="1"
                className="rounded-xl h-10 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
              <p className="text-[10px] text-muted-foreground">Berat termasuk packaging</p>
            </div>
          </div>
        </motion.div>

        {/* ============ Product Type (Barang / Jasa) ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
            <label className="text-sm font-semibold text-foreground">Tipe Produk</label>
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setProductType("product")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                  productType === "product"
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                    : "bg-card text-foreground border-border hover:border-emerald-300"
                }`}
              >
                📦 Barang
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setProductType("jasa")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                  productType === "jasa"
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                    : "bg-card text-foreground border-border hover:border-emerald-300"
                }`}
              >
                🛠️ Jasa
              </motion.button>
            </div>
            {productType === "jasa" && (
              <p className="text-[10px] text-muted-foreground">
                Mode Jasa: tanpa pengiriman, tanpa stok fisik. Cocok untuk jasa desain, konsultasi, jasa titip, dll.
              </p>
            )}
          </div>
        </motion.div>

        {/* ============ Condition ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
            <label className="text-sm font-semibold text-foreground">Kondisi</label>
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setCondition("new")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                  condition === "new"
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                    : "bg-card text-foreground border-border hover:border-emerald-300"
                }`}
              >
                ✨ Baru
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setCondition("used")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                  condition === "used"
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                    : "bg-card text-foreground border-border hover:border-emerald-300"
                }`}
              >
                📦 Bekas
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ============ Jasa-specific fields ============ */}
        {productType === "jasa" && (
          <motion.div {...fadeIn}>
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">🛠️</span>
                <h3 className="text-sm font-semibold text-foreground">Detail Jasa</h3>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Durasi Pengerjaan</label>
                <Input
                  value={serviceDuration}
                  onChange={(e) => setServiceDuration(e.target.value)}
                  placeholder="Contoh: 1-3 hari, 1 minggu, 2 jam"
                  className="rounded-xl h-10"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Berapa lama jasa Anda selesai dikerjakan?</p>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Lokasi Jasa</label>
                <Input
                  value={serviceLocation}
                  onChange={(e) => setServiceLocation(e.target.value)}
                  placeholder="Contoh: Online, Jakarta, Seluruh Indonesia"
                  className="rounded-xl h-10"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Apakah jasa bisa dikerjakan online atau offline?</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============ Variants Section ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-foreground">Varian</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Opsional</span>
              </div>
              {variants.length < 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addVariantGroup}
                  className="h-7 text-[11px] rounded-lg gap-1 border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  <Plus className="w-3 h-3" /> Tambah Varian
                </Button>
              )}
            </div>

            {variants.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-xs text-muted-foreground">Belum ada varian. Tambahkan jika produk memiliki variasi.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {variants.map((variant, idx) => (
                  <motion.div
                    key={variant.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 w-5 h-5 rounded flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <Input
                          value={variantInputValues[variant.id]?.name || ""}
                          onChange={(e) => updateVariantName(variant.id, e.target.value)}
                          placeholder="Nama varian (contoh: Warna, Ukuran)"
                          className="rounded-lg h-8 text-xs flex-1 focus:border-emerald-500 focus:ring-emerald-500/20"
                        />
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => removeVariantGroup(variant.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>

                    {/* Variant values as pills */}
                    {variant.values.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {variant.values.map((val) => (
                          <motion.span
                            key={val}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium"
                          >
                            {val}
                            <button
                              onClick={() => removeVariantValue(variant.id, val)}
                              className="hover:text-red-500 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </motion.span>
                        ))}
                      </div>
                    )}

                    {/* Add value input */}
                    <div className="flex gap-2">
                      <Input
                        value={variantInputValues[variant.id]?.value || ""}
                        onChange={(e) =>
                          setVariantInputValues(prev => ({
                            ...prev,
                            [variant.id]: { ...prev[variant.id], value: e.target.value }
                          }))
                        }
                        onKeyDown={(e) => handleVariantValueKeyDown(e, variant.id)}
                        placeholder="Tambah nilai (Enter untuk menambah)"
                        className="rounded-lg h-8 text-xs flex-1 focus:border-emerald-500 focus:ring-emerald-500/20"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addVariantValue(variant.id)}
                        className="h-8 px-2.5 rounded-lg"
                        disabled={!variantInputValues[variant.id]?.value?.trim()}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    {variant.name && variant.values.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {variant.name}: {variant.values.join(", ")}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ============ Tags Section ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Tags</h3>
            </div>
            <p className="text-xs text-muted-foreground">Tambahkan tag untuk membantu pembeli menemukan produkmu. Pisahkan dengan koma.</p>

            {/* Tag pills */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <motion.span
                    key={tag}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium"
                  >
                    #{tag}
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </motion.button>
                  </motion.span>
                ))}
              </div>
            )}

            <Input
              value={tagInput}
              onChange={(e) => handleTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Ketik tag, pisahkan dengan koma..."
              className="rounded-xl h-10 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>
        </motion.div>

        {/* ============ Submit Section ============ */}
        <motion.div {...fadeIn} className="pt-2 pb-4 space-y-3">
          {/* Summary preview */}
          {productName && priceNumber > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-3"
            >
              <p className="text-xs text-muted-foreground mb-1">Pratinjau</p>
              <p className="text-sm font-medium text-foreground line-clamp-1">{productName}</p>
              <p className="text-sm font-bold text-emerald-600 mt-0.5">
                {formatPrice(discountPriceNumber || priceNumber)}
              </p>
              {discountPriceNumber > 0 && priceNumber > discountPriceNumber && (
                <p className="text-xs text-muted-foreground line-through">{formatPrice(priceNumber)}</p>
              )}
            </motion.div>
          )}

          {!seller?.id && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <Store className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-medium text-foreground">Akun seller akan dibuat otomatis saat publikasi produk pertama</p>
              </div>
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isUploading || isRegisteringSeller}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegisteringSeller ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Mendaftar sebagai Seller...
              </>
            ) : isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Mengupload...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Publikasikan Produk
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full h-10 rounded-xl text-sm"
            onClick={handleDraft}
          >
            Simpan sebagai Draft
          </Button>
        </motion.div>
      </div>

      {/* Upload Loading Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/40 flex items-center justify-center"
          >
            <div className="bg-card rounded-2xl p-6 flex flex-col items-center gap-3 shadow-xl">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-8 h-8 border-2 border-muted border-t-emerald-500 rounded-full"
              />
              <p className="text-sm font-medium text-foreground">Mengupload...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

    </div>
  )
}
