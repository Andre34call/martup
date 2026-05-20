"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  MapPin, ChevronRight, Truck, Ticket, CreditCard, Wallet,
  Package, Check, ShoppingBag, Clock, BadgeCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAppStore, useCartStore } from "@/lib/store"
import { MOCK_SHIPPING_OPTIONS, formatPrice } from "@/lib/mock-data"
import {
  PageHeader, EmptyState
} from "./shared"
import type { CartItem, ShippingOption, Address } from "@/lib/types"
import { useState, useMemo } from "react"

// ==================== PAYMENT METHODS ====================
const PAYMENT_METHODS = [
  { id: "wallet", name: "MartUp Wallet", icon: Wallet, description: "Saldo: Rp 1.190.000" },
  { id: "midtrans", name: "Midtrans", icon: CreditCard, description: "Transfer, Kartu Kredit, E-Wallet" },
  { id: "cod", name: "Bayar di Tempat (COD)", icon: ShoppingBag, description: "Bayar saat barang diterima" },
  { id: "bank", name: "Bank Transfer", icon: Package, description: "BCA, BRI, Mandiri, BNI" },
]

// ==================== ADDRESS CARD ====================
function AddressCard({ address, onChange }: { address: Address | null; onChange: () => void }) {
  if (!address) {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onChange}
        className="w-full p-4 bg-card rounded-xl border border-dashed border-emerald-500 flex items-center justify-center gap-2 text-emerald-600"
      >
        <MapPin className="w-5 h-5" />
        <span className="text-sm font-medium">Tambah Alamat</span>
      </motion.button>
    )
  }

  return (
    <div className="p-4 bg-card rounded-xl border border-border/50">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <MapPin className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">{address.recipient}</span>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px] px-1.5 py-0.5">
                {address.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{address.phone}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {address.address}, {address.city}, {address.province} {address.postalCode}
            </p>
          </div>
        </div>
        <button
          onClick={onChange}
          className="text-xs text-emerald-600 font-medium flex-shrink-0 ml-2"
        >
          Ubah
        </button>
      </div>
    </div>
  )
}

