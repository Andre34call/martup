---
Task ID: 1
Agent: Main Agent
Task: Fix checkout payment flow bugs - user can't see bank account info, false "Selesai Dibayar" message

Work Log:
- Investigated checkout-screen.tsx (root version used by screen-registry) and order-screen.tsx
- Found that bank_transfer (Escrow) payment was grouped with COD in handlePay, showing generic success modal instead of bank accounts
- Found "Bayar Sekarang" button in OrderDetail showed for escrow orders, falsely displaying "Pembayaran berhasil diproses!" when payForOrder returned no token
- Found bank accounts fetch in OrderDetail used useState instead of useEffect (never re-triggered)
- Found isEscrowOrder check didn't include 'bank_transfer' string
- Found empty checkout state showed during payment processing when cart items were removed

Fixes Applied:

1. checkout-screen.tsx (root):
   - Added escrowBankAccounts state, isLoadingBankAccounts, copiedAccountId
   - Added useEffect to fetch bank accounts from /api/settings/bank-accounts when bank_transfer is selected
   - Added handleCopyAccountNumber for copying bank account numbers
   - Added Escrow Bank Accounts display section in payment method area (with Landmark, Copy, CheckCircle icons)
   - Separated bank_transfer flow from COD: after creating escrow orders, navigates directly to order detail page (order-tracking) with toast message about transferring to MartUp bank account
   - Fixed empty state: only shows "Tidak Ada Item" when NOT processing (checkedItems.length === 0 && !isProcessing)

2. order-screen.tsx:
   - Fixed isEscrowOrder to also check for 'bank_transfer' in payment method string
   - Changed "Bayar Sekarang" button in OrderDetail: hidden for escrow orders (they have Upload Bukti Transfer in escrow section)
   - Fixed false success message: changed fallback from "Pembayaran berhasil diproses!" to "Gagal memproses pembayaran. Silakan coba lagi nanti."
   - Added separate cancel button section for escrow orders
   - Fixed useState → useEffect for bank accounts fetch (was never re-triggering)
   - Added bank_transfer to escrow check in OrderCard "Bayar" button handler

Stage Summary:
- Escrow bank accounts now shown during checkout when "Transfer Bank (Escrow)" is selected
- After escrow checkout, user is directed to order detail page where they can see bank accounts and upload proof
- "Bayar Sekarang" no longer shows for escrow orders in order detail (preventing false success message)
- False "Pembayaran berhasil diproses!" message replaced with proper error message
- Bank accounts fetch in order detail now properly uses useEffect instead of useState
- Empty checkout state no longer shows during payment processing
