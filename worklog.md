---
Task ID: 1-9
Agent: Main
Task: Check app for errors and synchronization issues across Admin, Buyer, and Seller roles

Work Log:
- Analyzed all major component files and the store for cross-role synchronization issues
- Identified 8 critical sync issues where mock/hardcoded data was used instead of real store data
- Fixed store.ts: Added payForOrder, deductWallet functions; updateOrderStatus now syncs seller balance
- Fixed checkout-screen.tsx: Wallet balance deducted when paying with MartUp Pay
- Fixed order-screen.tsx: "Bayar" button now actually processes payment via payForOrder
- Fixed seller-screens.tsx: Dashboard & Orders use real store orders and sellerBalance instead of MOCK_SELLER_STATS
- Fixed admin-screens.tsx: Dashboard uses real withdrawRequests count from store
- Fixed admin-orders-screen.tsx: Uses real store orders instead of mockAdminOrders
- Cleaned up unused mockSellerOrders constant
- All lint checks pass

Stage Summary:
- Key sync fixes: Buyer payment → Seller balance credit (pending), Order delivery → Balance moves to available, Admin withdraw approval → Seller balance updates
- All three roles (Buyer, Seller, Admin) now share synchronized data through the Zustand store
- Withdraw flow is fully integrated: Seller requests WD → balance moves to hold → Admin approves/rejects → balance updates accordingly