// ==================== SHIPPING SELECTOR ====================
function ShippingSelector({
  selectedShipping,
  onSelect
}: {
  selectedShipping: ShippingOption | null
  onSelect: (option: ShippingOption) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium">
            {selectedShipping ? selectedShipping.name : 'Pilih Pengiriman'}
          </span>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-4 h-4 text-muted-foreground rotate-90" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-1">
              {MOCK_SHIPPING_OPTIONS.map((option) => {
                const isSelected = selectedShipping?.service === option.service && selectedShipping?.provider === option.provider

                return (
                  <motion.button
                    key={`${option.provider}-${option.service}`}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onSelect(option)
                      setIsExpanded(false)
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500"
                        : "bg-card border-border/50 hover:border-emerald-300"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600"
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>

                    <span className="text-lg flex-shrink-0">{option.logo}</span>

                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium">{option.name}</p>
                      <p className="text-[10px] text-muted-foreground">Estimasi {option.estimatedDays}</p>
                    </div>

                    <span className="text-sm font-bold text-foreground flex-shrink-0">
                      {option.price === 0 ? 'Gratis' : formatPrice(option.price)}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedShipping && !isExpanded && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
          <Clock className="w-3 h-3" />
          <span>Estimasi tiba {selectedShipping.estimatedDays}</span>
          <span>·</span>
          <span className="font-medium text-foreground">{formatPrice(selectedShipping.price)}</span>
        </div>
      )}
    </div>
  )
}

// ==================== MAIN COMPONENT ====================
export function CheckoutScreen() {
  const { navigate, addresses, selectedAddressId, selectedVoucher } = useAppStore()
  const { items, getCheckedItems, getCheckedTotal, getCheckedCount, clearCart } = useCartStore()

  const [selectedPayment, setSelectedPayment] = useState("wallet")
  const [shippingBySeller, setShippingBySeller] = useState<Record<string, ShippingOption>>({})
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const checkedItems = getCheckedItems()
  const checkedTotal = getCheckedTotal()
  const checkedCount = getCheckedCount()

  // Find default address
  const defaultAddress = addresses.find(a => a.id === (selectedAddressId || 'a1')) || addresses[0] || null

  // Group items by seller
  const groupedBySeller = useMemo(() => {
    const groups: Record<string, { seller: CartItem['product']['seller']; items: CartItem[] }> = {}
    checkedItems.forEach(item => {
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
  }, [checkedItems])

  // Calculate totals
  const subtotal = checkedTotal
  const shippingCost = Object.values(shippingBySeller).reduce((sum, opt) => sum + opt.price, 0)
  const platformFee = 1000
  const taxAmount = 0

  const voucherDiscount = useMemo(() => {
    if (!selectedVoucher) return 0
    if (subtotal < selectedVoucher.minPurchase) return 0
    if (selectedVoucher.type === 'percentage') {
      const disc = (subtotal * selectedVoucher.value) / 100
      return Math.min(disc, selectedVoucher.maxDiscount || disc)
    }
    return selectedVoucher.value
  }, [selectedVoucher, subtotal])

  const totalAmount = subtotal + shippingCost - voucherDiscount + platformFee + taxAmount

  const handleShippingSelect = (sellerId: string, option: ShippingOption) => {
    setShippingBySeller(prev => ({ ...prev, [sellerId]: option }))
  }

  const handlePay = () => {
    setShowSuccessModal(true)
    setTimeout(() => {
      clearCart()
      setShowSuccessModal(false)
      navigate('orders')
    }, 2500)
  }

  if (checkedItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Checkout" />
        <EmptyState
          icon={<ShoppingBag className="w-10 h-10 text-muted-foreground" />}
          title="Tidak Ada Item"
          subtitle="Tambahkan produk ke keranjang untuk checkout"
          actionLabel="Belanja Sekarang"
          onAction={() => navigate('home')}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <PageHeader title="Checkout" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4 space-y-4"
      >
        {/* 2. Address Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <AddressCard
            address={defaultAddress}
            onChange={() => navigate('address')}
          />
        </motion.div>

        <Separator />

        {/* 3. Items Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          {groupedBySeller.map((group, groupIdx) => (
            <div key={group.seller.id} className="bg-card rounded-xl border border-border/50 overflow-hidden">
              {/* Seller header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">
                  {group.seller.storeName.charAt(0)}
                </div>
                <span className="text-sm font-bold text-foreground">{group.seller.storeName}</span>
                {group.seller.isVerified && (
                  <BadgeCheck className="w-4 h-4 text-emerald-500" />
                )}
              </div>

              {/* Items */}
              <div className="px-4 py-2 divide-y divide-border/20">
                {group.items.map((item) => {
                  const itemPrice = item.product.discountPrice || item.product.price
                  const colors = [
                    "bg-emerald-100 dark:bg-emerald-900/30",
                    "bg-orange-100 dark:bg-orange-900/30",
                    "bg-pink-100 dark:bg-pink-900/30",
                  ]
                  const colorIndex = item.product.id.charCodeAt(0) % colors.length

                  return (
                    <div key={item.id} className="flex gap-3 py-2.5">
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product.images && item.product.images.length > 0 ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${colors[colorIndex]}`}>
                            <span className="text-sm font-bold text-emerald-600">{item.product.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium line-clamp-1">{item.product.name}</h4>
                        {item.variant && (
                          <p className="text-[10px] text-muted-foreground">
                            {item.variant.name}: {item.variant.value}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm font-bold text-emerald-600">{formatPrice(itemPrice)}</span>
                          <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Shipping method per seller */}
              <div className="px-4 py-3 border-t border-border/30">
                <ShippingSelector
                  selectedShipping={shippingBySeller[group.seller.id] || null}
                  onSelect={(option) => handleShippingSelect(group.seller.id, option)}
                />
              </div>
            </div>
          ))}
        </motion.div>

        {/* 5. Voucher Section */}
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
                    <p className="text-sm font-medium text-foreground">Gunakan Voucher</p>
                    <p className="text-[10px] text-muted-foreground">Pilih voucher untuk potongan harga</p>
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

        {/* 6. Payment Method */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border/50 p-4 space-y-3"
        >
          <h3 className="text-sm font-bold">Metode Pembayaran</h3>

          <div className="space-y-2">
            {PAYMENT_METHODS.map((method) => {
              const isSelected = selectedPayment === method.id
              const Icon = method.icon

              return (
                <motion.button
                  key={method.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPayment(method.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500"
                      : "bg-background border-border/50 hover:border-emerald-300"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600"
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>

                  <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-emerald-600' : 'text-muted-foreground'}`} />

                  <div className="flex-1 text-left min-w-0">
                    <p className={`text-sm font-medium ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                      {method.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{method.description}</p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        {/* 7. Price Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-xl border border-border/50 p-4 space-y-2.5"
        >
          <h3 className="text-sm font-bold">Ringkasan Pembayaran</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm font-medium">{formatPrice(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ongkos Kirim</span>
              <span className="text-sm font-medium">
                {shippingCost > 0 ? formatPrice(shippingCost) : 'Pilih pengiriman'}
              </span>
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

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pajak</span>
              <span className="text-sm font-medium">{formatPrice(taxAmount)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Total Pembayaran</span>
            <span className="text-lg font-bold text-emerald-600">{formatPrice(Math.max(0, totalAmount))}</span>
          </div>
        </motion.div>
      </motion.div>

      {/* 8. Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/50 pb-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Total Pembayaran</p>
            <p className="text-lg font-bold text-emerald-600">{formatPrice(Math.max(0, totalAmount))}</p>
          </div>
          <Button
            className="h-11 px-8 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
            disabled={checkedCount === 0 || Object.keys(shippingBySeller).length < groupedBySeller.length}
            onClick={handlePay}
          >
            Bayar
          </Button>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-card rounded-2xl p-8 w-full max-w-sm text-center space-y-4 shadow-xl"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
                className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                >
                  <Check className="w-10 h-10 text-emerald-500" strokeWidth={3} />
                </motion.div>
              </motion.div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">Pembayaran Berhasil!</h3>
                <p className="text-sm text-muted-foreground">
                  Terima kasih atas pesananmu. Pesanan sedang diproses oleh penjual.
                </p>
              </div>

              <div className="bg-muted/30 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">No. Pesanan</span>
                  <span className="font-medium">ORD-2024-{Math.floor(Math.random() * 900 + 100)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-emerald-600">{formatPrice(Math.max(0, totalAmount))}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">Mengalihkan ke halaman pesanan...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
