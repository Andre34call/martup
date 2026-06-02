"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  MapPin, ChevronRight, Truck, Ticket, CreditCard, Wallet,
  Check, ShoppingBag, Clock, BadgeCheck, ArrowRight,
  ShieldCheck, Info, Banknote, Smartphone, AlertTriangle, Building2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAppStore, useCartStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { DEFAULT_SHIPPING_OPTIONS } from "@/lib/constants"
import {
  PageHeader, EmptyState
} from "./shared"
import type { CartItem, ShippingOption, Address } from "@/lib/types"
import { logger } from '@/lib/logger'
import { useState, useMemo, useEffect, useCallback } from "react"
import { openSnapPayment } from '@/lib/midtrans'
import { apiClient } from '@/lib/api-client'

// ==================== API RESPONSE TYPES ====================
type ShippingResponse = { success: boolean; data?: { rates?: ShippingOption[] }; error?: string }
type VoucherValidateResponse = { success: boolean; data?: { valid: boolean; message?: string; discountAmount: number }; error?: string }
type OrderCreateResponse = { success: boolean; data?: { id: string; orderNumber: string }; error?: string }
type WalletDebitResponse = { success: boolean; error?: string }
type PaymentCreateResponse = { success: boolean; data?: { token: string }; error?: string }

// ==================== CHECKOUT STEP INDICATOR ====================
const CHECKOUT_STEPS = [
  { key: 'address', label: 'Alamat', icon: MapPin },
  { key: 'shipping', label: 'Pengiriman', icon: Truck },
  { key: 'payment', label: 'Pembayaran', icon: CreditCard },
]

function CheckoutStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        {CHECKOUT_STEPS.map((step, idx) => {
          const Icon = step.icon
          const isCompleted = idx < currentStep
          const isCurrent = idx === currentStep

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <motion.div
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                    backgroundColor: isCompleted ? '#10b981' : isCurrent ? '#10b981' : '#e5e7eb'
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCompleted || isCurrent
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </motion.div>
                <span className={`text-[10px] font-medium ${
                  isCurrent ? 'text-emerald-600' : isCompleted ? 'text-emerald-500' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
              {idx < CHECKOUT_STEPS.length - 1 && (
                <div className="flex-1 mx-2 mt-[-12px]">
                  <div className={`h-0.5 rounded-full ${
                    idx < currentStep ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== PAYMENT METHODS ====================
const PAYMENT_METHODS = [
  { id: "wallet", name: "MartUp Pay", icon: Wallet, description: "Bayar cepat dari saldo", color: "emerald" },
  { id: "midtrans", name: "Transfer & E-Wallet", icon: Smartphone, description: "VA, GoPay, OVO, Dana, ShopeePay", color: "blue" },
  { id: "card", name: "Kartu Kredit/Debit", icon: CreditCard, description: "Visa, Mastercard, JCB", color: "purple" },
  { id: "bank_transfer", name: "Transfer Bank (Escrow)", icon: Building2, description: "Transfer ke rekening MartUp (Escrow)", color: "teal" },
  { id: "cod", name: "Bayar di Tempat (COD)", icon: Banknote, description: "Bayar saat barang diterima", color: "orange" },
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
        <span className="text-sm font-medium">Tambah Alamat Pengiriman</span>
      </motion.button>
    )
  }

  return (
    <div className="p-4 bg-card rounded-xl border border-border/50">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">{address.recipient}</span>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px] px-1.5 py-0.5">
                {address.label}
              </Badge>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{address.phone}</p>
              {address.phone && !address.phone.startsWith('0') && !address.phone.startsWith('+') && (
                <div className="flex items-center gap-1 text-amber-500">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span className="text-[10px]">Nomor telepon harus diawali dengan "0" atau "+"</span>
                </div>
              )}
            </div>
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
  onSelect,
  options,
  isLoading
}: {
  selectedShipping: ShippingOption | null
  onSelect: (option: ShippingOption) => void
  options: ShippingOption[]
  isLoading?: boolean
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
            {isLoading ? 'Menghitung ongkir...' : selectedShipping ? selectedShipping.name : 'Pilih Pengiriman'}
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
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 p-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
                  />
                  <span className="text-xs text-muted-foreground">Menghitung ongkos kirim...</span>
                </div>
              ) : options.length === 0 ? (
                <div className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Tidak ada layanan pengiriman tersedia</p>
                </div>
              ) : (
                options.map((option) => {
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
                })
              )}
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
  const { navigate, addresses, selectedAddressId, selectedVoucher, addOrder, showToast, walletBalance, deductWallet, useVoucher: markVoucherUsed, currentUser, selectVoucher, platformSettings } = useAppStore()
  const { items, getCheckedItems, getCheckedTotal, getCheckedCount, clearCart, removeItem } = useCartStore()

  const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
  const [shippingBySeller, setShippingBySeller] = useState<Record<string, ShippingOption>>({})
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [shippingRatesBySeller, setShippingRatesBySeller] = useState<Record<string, ShippingOption[]>>({})
  const [isLoadingRates, setIsLoadingRates] = useState<Record<string, boolean>>({})

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

  // Calculate total weight per seller group (skip jasa products — they don't need shipping)
  const weightBySeller = useMemo(() => {
    const weights: Record<string, number> = {}
    groupedBySeller.forEach(group => {
      const sellerId = group.seller.id
      weights[sellerId] = group.items.reduce((sum, item) => {
        // Jasa products have no physical weight — skip them from shipping calculation
        if ((item.product as any).productType === 'jasa') return sum
        const itemWeight = (item.product.weight || 500) * item.quantity // default 500g if not set
        return sum + itemWeight
      }, 0)
    })
    return weights
  }, [groupedBySeller])

  // Check if a seller group contains ONLY jasa products (no shipping needed)
  const isJasaOnlySeller = useCallback((sellerId: string): boolean => {
    const group = groupedBySeller.find(g => g.seller.id === sellerId)
    if (!group) return false
    return group.items.every(item => (item.product as any).productType === 'jasa')
  }, [groupedBySeller])

  // Fetch shipping rates from API when address is selected
  const fetchShippingRates = useCallback(async (sellerId: string, destinationCity: string, weightGrams: number, originCity?: string) => {
    setIsLoadingRates(prev => ({ ...prev, [sellerId]: true }))
    try {
      const res = await apiClient.rawPost('/api/shipping/calculate', {
        originCity: originCity || 'Jakarta', // Use seller's store city, fallback to Jakarta
        destinationCity,
        weight: weightGrams,
      })
      const data: ShippingResponse = await res.json()
      if (data.success && data.data?.rates && data.data.rates.length > 0) {
        setShippingRatesBySeller(prev => ({ ...prev, [sellerId]: data.data!.rates } as Record<string, ShippingOption[]>))
      } else {
        // Fallback to default options
        setShippingRatesBySeller(prev => ({ ...prev, [sellerId]: DEFAULT_SHIPPING_OPTIONS }))
      }
    } catch (err) {
      logger.warn({ component: 'checkout', err }, 'Shipping rate fetch failed, using defaults')
      // Fallback to default options
      setShippingRatesBySeller(prev => ({ ...prev, [sellerId]: DEFAULT_SHIPPING_OPTIONS }))
    } finally {
      setIsLoadingRates(prev => ({ ...prev, [sellerId]: false }))
    }
  }, [])

  // Auto-fetch shipping rates when address changes and items are in cart
  useEffect(() => {
    if (!defaultAddress || groupedBySeller.length === 0) return

    groupedBySeller.forEach(group => {
      const sellerId = group.seller.id
      // Skip shipping for jasa-only sellers
      if (isJasaOnlySeller(sellerId)) {
        // Set zero-cost shipping for jasa-only sellers
        setShippingBySeller(prev => ({ ...prev, [sellerId]: { provider: 'jasa', service: 'free', name: 'Tanpa Pengiriman (Jasa)', price: 0, estimatedDays: '-', logo: '📦' } }))
        return
      }
      const weight = weightBySeller[sellerId] || 1000
      // Only fetch if we don't have rates yet for this seller or if address changed
      const currentRates = shippingRatesBySeller[sellerId]
      if (!currentRates || currentRates.length === 0) {
        fetchShippingRates(sellerId, defaultAddress.city, weight, group.seller.storeCity)
      }
    })
  }, [defaultAddress?.id, groupedBySeller.length])

  // Re-fetch rates when address changes (different city)
  useEffect(() => {
    if (!defaultAddress || groupedBySeller.length === 0) return

    groupedBySeller.forEach(group => {
      const sellerId = group.seller.id
      if (isJasaOnlySeller(sellerId)) return // Skip jasa-only sellers
      const weight = weightBySeller[sellerId] || 1000
      fetchShippingRates(sellerId, defaultAddress.city, weight, group.seller.storeCity)
    })
  }, [defaultAddress?.city])

  // Get shipping options for a seller (dynamic or fallback)
  const getShippingOptions = useCallback((sellerId: string): ShippingOption[] => {
    return shippingRatesBySeller[sellerId] || DEFAULT_SHIPPING_OPTIONS
  }, [shippingRatesBySeller])

  // Calculate totals — use platform settings with fallback defaults
  const subtotal = checkedTotal
  const shippingCost = Object.values(shippingBySeller).reduce((sum, opt) => sum + opt.price, 0)
  const platformFee = (platformSettings?.platformFee as number) ?? 1000
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

  // BUG 20 FIX: Ensure totalAmount never goes negative (e.g., voucher > subtotal + shipping)
  const totalAmount = Math.max(0, subtotal + shippingCost - voucherDiscount + platformFee + taxAmount)

  // Check if ALL items in the checkout are jasa (service) products — no address needed
  const isAllJasa = useMemo(() => {
    return checkedItems.length > 0 && checkedItems.every(item => (item.product as any).productType === 'jasa')
  }, [checkedItems])

  // Calculate current checkout step
  const currentStep = useMemo(() => {
    // For all-jasa orders, skip address/shipping steps — go straight to payment
    if (isAllJasa) return 2
    if (!defaultAddress) return 0
    if (Object.keys(shippingBySeller).length < groupedBySeller.length) return 1
    return 2
  }, [defaultAddress, shippingBySeller, groupedBySeller, isAllJasa])

  const handleShippingSelect = (sellerId: string, option: ShippingOption) => {
    setShippingBySeller(prev => ({ ...prev, [sellerId]: option }))
  }

  const isReadyToPay = useMemo(() => {
    const hasPayment = selectedPayment !== null
    const hasAddressOrJasa = isAllJasa || defaultAddress !== null
    const hasShipping = isAllJasa || Object.keys(shippingBySeller).length >= groupedBySeller.length
    const hasItems = checkedCount > 0
    const hasBalance = !(selectedPayment === 'wallet' && walletBalance < totalAmount)
    return hasPayment && hasAddressOrJasa && hasShipping && hasItems && hasBalance
  }, [selectedPayment, defaultAddress, shippingBySeller, groupedBySeller, checkedCount, walletBalance, totalAmount, isAllJasa])

  const handlePay = async () => {
    if (!selectedPayment) {
      showToast("Pilih metode pembayaran terlebih dahulu", "error")
      return
    }
    if (!isAllJasa && !defaultAddress) {
      showToast("Tambahkan alamat pengiriman terlebih dahulu", "error")
      return
    }
    if (!isAllJasa && Object.keys(shippingBySeller).length < groupedBySeller.length) {
      showToast("Pilih metode pengiriman untuk semua toko", "error")
      return
    }
    if (selectedPayment === 'wallet' && walletBalance < totalAmount) {
      showToast("Saldo MartUp Pay tidak mencukupi. Silakan top up atau pilih metode lain.", "error")
      return
    }

    // Stock validation (skip jasa products — unlimited stock)
    const outOfStockItem = checkedItems.find(item => {
      if ((item.product as any).productType === 'jasa') return false // unlimited stock for services
      const maxStock = item.variant ? item.variant.stock : item.product.stock
      return item.quantity > maxStock
    })
    if (outOfStockItem) {
      const maxStock = outOfStockItem.variant ? outOfStockItem.variant.stock : outOfStockItem.product.stock
      showToast(`Stok "${outOfStockItem.product.name}" tidak mencukupi (tersedia: ${maxStock})`, "error")
      return
    }

    // Server-side voucher validation
    let validatedVoucherDiscount = voucherDiscount
    if (selectedVoucher) {
      try {
        const validateRes = await apiClient.rawPost('/api/vouchers/validate', {
          code: selectedVoucher.code,
          userId: currentUser?.id,
          cartSubtotal: subtotal,
        })
        const validateData: VoucherValidateResponse = await validateRes.json()
        if (validateData.success && validateData.data) {
          if (!validateData.data.valid) {
            showToast(validateData.data.message || "Voucher tidak valid", "error")
            selectVoucher(null)
            return
          }
          // Use server-computed discount amount
          validatedVoucherDiscount = validateData.data.discountAmount
        }
      } catch {
        // Fallback: use local calculation
      }
    }

    setIsProcessing(true)

    const newOrderNumber = `ORD-${Date.now()}`
    setOrderNumber(newOrderNumber)

    try {
      // ==================== Create orders via API ====================
      // For wallet payment: order status = 'paid' immediately
      // For Midtrans/Card/COD: order status = 'pending' (awaiting payment)
      const isImmediatePayment = selectedPayment === 'wallet'
      const createdOrders: { id: string; totalAmount: number }[] = []

      for (const group of groupedBySeller) {
        const sellerShipping = shippingBySeller[group.seller.id]
        const groupSubtotal = group.items.reduce((sum, i) => sum + ((i.product.discountPrice || i.product.price) * i.quantity), 0)
        const groupShipping = sellerShipping?.price || 0
        const groupDiscount = subtotal > 0 ? Math.round(validatedVoucherDiscount * (groupSubtotal / subtotal)) : 0
        const groupTotal = groupSubtotal + groupShipping - groupDiscount + platformFee

        const isSellerJasaOnly = isJasaOnlySeller(group.seller.id)
        const orderPayload = {
          userId: currentUser?.id || '',
          sellerId: group.seller.id,
          addressId: isSellerJasaOnly ? null : defaultAddress?.id || null,
          subtotal: groupSubtotal,
          shippingCost: isSellerJasaOnly ? 0 : groupShipping,
          discountAmount: groupDiscount,
          taxAmount: 0,
          platformFee,
          totalAmount: groupTotal,
          paymentMethod: PAYMENT_METHODS.find(m => m.id === selectedPayment)?.name || selectedPayment,
          items: group.items.map((item) => ({
            productId: item.productId,
            variantId: item.variant?.id || null,
            productName: item.product.name,
            variantName: item.variant ? `${item.variant.name}: ${item.variant.value}` : null,
            price: item.product.discountPrice || item.product.price,
            quantity: item.quantity,
            subtotal: (item.product.discountPrice || item.product.price) * item.quantity,
            image: item.product.images?.[0] || null,
          })),
          // Skip shipping data for jasa-only seller groups
          ...(isSellerJasaOnly ? {} : {
            shipping: {
              provider: sellerShipping?.provider || 'JNE',
              service: sellerShipping?.service || 'REG',
              estimatedDays: sellerShipping?.estimatedDays || null,
            },
          }),
        }

        const orderStatus = isImmediatePayment ? 'paid' as const : 'pending' as const
        const orderPaymentStatus = isImmediatePayment ? 'paid' : 'unpaid'

        try {
          const res = await apiClient.rawPost('/api/orders', orderPayload)
          const data: OrderCreateResponse = await res.json()

          if (data.success && data.data) {
            const apiOrder = data.data
            createdOrders.push({ id: apiOrder.id, totalAmount: groupTotal })
            const localOrder = {
              id: apiOrder.id,
              orderNumber: apiOrder.orderNumber,
              userId: currentUser?.id || '',
              sellerId: group.seller.id,
              status: orderStatus,
              subtotal: groupSubtotal,
              shippingCost: isSellerJasaOnly ? 0 : groupShipping,
              discountAmount: groupDiscount,
              taxAmount: 0,
              platformFee,
              totalAmount: groupTotal,
              paymentMethod: PAYMENT_METHODS.find(m => m.id === selectedPayment)?.name || selectedPayment,
              paymentStatus: orderPaymentStatus,
              escrowStatus: isImmediatePayment ? 'held' : 'none',
              isServiceOrder: isSellerJasaOnly,
              items: group.items.map((item) => ({
                id: `oi${Date.now()}-${item.id}`,
                productId: item.productId,
                productName: item.product.name,
                variantName: item.variant ? `${item.variant.name}: ${item.variant.value}` : undefined,
                variantId: item.variant?.id || undefined,
                price: item.product.discountPrice || item.product.price,
                quantity: item.quantity,
                subtotal: (item.product.discountPrice || item.product.price) * item.quantity,
                image: item.product.images?.[0]
              })),
              // Skip shipping info for jasa-only orders
              ...(isSellerJasaOnly ? {} : {
                shipping: {
                  id: `sh${Date.now()}-${group.seller.id}`,
                  provider: sellerShipping?.provider || 'JNE',
                  service: sellerShipping?.service || 'REG',
                  estimatedDays: sellerShipping?.estimatedDays,
                  status: 'pending'
                },
              }),
              address: isSellerJasaOnly ? undefined : defaultAddress,
              seller: group.seller,
              createdAt: new Date().toISOString(),
              paidAt: isImmediatePayment ? new Date().toISOString() : undefined
            }
            addOrder(localOrder)
          }
        } catch (error) {
          logger.warn({ component: 'checkout', err: error }, 'Order creation failed')
        }
      }

      // BUG 10 FIX: Cart removal moved to AFTER payment confirmation
      // Previously removed items before payment processing — if payment failed,
      // the cart was already empty and user had no way to retry.
      // Now items are removed after successful payment for each method.

      // ==================== Payment processing ====================

      if (selectedPayment === 'wallet') {
        // Wallet payment: pay each order via /api/wallet/debit
        // IMPORTANT: Use per-order amount (not combined total) to match order totalAmount
        if (selectedVoucher) markVoucherUsed(selectedVoucher.id)

        let walletPaymentSuccess = true
        for (const order of createdOrders) {
          try {
            const walletRes = await apiClient.rawPost('/api/wallet/debit', {
              orderId: order.id,
              amount: order.totalAmount,
              description: `Pembayaran pesanan via MartUp Pay`,
            })
            const walletData: WalletDebitResponse = await walletRes.json()
            if (!walletData.success) {
              walletPaymentSuccess = false
              showToast(walletData.error || 'Pembayaran wallet gagal', 'error')
            }
          } catch (error) {
            walletPaymentSuccess = false
            logger.warn({ component: 'checkout', err: error }, 'Wallet payment API failed')
          }
        }

        // Update local wallet balance
        deductWallet(Math.max(0, totalAmount), 'Pembayaran pesanan via MartUp Pay')

        // BUG 10 FIX: Remove cart items only after wallet payment succeeds
        if (walletPaymentSuccess) {
          const checkedItemIds = checkedItems.map(i => i.id)
          checkedItemIds.forEach(id => removeItem(id))
        }

        setIsProcessing(false)
        if (walletPaymentSuccess) {
          setShowSuccessModal(true)
          setTimeout(() => {
            setShowSuccessModal(false)
            navigate('orders')
          }, 2500)
        } else {
          showToast('Pembayaran wallet gagal. Pesanan tersimpan sebagai "Belum Bayar".', 'error')
          navigate('orders')
        }

      } else if (selectedPayment === 'midtrans' || selectedPayment === 'card') {
        // Midtrans / Card payment: open Snap popup for each seller order
        if (selectedVoucher) markVoucherUsed(selectedVoucher.id)

        // BUG 10 FIX: Remove cart items after Midtrans payment creation succeeds
        // (user is redirected to pay, so order is committed)
        if (createdOrders.length > 0) {
          const checkedItemIds = checkedItems.map(i => i.id)
          checkedItemIds.forEach(id => removeItem(id))
        }

        if (createdOrders.length > 0) {
          try {
            let allSuccess = true
            let anyPending = false

            // Process each order's payment sequentially
            // (Each seller gets their own Midtrans transaction)
            for (let i = 0; i < createdOrders.length; i++) {
              const paymentRes = await apiClient.rawPost('/api/payment/create', { orderId: createdOrders[i].id })
              const paymentData: PaymentCreateResponse = await paymentRes.json()

              if (paymentData.success && paymentData.data?.token) {
                // Show progress for multi-seller
                if (createdOrders.length > 1) {
                  showToast(`Pembayaran ${i + 1} dari ${createdOrders.length} toko...`, 'info')
                }

                // Open Midtrans Snap popup
                const snapResult = await openSnapPayment(paymentData.data.token)

                if (snapResult.status === 'success') {
                  // Continue to next order
                } else if (snapResult.status === 'pending') {
                  anyPending = true
                  allSuccess = false
                } else if (snapResult.status === 'closed') {
                  allSuccess = false
                  // User closed popup — stop processing remaining orders
                  showToast('Pembayaran dibatalkan. Anda bisa membayar nanti dari halaman pesanan.', 'warning')
                  break
                } else {
                  allSuccess = false
                }
              } else {
                // Snap token creation failed for this order
                logger.warn({ component: 'checkout', orderId: createdOrders[i].id, err: paymentData.error }, 'Snap token creation failed')
                allSuccess = false
              }
            }

            setIsProcessing(false)

            if (allSuccess) {
              showToast('Pembayaran berhasil!', 'success')
            } else if (anyPending) {
              showToast('Pembayaran tertunda. Silakan selesaikan pembayaran Anda.', 'warning')
            }
            navigate('orders')
          } catch (error) {
            logger.warn({ component: 'checkout', err: error }, 'Midtrans payment failed')
            showToast('Terjadi kesalahan saat memproses pembayaran. Pesanan Anda tersimpan sebagai "Belum Bayar".', 'error')
            setIsProcessing(false)
            navigate('orders')
          }
        } else {
          // No orders were created via API (all failed)
          showToast('Gagal membuat pesanan. Silakan coba lagi.', 'error')
          setIsProcessing(false)
        }

      } else if (selectedPayment === 'cod' || selectedPayment === 'bank_transfer') {
        // COD or bank_transfer — order stays pending
        if (selectedVoucher) markVoucherUsed(selectedVoucher.id)

        // BUG 10 FIX: Remove cart items for COD (no payment step needed)
        const checkedItemIds = checkedItems.map(i => i.id)
        checkedItemIds.forEach(id => removeItem(id))

        setIsProcessing(false)
        setShowSuccessModal(true)
        setTimeout(() => {
          setShowSuccessModal(false)
          navigate('orders')
        }, 2500)
      }
    } catch (error) {
      logger.warn({ component: 'checkout', err: error }, 'Checkout error')
      showToast('Terjadi kesalahan saat checkout. Silakan coba lagi.', 'error')
      setIsProcessing(false)
    }
  }

  // Empty state
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

      {/* Step Indicator */}
      <CheckoutStepIndicator currentStep={currentStep} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4 space-y-4"
      >
        {/* Address Section — skip for all-jasa orders */}
        {!isAllJasa && (
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
        )}

        {/* Service Order Notice — shown for all-jasa orders */}
        {isAllJasa && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              <span className="text-sm font-semibold">Pesanan Jasa (Tanpa Pengiriman)</span>
            </div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1 ml-7">
              Pesanan jasa tidak memerlukan alamat pengiriman. Pembayaran akan ditahan (escrow) sampai jasa selesai dan dikonfirmasi.
            </p>
          </motion.div>
        )}

        <Separator />

        {/* Items Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          {groupedBySeller.map((group) => (
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
                  options={getShippingOptions(group.seller.id)}
                  isLoading={isLoadingRates[group.seller.id]}
                />
              </div>
            </div>
          ))}
        </motion.div>

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

        {/* Payment Method */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border/50 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold">Metode Pembayaran</h3>
          </div>

          <div className="space-y-2">
            {PAYMENT_METHODS.map((method) => {
              const isSelected = selectedPayment === method.id
              const Icon = method.icon
              const isWalletInsufficient = method.id === 'wallet' && walletBalance < totalAmount

              return (
                <motion.button
                  key={method.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (isWalletInsufficient) {
                      showToast("Saldo tidak mencukupi. Silakan top up terlebih dahulu.", "error")
                      return
                    }
                    setSelectedPayment(method.id)
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500"
                      : isWalletInsufficient
                        ? "bg-muted/30 border-border/30 opacity-60"
                        : "bg-background border-border/50 hover:border-emerald-300"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600"
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>

                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    method.color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                    method.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    method.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
                    method.color === 'teal' ? 'bg-teal-100 dark:bg-teal-900/30' :
                    'bg-orange-100 dark:bg-orange-900/30'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      method.color === 'emerald' ? 'text-emerald-600' :
                      method.color === 'blue' ? 'text-blue-600' :
                      method.color === 'purple' ? 'text-purple-600' :
                      method.color === 'teal' ? 'text-teal-600' :
                      'text-orange-600'
                    }`} />
                  </div>

                  <div className="flex-1 text-left min-w-0">
                    <p className={`text-sm font-medium ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                      {method.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {method.id === 'wallet'
                        ? `Saldo: ${formatPrice(walletBalance)}${isWalletInsufficient ? ' (tidak cukup)' : ''}`
                        : method.description
                      }
                    </p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        {/* Price Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-xl border border-border/50 p-4 space-y-2.5"
        >
          <h3 className="text-sm font-bold">Ringkasan Pembayaran</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal ({checkedCount} produk)</span>
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
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Total Pembayaran</span>
            <span className="text-lg font-bold text-emerald-600">{formatPrice(Math.max(0, totalAmount))}</span>
          </div>

          {/* Security badge */}
          <div className="flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] text-muted-foreground">Transaksi aman & terenkripsi</span>
          </div>

          {/* Cancel order link */}
          <div className="flex justify-center pt-2">
            <button
              onClick={() => {
                setSelectedPayment(null)
                navigate('cart')
              }}
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors underline underline-offset-2"
            >
              Batalkan Pesanan
            </button>
          </div>
        </motion.div>

        {/* Missing step hints */}
        {!defaultAddress && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800"
          >
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">Tambahkan alamat pengiriman untuk melanjutkan</p>
          </motion.div>
        )}
        {defaultAddress && Object.keys(shippingBySeller).length < groupedBySeller.length && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800"
          >
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">Pilih metode pengiriman untuk semua toko</p>
          </motion.div>
        )}
      </motion.div>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto max-w-[430px] md:max-w-[480px]">
          <div className="glass border-t border-border/50 pb-safe">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Pembayaran</p>
                <p className="text-lg font-bold text-emerald-600">{formatPrice(Math.max(0, totalAmount))}</p>
              </div>
              <Button
                className="h-11 px-8 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white disabled:opacity-50 gap-1.5"
                disabled={!isReadyToPay || isProcessing}
                onClick={handlePay}
              >
                {isProcessing ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                    Memproses...
                  </>
                ) : (
                  <>
                    Bayar
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
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
                <h3 className="text-lg font-bold text-foreground">
                  {selectedPayment === 'wallet' ? 'Pembayaran Berhasil!' : 'Pesanan Dibuat!'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedPayment === 'wallet'
                    ? 'Terima kasih atas pesananmu. Pesanan sedang diproses oleh penjual.'
                    : selectedPayment === 'cod'
                      ? 'Pesanan berhasil dibuat. Pembayaran akan dilakukan saat barang diterima.'
                      : 'Pesanan berhasil dibuat. Silakan selesaikan pembayaran sebelum batas waktu.'
                  }
                </p>
              </div>

              <div className="bg-muted/30 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">No. Pesanan</span>
                  <span className="font-medium">{orderNumber}</span>
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
