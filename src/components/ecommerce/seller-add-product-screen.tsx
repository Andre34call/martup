"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Plus, Minus, X, Camera, ChevronDown, Tag, Package, DollarSign, Upload, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { MOCK_CATEGORIES, formatPrice } from "@/lib/mock-data"
import { PageHeader } from "./shared"
import { useState, useRef } from "react"

// ==================== ANIMATION VARIANTS ====================
const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 }
}

const stagger = {
  initial: { opacity: 0, y: 16 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.3 }
  })
}

// ==================== VARIANT GROUP TYPE ====================
interface VariantGroup {
  id: string
  name: string
  values: string[]
}

// ==================== SELLER ADD PRODUCT SCREEN ====================
export function SellerAddProductScreen() {
  const { navigate, showToast } = useAppStore()

  // Form state
  const [productName, setProductName] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [discountPrice, setDiscountPrice] = useState("")
  const [stock, setStock] = useState("")
  const [minOrder, setMinOrder] = useState("1")
  const [weight, setWeight] = useState("")
  const [condition, setCondition] = useState<"new" | "used">("new")
  const [variants, setVariants] = useState<VariantGroup[]>([])
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [variantInputValues, setVariantInputValues] = useState<Record<string, { name: string; value: string }>>({})
  const [productImages, setProductImages] = useState<{ id: string; url: string; file: File }[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const productImageInputRef = useRef<HTMLInputElement>(null)

  // Derived
  const selectedCategory = MOCK_CATEGORIES.find(c => c.id === category)
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
  const MAX_PRODUCT_IMAGES = 5
  const MAX_PRODUCT_IMAGE_SIZE_MB = 2

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const remainingSlots = MAX_PRODUCT_IMAGES - productImages.length
    const filesToAdd = files.slice(0, remainingSlots)

    if (files.length > remainingSlots) {
      showToast(`Maksimal ${MAX_PRODUCT_IMAGES} foto per produk`, "error")
    }

    const newImages: { id: string; url: string; file: File }[] = []
    for (const file of filesToAdd) {
      if (file.size > MAX_PRODUCT_IMAGE_SIZE_MB * 1024 * 1024) {
        showToast(`Foto "${file.name}" melebihi ${MAX_PRODUCT_IMAGE_SIZE_MB}MB`, "error")
        continue
      }
      if (!file.type.startsWith("image/")) {
        showToast(`"${file.name}" bukan file gambar`, "error")
        continue
      }
      newImages.push({
        id: `pimg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(file),
        file,
      })
    }

    setProductImages(prev => [...prev, ...newImages])
    e.target.value = ""
  }

  const handleRemoveProductImage = (imageId: string) => {
    setProductImages(prev => {
      const img = prev.find(i => i.id === imageId)
      if (img) URL.revokeObjectURL(img.url)
      return prev.filter(i => i.id !== imageId)
    })
  }

  // Submit handler
  const handleSubmit = () => {
    if (productImages.length === 0) {
      showToast("Upload minimal 1 foto produk", "error")
      return
    }
    if (!productName.trim()) {
      showToast("Nama produk harus diisi", "error")
      return
    }
    if (!priceNumber || priceNumber <= 0) {
      showToast("Harga harus diisi", "error")
      return
    }
    if (!category) {
      showToast("Kategori harus dipilih", "error")
      return
    }
    if (!stock || parseInt(stock) <= 0) {
      showToast("Stok harus diisi", "error")
      return
    }
    showToast("Produk berhasil dipublikasikan! 🎉", "success")
    setTimeout(() => navigate("seller-products"), 1500)
  }

  const handleDraft = () => {
    showToast("Produk disimpan sebagai draft", "info")
    setTimeout(() => navigate("seller-products"), 1000)
  }

  return (
    <div className="pb-24">
      <PageHeader title="Tambah Produk" />

      <div className="px-4 space-y-4">
        {/* ============ Product Images Section ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Foto Produk</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Wajib</span>
            </div>
            <p className="text-xs text-muted-foreground">Upload hingga 5 foto. Foto utama adalah foto pertama.</p>

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

        {/* ============ Product Name ============ */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
            <label className="text-sm font-semibold text-foreground">Nama Produk</label>
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
            <label className="text-sm font-semibold text-foreground">Kategori</label>
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
                  {MOCK_CATEGORIES.map((cat) => (
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
            <label className="text-sm font-semibold text-foreground">Deskripsi</label>
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
              <label className="text-xs font-medium text-muted-foreground">Harga Jual *</label>
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
                <label className="text-xs font-medium text-muted-foreground">Stok *</label>
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
              <label className="text-xs font-medium text-muted-foreground">Berat (gram) *</label>
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

          <Button
            onClick={handleSubmit}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25"
          >
            <Upload className="w-4 h-4 mr-2" />
            Publikasikan Produk
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
