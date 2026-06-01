"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  ShoppingCart, Trash2, ChevronRight, Minus,
  Check, Ticket, ArrowRight, AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAppStore, useCartStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import {
  PageHeader, QuantitySelector, PriceDisplay, EmptyState
} from "./shared"
import type { CartItem, Product } from "@/lib/types"
import { useState, useMemo } from "react"

// ==================== CART ITEM CARD ====================
function CartItemCard({
  item,
  onToggleCheck,
  onUpdateQuantity,
  onRemove,
  onRemoveConfirm,
  onItemClick,
}: {
  item: CartItem
  onToggleCheck: () => void
  onUpdateQuantity: (qty: number) => void
  onRemove: () => void
  onRemoveConfirm: () => void
  onItemClick: () => void
}) {
  const price = item.product.discountPrice || item.product.price

  const colors = [
    "bg-emerald-100 dark:bg-emerald-900/30",
    "bg-orange-100 dark:bg-orange-900/30",
    "bg-pink-100 dark:bg-pink-900/30",
  ]
  const colorIndex = item.product.id.charCodeAt(0) % colors.length

  const handleQuantityChange = (qty: number) => {
    if (qty < 1) {
      onRemoveConfirm()
      return
    }
    onUpdateQuantity(qty)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0, padding: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 py-3"
    >
      {/* Checkbox */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onToggleCheck}
        className="flex-shrink-0 mt-1"
      >
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
          item.isChecked
            ? "bg-emerald-500 border-emerald-500"
            : "border-gray-300 dark:border-gray-600 bg-background"
        }`}>
          {item.isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </div>
      </motion.button>

      {/* Product image */}
      <div
        className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer"
        onClick={onItemClick}
      >
        {item.product.images && item.product.images.length > 0 ? (
          <img
            src={item.product.images[0]}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${colors[colorIndex]}`}>
            <span className="text-lg font-bold text-emerald-600">{item.product.name.charAt(0)}</span>
          </div>
        )}
        {item.product.discountPrice && (
          <div className="absolute top-0.5 left-0.5 bg-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded">
            -{item.product.price > 0 ? Math.round(((item.product.price - item.product.discountPrice) / item.product.price) * 100) : 0}%
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h4
            className="text-sm font-medium line-clamp-2 leading-tight cursor-pointer"
            onClick={onItemClick}
          >
            {item.product.name}
          </h4>
          {item.variant && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.variant.name}: {item.variant.value}
            </p>
          )}
        </div>

        <div className="flex items-end justify-between mt-1.5">
          <div>
            <PriceDisplay
              price={item.product.price}
              discountPrice={item.product.discountPrice}
              size="sm"
            />
          </div>
          <QuantitySelector
            value={item.quantity}
            onChange={handleQuantityChange}
            min={0}
            max={item.variant ? item.variant.stock : item.product.stock}
            size="sm"
          />
        </div>
      </div>
    </motion.div>
  )
}

