"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  MapPin, ChevronRight, Truck, Ticket, CreditCard, Wallet,
  Check, ShoppingBag, Clock, BadgeCheck, ArrowRight,
  ShieldCheck, Info, Banknote, Smartphone, AlertTriangle, Landmark, Copy, CheckCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAppStore, useCartStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { DEFAULT_SHIPPING_OPTIONS } from "@/lib/constants"
import {
  PageHeader, EmptyState
} from "../shared"
import type { CartItem, ShippingOption, Address } from "@/lib/types"
import { logger } from '@/lib/logger'
import { useState, useMemo, useEffect, useCallback } from "react"
import { openSnapPayment } from '@/lib/midtrans'
import { apiClient } from '@/lib/api-client'
import { CheckoutStepIndicator, AddressCard } from './address-step'
import { ShippingSelector } from './shipping-step'
import { PaymentMethodSelector } from './payment-step'
import { PriceSummary, StickyBottomCTA, SuccessModal, StepHints } from './order-summary'
import { PAYMENT_METHODS, type EscrowBankAccount, type VoucherValidateResponse, type OrderCreateResponse, type WalletDebitResponse, type PaymentCreateResponse } from './shared'

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
  const [escrowBankAccounts, setEscrowBankAccounts] = useState<EscrowBankAccount[]>([])
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(false)
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null)

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

  // Calculate total weight per seller group
  const weightBySeller = useMemo(() => {
    const weights: Record<string, number> = {}
    groupedBySeller.forEach(group => {
      const sellerId = group.seller.id
      weights[sellerId] = group.items.reduce((sum, item) => {
        const itemWeight = (item.product.weight || 500) * item.quantity // default 500g if not set
        return sum + itemWeight
      }, 0)
    })
    return weights
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
      const data = await res.json() as { success: boolean; data?: { rates?: ShippingOption[] }; error?: string }
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
      const weight = weightBySeller[sellerId] || 1000
      fetchShippingRates(sellerId, defaultAddress.city, weight, group.seller.storeCity)
    })
  }, [defaultAddress?.city])

  // Fetch MartUp bank accounts when escrow is selected
  useEffect(() => {
    if (selectedPayment === 'escrow' && escrowBankAccounts.length === 0) {
      setIsLoadingBankAccounts(true)
      apiClient.get<{ success: boolean; data: EscrowBankAccount[] }>('/api/settings/bank-accounts')
        .then((res) => {
          if (res.data && Array.isArray(res.data)) {
            setEscrowBankAccounts(res.data)
          }
        })
        .catch((err) => {
          logger.warn({ component: 'checkout', err }, 'Failed to fetch bank accounts')
        })
        .finally(() => setIsLoadingBankAccounts(false))
    }
  }, [selectedPayment, escrowBankAccounts.length])

  const handleCopyAccountNumber = (accountNumber: string, accountId: string) => {
    navigator.clipboard?.writeText(accountNumber)
    setCopiedAccountId(accountId)
    showToast('Nomor rekening disalin!', 'success')
    setTimeout(() => setCopiedAccountId(null), 2000)
  }

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

  // Calculate current checkout step
  const currentStep = useMemo(() => {
    if (!defaultAddress) return 0
    if (Object.keys(shippingBySeller).length < groupedBySeller.length) return 1
    return 2
  }, [defaultAddress, shippingBySeller, groupedBySeller])

  const handleShippingSelect = (sellerId: string, option: ShippingOption) => {
    setShippingBySeller(prev => ({ ...prev, [sellerId]: option }))
  }

  const isReadyToPay = useMemo(() => {
    return (
      selectedPayment !== null &&
      defaultAddress !== null &&
      Object.keys(shippingBySeller).length >= groupedBySeller.length &&
      checkedCount > 0 &&
      !(selectedPayment === 'wallet' && walletBalance < totalAmount)
    )
  }, [selectedPayment, defaultAddress, shippingBySeller, groupedBySeller, checkedCount, walletBalance, totalAmount])

  // Handle payment method selection (with wallet insufficient toast)
  const handleSelectPayment = (id: string) => {
    if (id === '__insufficient__') {
      showToast("Saldo tidak mencukupi. Silakan top up terlebih dahulu.", "error")
      return
    }
    setSelectedPayment(id)
  }

  // Handle cancel order button
  const handleCancelOrder = () => {
    setSelectedPayment(null)
    navigate('cart')
  }

  const handlePay = async () => {
    if (!selectedPayment) {
      showToast("Pilih metode pembayaran terlebih dahulu", "error")
      return
    }
    if (!defaultAddress) {
      showToast("Tambahkan alamat pengiriman terlebih dahulu", "error")
      return
    }
    if (Object.keys(shippingBySeller).length < groupedBySeller.length) {
      showToast("Pilih metode pengiriman untuk semua toko", "error")
      return
    }
    if (selectedPayment === 'wallet' && walletBalance < totalAmount) {
      showToast("Saldo MartUp Pay tidak mencukupi. Silakan top up atau pilih metode lain.", "error")
      return
    }

    // Stock validation
    const outOfStockItem = checkedItems.find(item => {
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

      for (let groupIndex = 0; groupIndex < groupedBySeller.length; groupIndex++) {
        const group = groupedBySeller[groupIndex]
        const sellerShipping = shippingBySeller[group.seller.id]
        const groupSubtotal = group.items.reduce((sum, i) => sum + ((i.product.discountPrice || i.product.price) * i.quantity), 0)
        const groupShipping = sellerShipping?.price || 0
        const groupDiscount = subtotal > 0 ? Math.round(validatedVoucherDiscount * (groupSubtotal / subtotal)) : 0
        // Distribute platformFee proportionally across seller groups (like voucher discount)
        // Use integer division with remainder distribution to ensure sum matches total
        const baseFee = Math.floor(platformFee / groupedBySeller.length)
        const remainder = platformFee - baseFee * groupedBySeller.length
        const groupPlatformFee = baseFee + (groupIndex < remainder ? 1 : 0)
        const groupTotal = groupSubtotal + groupShipping - groupDiscount + groupPlatformFee

        const orderPayload = {
          userId: currentUser?.id || '',
          sellerId: group.seller.id,
          addressId: defaultAddress.id,
          subtotal: groupSubtotal,
          shippingCost: groupShipping,
          discountAmount: groupDiscount,
          taxAmount: 0,
          platformFee: groupPlatformFee,
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
          shipping: {
            provider: sellerShipping?.provider || 'JNE',
            service: sellerShipping?.service || 'REG',
            estimatedDays: sellerShipping?.estimatedDays || null,
          },
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
              shippingCost: groupShipping,
              discountAmount: groupDiscount,
              taxAmount: 0,
              platformFee: groupPlatformFee,
              totalAmount: groupTotal,
              paymentMethod: PAYMENT_METHODS.find(m => m.id === selectedPayment)?.name || selectedPayment,
              paymentStatus: orderPaymentStatus,
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
              shipping: {
                id: `sh${Date.now()}-${group.seller.id}`,
                provider: sellerShipping?.provider || 'JNE',
                service: sellerShipping?.service || 'REG',
                estimatedDays: sellerShipping?.estimatedDays,
                status: 'pending'
              },
              address: defaultAddress,
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
        let totalDebited = 0 // Track sum of actually debited amounts from server
        for (const order of createdOrders) {
          try {
            const walletRes = await apiClient.rawPost('/api/wallet/debit', {
              orderId: order.id,
              amount: order.totalAmount,
              description: `Pembayaran pesanan via MartUp Pay`,
            })
            const walletData: WalletDebitResponse = await walletRes.json()
            if (walletData.success) {
              totalDebited += order.totalAmount // Only count successful debits
            } else {
              walletPaymentSuccess = false
              showToast(walletData.error || 'Pembayaran wallet gagal', 'error')
            }
          } catch (error) {
            walletPaymentSuccess = false
            logger.warn({ component: 'checkout', err: error }, 'Wallet payment API failed')
          }
        }

        // CRITICAL FIX: Only deduct from local wallet if payment succeeded
        // Use the server-confirmed total (sum of successful debits), NOT the locally-computed total
        if (walletPaymentSuccess && totalDebited > 0) {
          deductWallet(totalDebited, 'Pembayaran pesanan via MartUp Pay')
          const checkedItemIds = checkedItems.map(i => i.id)
          checkedItemIds.forEach(id => removeItem(id))
        } else if (totalDebited > 0) {
          // Partial failure: some orders paid, some failed
          // Deduct only what the server actually took
          deductWallet(totalDebited, 'Pembayaran pesanan (parsial)')
          showToast('Sebagian pembayaran berhasil. Pesanan yang gagal tersimpan sebagai "Belum Bayar".', 'warning')
        }

        setIsProcessing(false)
        if (walletPaymentSuccess) {
          setShowSuccessModal(true)
          setTimeout(() => {
            setShowSuccessModal(false)
            navigate('orders')
          }, 2500)
        } else {
          navigate('orders')
        }

      } else if (selectedPayment === 'escrow') {
        // Escrow payment: buyer transfers to MartUp bank account
        // Order stays pending/unpaid — buyer uploads proof later from order detail
        if (selectedVoucher) markVoucherUsed(selectedVoucher.id)

        // Remove cart items (order is committed)
        const checkedItemIds = checkedItems.map(i => i.id)
        checkedItemIds.forEach(id => removeItem(id))

        setIsProcessing(false)
        showToast('Pesanan dibuat! Silakan transfer ke rekening MartUp dan upload bukti pembayaran.', 'success')
        navigate('orders')

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

      } else {
        // COD or other payment methods — order stays pending
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
        {/* Address Section */}
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
        <PaymentMethodSelector
          selectedPayment={selectedPayment}
          onSelectPayment={handleSelectPayment}
          walletBalance={walletBalance}
          totalAmount={totalAmount}
          escrowBankAccounts={escrowBankAccounts}
          isLoadingBankAccounts={isLoadingBankAccounts}
          copiedAccountId={copiedAccountId}
          onCopyAccountNumber={handleCopyAccountNumber}
        />

        {/* Price Summary */}
        <PriceSummary
          subtotal={subtotal}
          shippingCost={shippingCost}
          voucherDiscount={voucherDiscount}
          platformFee={platformFee}
          totalAmount={totalAmount}
          checkedCount={checkedCount}
        />

        {/* Step Hints */}
        <StepHints
          hasAddress={!!defaultAddress}
          hasAllShipping={Object.keys(shippingBySeller).length >= groupedBySeller.length}
        />
      </motion.div>

      {/* Sticky Bottom CTA */}
      <StickyBottomCTA
        totalAmount={totalAmount}
        isReadyToPay={isReadyToPay}
        isProcessing={isProcessing}
        onPay={handlePay}
      />

      {/* Success Modal */}
      <SuccessModal
        show={showSuccessModal}
        selectedPayment={selectedPayment}
        orderNumber={orderNumber}
        totalAmount={totalAmount}
      />
    </div>
  )
}
