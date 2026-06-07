"use client"

import { motion } from "framer-motion"
import {
  ChevronRight, Ticket, ShoppingBag, BadgeCheck, ArrowRight,
  Info, Plus, Minus, Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useAppStore, useCartStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import {
  PageHeader, EmptyState
} from "../shared"
import type { CartItem, ShippingOption } from "@/lib/types"
import { logger } from '@/lib/logger'
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { openSnapPayment } from '@/lib/midtrans'
import { apiClient } from '@/lib/api-client'
import { extractPaymentReference } from '@/lib/payment-utils'
import { CheckoutStepIndicator } from './CheckoutStepIndicator'
import { AddressCard } from './AddressCard'
import { ShippingSelector } from './ShippingSelector'
import { PaymentMethodSelector } from './PaymentMethodSelector'
import { CheckoutSummary } from './CheckoutSummary'
import { OrderSuccessModal } from './OrderSuccessModal'

// ==================== API RESPONSE TYPES ====================
type ShippingResponse = { success: boolean; data?: { rates?: ShippingOption[] }; error?: string }
type VoucherValidateResponse = { success: boolean; data?: { valid: boolean; message?: string; discountAmount: number }; error?: string }
type OrderCreateResponse = { success: boolean; data?: { id: string; orderNumber: string }; error?: string }
type WalletDebitResponse = { success: boolean; error?: string }
type PaymentCreateResponse = { success: boolean; data?: { token: string }; error?: string }

// ==================== MAIN COMPONENT ====================
export function CheckoutScreen() {
  const { navigate, addresses, selectedAddressId, selectedVoucher, addOrder, showToast, walletBalance, deductWallet, useVoucher: markVoucherUsed, currentUser, selectVoucher, platformSettings, setSelectedProduct } = useAppStore()
  const { items, getCheckedItems, getCheckedTotal, getCheckedCount, clearCart, removeItem, updateQuantity } = useCartStore()

  const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
  const [shippingBySeller, setShippingBySeller] = useState<Record<string, ShippingOption>>({})
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const isPayingRef = useRef(false) // Double-submit prevention lock
  const prevCityRef = useRef<string | null>(null) // Track previous city to detect actual city changes
  const fetchingSellerRef = useRef<Set<string>>(new Set()) // Track in-flight shipping fetches
  const [shippingRatesBySeller, setShippingRatesBySeller] = useState<Record<string, ShippingOption[]>>({})
  const [isLoadingRates, setIsLoadingRates] = useState<Record<string, boolean>>({})
  const [shippingError, setShippingError] = useState<Record<string, string>>({})
  const checkedItems = getCheckedItems()
  const checkedTotal = getCheckedTotal()
  const checkedCount = getCheckedCount()

  // Find default address
  const defaultAddress = addresses.find(a => a.id === selectedAddressId) || addresses[0] || null

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
        if (item.product.productType === 'jasa') return sum
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
    return group.items.every(item => item.product.productType === 'jasa')
  }, [groupedBySeller])

  // Fetch shipping rates from API — with in-flight deduplication to prevent concurrent duplicate fetches
  const fetchShippingRates = useCallback(async (sellerId: string, destinationCity: string, weightGrams: number, originCity?: string) => {
    // Skip if already fetching for this seller (prevents concurrent duplicate requests)
    if (fetchingSellerRef.current.has(sellerId)) return
    fetchingSellerRef.current.add(sellerId)

    setIsLoadingRates(prev => ({ ...prev, [sellerId]: true }))
    setShippingError(prev => { const next = { ...prev }; delete next[sellerId]; return next })
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
        // No rates available — show error instead of hardcoded defaults
        setShippingRatesBySeller(prev => ({ ...prev, [sellerId]: [] }))
        setShippingError(prev => ({ ...prev, [sellerId]: 'Gagal menghitung ongkir. Periksa alamat pengiriman Anda.' }))
      }
    } catch (err) {
      logger.warn({ component: 'checkout', err }, 'Shipping rate fetch failed')
      // Show error instead of hardcoded defaults
      setShippingRatesBySeller(prev => ({ ...prev, [sellerId]: [] }))
      setShippingError(prev => ({ ...prev, [sellerId]: 'Gagal menghitung ongkir. Periksa alamat pengiriman Anda.' }))
    } finally {
      setIsLoadingRates(prev => ({ ...prev, [sellerId]: false }))
      fetchingSellerRef.current.delete(sellerId)
    }
  }, [])

  // Auto-fetch shipping rates when address or items change
  // Merged from two competing useEffects that caused double-fetching and
  // unnecessary clearing of jasa-only shipping selections.
  // - Only clears non-jasa shipping selections when the city actually changes
  // - Uses prevCityRef to detect actual city changes vs same-city address switches
  // - fetchingSellerRef prevents concurrent duplicate fetches for the same seller
  useEffect(() => {
    if (!defaultAddress || groupedBySeller.length === 0) return

    const currentCity = defaultAddress.city
    const cityChanged = prevCityRef.current !== null && prevCityRef.current !== currentCity
    prevCityRef.current = currentCity

    // When city changes, clear only non-jasa shipping selections (jasa selections are safe to keep)
    if (cityChanged) {
      setShippingBySeller(prev => {
        const next: Record<string, ShippingOption> = {}
        for (const [sellerId, option] of Object.entries(prev)) {
          if (option.provider === 'jasa') {
            next[sellerId] = option
          }
        }
        return next
      })
    }

    groupedBySeller.forEach(group => {
      const sellerId = group.seller.id
      // Skip shipping for jasa-only sellers — set free shipping
      if (isJasaOnlySeller(sellerId)) {
        setShippingBySeller(prev => ({ ...prev, [sellerId]: { provider: 'jasa', service: 'free', name: 'Tanpa Pengiriman (Tolong Mas)', price: 0, estimatedDays: '-', logo: '📦' } }))
        return
      }

      // Skip if already fetching for this seller
      if (fetchingSellerRef.current.has(sellerId)) return

      const weight = weightBySeller[sellerId] || 1000

      if (cityChanged) {
        // City changed — always re-fetch (old rates are for wrong destination)
        fetchShippingRates(sellerId, currentCity, weight, group.seller.storeCity)
      } else {
        // No city change — only fetch if we don't have rates yet
        // NOTE: shippingRatesBySeller may be stale here (not in deps to avoid infinite loops),
        // but this is safe: on initial load it's empty so we fetch; after fetch, this effect
        // doesn't re-run (deps unchanged), so stale data showing existing rates is fine.
        const currentRates = shippingRatesBySeller[sellerId]
        if (!currentRates || currentRates.length === 0) {
          fetchShippingRates(sellerId, currentCity, weight, group.seller.storeCity)
        }
      }
    })
  }, [defaultAddress?.id, defaultAddress?.city, groupedBySeller.length])

  // Get shipping options for a seller — returns empty array if no rates loaded (no hardcoded fallback)
  const getShippingOptions = useCallback((sellerId: string): ShippingOption[] => {
    return shippingRatesBySeller[sellerId] || []
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
    return checkedItems.length > 0 && checkedItems.every(item => item.product.productType === 'jasa')
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
    const hasNoShippingErrors = isAllJasa || !groupedBySeller.some(g => shippingError[g.seller.id])
    return hasPayment && hasAddressOrJasa && hasShipping && hasItems && hasBalance && hasNoShippingErrors
  }, [selectedPayment, defaultAddress, shippingBySeller, groupedBySeller, checkedCount, walletBalance, totalAmount, isAllJasa, shippingError])

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
      if (item.product.productType === 'jasa') return false // unlimited stock for services
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

    // Double-submit prevention: use ref as synchronous lock
    if (isPayingRef.current) return
    isPayingRef.current = true

    setIsProcessing(true)

    // Capture item IDs to remove at the start (prevents stale closure issues)
    const itemIdsToRemove = checkedItems.map(i => i.id)

    try {
      // ==================== Create orders via API ====================
      // For wallet payment: order status = 'paid' immediately
      // For Midtrans/Card/COD: order status = 'pending' (awaiting payment)
      const isImmediatePayment = selectedPayment === 'wallet'
      const createdOrders: { id: string; totalAmount: number }[] = []

      for (let groupIdx = 0; groupIdx < groupedBySeller.length; groupIdx++) {
        const group = groupedBySeller[groupIdx]
        const sellerShipping = shippingBySeller[group.seller.id]
        const groupSubtotal = group.items.reduce((sum, i) => sum + ((i.product.discountPrice || i.product.price) * i.quantity), 0)
        const groupShipping = sellerShipping?.price || 0
        const groupDiscount = subtotal > 0 ? Math.floor(validatedVoucherDiscount * (groupSubtotal / subtotal)) : 0
        // Only charge platform fee for the first seller group — avoids N× overcharge
        const groupPlatformFee = groupIdx === 0 ? platformFee : 0
        const groupTotal = groupSubtotal + groupShipping - groupDiscount + groupPlatformFee

        const isSellerJasaOnly = isJasaOnlySeller(group.seller.id)
        const orderPayload = {
          userId: currentUser?.id || '',
          sellerId: group.seller.id,
          addressId: isSellerJasaOnly ? null : defaultAddress?.id || null,
          subtotal: groupSubtotal,
          shippingCost: isSellerJasaOnly ? 0 : groupShipping,
          discountAmount: groupDiscount,
          taxAmount: 0,
          platformFee: groupPlatformFee,
          totalAmount: groupTotal,
          paymentMethod: selectedPayment, // Send the ID (e.g., "cod", "wallet", "midtrans") — server stores this
          voucherCode: selectedVoucher?.code || undefined,
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

        // Don't optimistically set wallet orders to 'paid' — wait for wallet debit confirmation
        const orderStatus = 'pending' as const
        const orderPaymentStatus = selectedPayment === 'cod' ? 'cod' : 'unpaid'

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
              platformFee: groupPlatformFee,
              totalAmount: groupTotal,
              paymentMethod: selectedPayment, // Use the ID (e.g., "cod", "wallet", "midtrans")
              paymentStatus: orderPaymentStatus,
              escrowStatus: 'none' as const,
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
              paidAt: undefined
            }
            addOrder(localOrder)
          }
        } catch (error) {
          logger.warn({ component: 'checkout', err: error }, 'Order creation failed')
          // Stop processing — don't silently continue with partial orders
          showToast('Gagal membuat pesanan. Silakan coba lagi.', 'error')
          setIsProcessing(false)
          isPayingRef.current = false
          return
        }
      }

      // BUG 10 FIX: Cart removal moved to AFTER payment confirmation
      // Previously removed items before payment processing — if payment failed,
      // the cart was already empty and user had no way to retry.
      // Now items are removed after successful payment for each method.

      // ==================== Payment processing ====================

      if (selectedPayment === 'wallet') {
        // Wallet payment: pay each order via /api/wallet/debit
        if (selectedVoucher) markVoucherUsed(selectedVoucher.id)

        const walletResults: { orderId: string; success: boolean; error?: string }[] = []
        let allWalletSuccess = true

        for (const order of createdOrders) {
          try {
            const walletRes = await apiClient.rawPost('/api/wallet/debit', {
              orderId: order.id,
              amount: order.totalAmount,
              description: `Pembayaran pesanan via MartUp Pay`,
            })
            const walletData: WalletDebitResponse = await walletRes.json()
            if (walletData.success) {
              walletResults.push({ orderId: order.id, success: true })
            } else {
              walletResults.push({ orderId: order.id, success: false, error: walletData.error })
              allWalletSuccess = false
            }
          } catch (error) {
            walletResults.push({ orderId: order.id, success: false })
            allWalletSuccess = false
            logger.warn({ component: 'checkout', err: error }, 'Wallet payment API failed')
          }
        }

        // Calculate total debited amount from SUCCESSFUL payments only
        const successfulOrderIds = new Set(walletResults.filter(r => r.success).map(r => r.orderId))
        const totalDebited = createdOrders
          .filter(o => successfulOrderIds.has(o.id))
          .reduce((sum, o) => sum + o.totalAmount, 0)

        // Update local wallet balance — only for successfully debited orders
        if (totalDebited > 0) {
          deductWallet(Math.max(0, totalDebited), 'Pembayaran pesanan via MartUp Pay')
        }

        // Remove cart items if ANY wallet payment succeeded
        // (Orders are committed — even partial payments mean items are ordered)
        if (successfulOrderIds.size > 0) {
          itemIdsToRemove.forEach(id => removeItem(id))
        }

        setIsProcessing(false)

        if (allWalletSuccess) {
          setShowSuccessModal(true)
          setTimeout(() => {
            setShowSuccessModal(false)
            navigate('orders')
          }, 2500)
        } else {
          // Partial payment — some orders paid, some not
          const failedCount = walletResults.filter(r => !r.success).length
          if (successfulOrderIds.size > 0) {
            showToast(`${successfulOrderIds.size} pesanan berhasil dibayar. ${failedCount} pesanan gagal — bisa dibayar nanti dari halaman pesanan.`, 'warning')
          } else {
            showToast('Pembayaran wallet gagal. Pesanan tersimpan sebagai "Belum Bayar".', 'error')
          }
          navigate('orders')
        }

      } else if (selectedPayment === 'midtrans' || selectedPayment === 'card') {
        // Midtrans / Card payment: open Snap popup for each seller order
        if (selectedVoucher) markVoucherUsed(selectedVoucher.id)

        if (createdOrders.length > 0) {
          try {
            let allSuccess = true
            let anyPending = false
            let cartRemoved = false

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
                  // Remove cart items after first successful payment
                  if (!cartRemoved) {
                    itemIdsToRemove.forEach(id => removeItem(id))
                    cartRemoved = true
                  }
                } else if (snapResult.status === 'pending') {
                  anyPending = true
                  allSuccess = false
                  // Remove cart items after pending payment (order committed, user will pay later)
                  if (!cartRemoved) {
                    itemIdsToRemove.forEach(id => removeItem(id))
                    cartRemoved = true
                  }
                  // Save payment reference from Snap result so buyer can see VA number / payment code later
                  try {
                    const ref = extractPaymentReference(snapResult.result)
                    if (ref && createdOrders[i]) {
                      await apiClient.rawPost('/api/payment/save-reference', {
                        orderId: createdOrders[i].id,
                        paymentReference: JSON.stringify(ref),
                      })
                    }
                  } catch { /* non-critical — best effort */ }
                } else if (snapResult.status === 'closed') {
                  allSuccess = false
                  // User closed popup — orders are already created in DB, so remove cart items
                  // User can pay for unpaid orders from the order screen later
                  if (!cartRemoved) {
                    itemIdsToRemove.forEach(id => removeItem(id))
                    cartRemoved = true
                  }
                  showToast('Pembayaran dibatalkan. Anda bisa membayar nanti dari halaman pesanan.', 'warning')
                  break
                } else {
                  allSuccess = false
                }
              } else {
                // Snap token creation failed for this order
                logger.warn({ component: 'checkout', orderId: createdOrders[i].id, err: paymentData.error }, 'Snap token creation failed')
                // Show specific error from API (e.g., Midtrans not configured)
                showToast(paymentData.error || 'Gagal membuat token pembayaran. Pesanan tersimpan sebagai "Belum Bayar".', 'error')
                allSuccess = false
                break // Stop processing remaining orders on failure
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

      } else if (selectedPayment === 'cod') {
        // COD — order stays pending, no payment needed upfront
        if (selectedVoucher) markVoucherUsed(selectedVoucher.id)

        // Remove cart items for COD (no payment step needed)
        itemIdsToRemove.forEach(id => removeItem(id))

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
    } finally {
      isPayingRef.current = false
    }
  }

  // Empty state — only show when NOT processing (cart items removed during payment)
  if (checkedItems.length === 0 && !isProcessing) {
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
              <span className="text-sm font-semibold">Tolong Mas (Tanpa Pengiriman)</span>
            </div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1 ml-7">
              Pesanan Tolong Mas tidak memerlukan alamat pengiriman. Pembayaran akan ditahan sampai layanan selesai dan dikonfirmasi.
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
                  const itemTotal = itemPrice * item.quantity
                  const maxStock = item.variant ? item.variant.stock : item.product.stock
                  const isJasa = item.product.productType === 'jasa'
                  const colors = [
                    "bg-emerald-100 dark:bg-emerald-900/30",
                    "bg-orange-100 dark:bg-orange-900/30",
                    "bg-pink-100 dark:bg-pink-900/30",
                  ]
                  const colorIndex = item.product.id.charCodeAt(0) % colors.length

                  return (
                    <div key={item.id} className="flex gap-3 py-2.5">
                      {/* Product Image — clickable */}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setSelectedProduct(item.product.id)
                          navigate('product-detail')
                        }}
                        className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
                      >
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
                      </motion.button>

                      <div className="flex-1 min-w-0">
                        {/* Product Name — clickable */}
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedProduct(item.product.id)
                            navigate('product-detail')
                          }}
                          className="text-left w-full"
                        >
                          <h4 className="text-sm font-medium line-clamp-1 hover:text-emerald-600 transition-colors">{item.product.name}</h4>
                        </motion.button>
                        {item.variant && (
                          <p className="text-[10px] text-muted-foreground">
                            {item.variant.name}: {item.variant.value}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <div>
                            <span className="text-sm font-bold text-emerald-600">{formatPrice(itemTotal)}</span>
                            {item.quantity > 1 && (
                              <span className="text-[10px] text-muted-foreground ml-1">({formatPrice(itemPrice)}/pcs)</span>
                            )}
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center bg-muted/50 rounded-lg border border-border/50">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              onClick={() => {
                                // Read latest quantity from store to avoid stale closure on rapid clicks
                                const currentQty = useCartStore.getState().items.find(i => i.id === item.id)?.quantity ?? 1
                                if (currentQty <= 1) {
                                  removeItem(item.id)
                                  showToast("Produk dihapus dari keranjang", "info")
                                } else {
                                  updateQuantity(item.id, currentQty - 1)
                                }
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-l-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            >
                              {item.quantity <= 1 ? (
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              ) : (
                                <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </motion.button>
                            <span className="w-8 text-center text-xs font-bold text-foreground">{item.quantity}</span>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              onClick={() => {
                                // Read latest quantity from store to avoid stale closure on rapid clicks
                                const currentQty = useCartStore.getState().items.find(i => i.id === item.id)?.quantity ?? 1
                                if (!isJasa && currentQty >= maxStock) {
                                  showToast(`Stok tersedia: ${maxStock}`, "warning")
                                  return
                                }
                                updateQuantity(item.id, currentQty + 1)
                              }}
                              disabled={!isJasa && item.quantity >= maxStock}
                              className="w-7 h-7 flex items-center justify-center rounded-r-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3.5 h-3.5 text-emerald-600" />
                            </motion.button>
                          </div>
                          {isJasa && (
                            <span className="text-[10px] text-purple-500 font-medium">🤝 Stok unlimited</span>
                          )}
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
                  error={shippingError[group.seller.id]}
                  onRetry={() => {
                    const weight = weightBySeller[group.seller.id] || 1000
                    fetchShippingRates(group.seller.id, defaultAddress?.city || '', weight, group.seller.storeCity)
                  }}
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
        >
          <PaymentMethodSelector
            selectedPayment={selectedPayment}
            onSelectPayment={setSelectedPayment}
            walletBalance={walletBalance}
            totalAmount={totalAmount}
            showToast={showToast}
          />
        </motion.div>

        {/* Price Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <CheckoutSummary
            checkedCount={checkedCount}
            subtotal={subtotal}
            shippingCost={shippingCost}
            voucherDiscount={voucherDiscount}
            platformFee={platformFee}
            totalAmount={totalAmount}
            onCancel={() => {
              setSelectedPayment(null)
              navigate('cart')
            }}
          />
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
          <div className="glass border-t border-border/50 pb-safe">
            <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
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

      {/* Success Modal */}
      <OrderSuccessModal
        show={showSuccessModal}
        selectedPayment={selectedPayment}
        orderNumber={orderNumber}
        totalAmount={totalAmount}
      />
    </div>
  )
}