// ==================== REMOVE ITEM CONFIRMATION ====================
function RemoveItemModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  itemName: string
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold">Hapus Produk?</h3>
              <p className="text-sm text-muted-foreground">
                Hapus <span className="font-semibold text-foreground">{itemName}</span> dari keranjang?
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-xl"
                onClick={onClose}
              >
                Batal
              </Button>
              <Button
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white"
                onClick={onConfirm}
              >
                Hapus
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ==================== MAIN COMPONENT ====================
export function CartScreen() {
  const { navigate, setSelectedProduct, setSelectedSeller, selectedVoucher, showToast, platformSettings } = useAppStore()
  const {
    items, removeItem, updateQuantity, toggleCheck, checkAll,
    getCheckedTotal, getCheckedCount
  } = useCartStore()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)

  // Group items by seller
  const groupedBySeller = useMemo(() => {
    const groups: Record<string, { seller: CartItem['product']['seller']; items: CartItem[] }> = {}
    items.forEach(item => {
      const sellerId = item.product.sellerId
      if (!groups[sellerId]) {
        groups[sellerId] = {
          seller: item.product.seller,
          items: []
        }
      }
      groups[sellerId].items.push(item)
    })
    return Object.values(groups)
  }, [items])

  const checkedTotal = getCheckedTotal()
  const checkedCount = getCheckedCount()
  const allChecked = items.length > 0 && items.every(i => i.isChecked)
  const someChecked = items.some(i => i.isChecked)
  const platformFee = (platformSettings?.platformFee as number) ?? 1000

  // Voucher discount calculation
  const voucherDiscount = useMemo(() => {
    if (!selectedVoucher) return 0
    if (checkedTotal < selectedVoucher.minPurchase) return 0
    if (selectedVoucher.type === 'percentage') {
      const disc = (checkedTotal * selectedVoucher.value) / 100
      return Math.min(disc, selectedVoucher.maxDiscount || disc)
    }
    return selectedVoucher.value
  }, [selectedVoucher, checkedTotal])

  const totalAmount = checkedTotal - voucherDiscount + platformFee

  const handleItemClick = (product: Product) => {
    setSelectedProduct(product.id)
    navigate('product-detail')
  }

  const handleCheckout = () => {
    if (checkedCount > 0) {
      navigate('checkout')
    } else {
      showToast("Pilih produk terlebih dahulu", "error")
    }
  }

  const handleDeleteSelected = () => {
    const checkedItems = items.filter(i => i.isChecked)
    checkedItems.forEach(item => removeItem(item.id))
    setShowDeleteConfirm(false)
    showToast(`${checkedItems.length} produk dihapus dari keranjang`, "success")
  }

  const handleRemoveItemConfirm = () => {
    if (removeTarget) {
      removeItem(removeTarget.id)
      showToast("Produk dihapus dari keranjang", "success")
      setRemoveTarget(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Keranjang" showBack={false} rightAction={
          <span className="text-xs text-muted-foreground">0 item</span>
        } />
        <EmptyState
          icon={<ShoppingCart className="w-10 h-10 text-muted-foreground" />}
          title="Keranjang Kosong"
          subtitle="Yuk mulai belanja dan temukan produk favoritmu!"
          actionLabel="Belanja Sekarang"
          onAction={() => navigate('home')}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-56">
      <PageHeader
        title="Keranjang"
        showBack={false}
        rightAction={
          <span className="text-xs text-muted-foreground">{items.length} item</span>
        }
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4 space-y-3"
      >
        {/* Store grouped items */}
        {groupedBySeller.map((group, groupIdx) => {
          const groupAllChecked = group.items.every(i => i.isChecked)
          const groupSomeChecked = group.items.some(i => i.isChecked)

          return (
            <motion.div
              key={group.seller.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIdx * 0.05 }}
              className="bg-card rounded-xl border border-border/50 overflow-hidden"
            >
              {/* Store header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <div className="flex items-center gap-2.5">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      group.items.forEach(item => {
                        if (item.isChecked !== !groupAllChecked) {
                          toggleCheck(item.id)
                        }
                      })
                    }}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      groupAllChecked
                        ? "bg-emerald-500 border-emerald-500"
                        : groupSomeChecked
                          ? "bg-emerald-500/50 border-emerald-500"
                          : "border-gray-300 dark:border-gray-600 bg-background"
                    }`}>
                      {groupAllChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      {groupSomeChecked && !groupAllChecked && <Minus className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                  </motion.button>
                  <span className="text-sm font-bold text-foreground">{group.seller.storeName}</span>
                  {group.seller.isVerified && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px] px-1.5 py-0.5">
                      <Check className="w-2.5 h-2.5 mr-0.5" />
                      Verified
                    </Badge>
                  )}
                </div>
                <button className="text-xs text-emerald-600 font-medium flex items-center gap-0.5" onClick={() => { setSelectedSeller(group.seller.id); navigate('seller-shop') }}>
                  Kunjungi
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Cart items */}
              <div className="px-4 divide-y divide-border/30">
                <AnimatePresence>
                  {group.items.map((item) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onToggleCheck={() => toggleCheck(item.id)}
                      onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
                      onRemove={() => removeItem(item.id)}
                      onRemoveConfirm={() => setRemoveTarget({ id: item.id, name: item.product.name })}
                      onItemClick={() => handleItemClick(item.product)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )
        })}

        {/* Voucher Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl border border-border/50 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Ticket className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                {selectedVoucher ? (
                  <>
                    <p className="text-sm font-medium text-foreground">{selectedVoucher.name}</p>
                    <p className="text-[10px] text-emerald-600">Hemat {formatPrice(voucherDiscount)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">Pilih Voucher</p>
                    <p className="text-[10px] text-muted-foreground">Gunakan voucher untuk potongan harga</p>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate('voucher')}
              className="text-xs text-emerald-600 font-medium flex items-center gap-0.5"
            >
              {selectedVoucher ? 'Ubah' : 'Pilih'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>

        {/* Price Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border/50 p-4 space-y-2.5"
        >
          <h3 className="text-sm font-bold">Ringkasan Belanja</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal ({checkedCount} produk)</span>
              <span className="text-sm font-medium">{formatPrice(checkedTotal)}</span>
            </div>

            {voucherDiscount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-emerald-600">Diskon Voucher</span>
                <span className="text-sm font-medium text-emerald-600">-{formatPrice(voucherDiscount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Biaya Platform</span>
              <span className="text-sm font-medium">{formatPrice(platformFee)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Total</span>
            <span className="text-base font-bold text-emerald-600">{formatPrice(Math.max(0, totalAmount))}</span>
          </div>
        </motion.div>
      </motion.div>

      {/* FIXED BOTTOM BAR - positioned above BottomNav (h-16 = 64px) */}
      <div className="fixed bottom-16 left-0 right-0 z-40">
        <div className="mx-auto max-w-[430px] md:max-w-[480px]">
          {/* Select all bar */}
          <div className="bg-card border-t border-border/50 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => checkAll(!allChecked)}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  allChecked
                    ? "bg-emerald-500 border-emerald-500"
                    : someChecked
                      ? "bg-emerald-500/50 border-emerald-500"
                      : "border-gray-300 dark:border-gray-600 bg-background"
                }`}>
                  {allChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  {someChecked && !allChecked && <Minus className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
              </motion.button>
              <span className="text-sm font-medium">Pilih Semua</span>
            </div>

            {someChecked && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-red-500 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus ({checkedCount})
              </motion.button>
            )}
          </div>

          {/* CTA bar */}
          <div className="glass border-t border-border/50">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Harga</p>
                <p className="text-lg font-bold text-emerald-600">{formatPrice(Math.max(0, totalAmount))}</p>
              </div>
              <Button
                className="h-11 px-6 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white disabled:opacity-50 gap-1.5"
                disabled={checkedCount === 0}
                onClick={handleCheckout}
              >
                Checkout ({checkedCount})
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete selected confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-base font-bold">Hapus Produk?</h3>
                <p className="text-sm text-muted-foreground">
                  {checkedCount} produk yang dipilih akan dihapus dari keranjang
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-xl"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white"
                  onClick={handleDeleteSelected}
                >
                  Hapus
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove single item confirmation */}
      <RemoveItemModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveItemConfirm}
        itemName={removeTarget?.name || ''}
      />
    </div>
  )
}
