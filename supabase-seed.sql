-- MartUp Demo Data Seed for Supabase
-- Run this AFTER supabase-init.sql in Supabase SQL Editor

-- ==================== DEMO USERS ====================

INSERT INTO "User" ("id", "email", "phone", "name", "avatar", "role", "password", "isVerified", "isActive", "loyaltyPoints", "coins", "referralCode", "createdAt", "updatedAt") VALUES
('u1', 'buyer@martup.com', '08123456789', 'Ahmad Fauzi', NULL, 'buyer', 'password123', true, true, 500, 12500, 'AHMAD2024', NOW(), NOW()),
('u2', 'seller@martup.com', '08234567890', 'Budi Santoso', NULL, 'seller', 'password123', true, true, 0, 0, 'BUDI2024', NOW(), NOW()),
('u3', 'seller2@martup.com', '08345678901', 'Siti Aminah', NULL, 'seller', 'password123', true, true, 0, 0, 'SITI2024', NOW(), NOW()),
('u4', 'seller3@martup.com', '08456789012', 'Rudi Hartono', NULL, 'seller', 'password123', true, true, 0, 0, 'RUDI2024', NOW(), NOW()),
('u5', 'admin@martup.com', '08567890123', 'Admin MartUp', NULL, 'admin', 'admin123', true, true, 0, 0, NULL, NOW(), NOW());

-- ==================== DEMO SELLERS ====================

INSERT INTO "Seller" ("id", "userId", "storeName", "storeSlug", "storeDesc", "storeAvatar", "storeBanner", "storeAddress", "isVerified", "isPremium", "rating", "totalSales", "totalProducts", "responseTime", "bankAccount", "bankName", "bankHolder", "commissionRate", "createdAt", "updatedAt") VALUES
('s1', 'u2', 'Gadget Pro Store', 'gadget-pro', 'Toko gadget terpercaya sejak 2018. Menyediakan smartphone, laptop, dan aksesoris dengan garansi resmi.', NULL, NULL, 'Jakarta Selatan', true, true, 4.9, 15000, 8, 15, '1234567890', 'BCA', 'Budi Santoso', 0.05, NOW(), NOW()),
('s2', 'u3', 'Fashion Hub', 'fashion-hub', 'Pusat fashion terkini dengan koleksi terbaru setiap minggu. Kualitas premium harga terjangkau.', NULL, NULL, 'Bandung', true, false, 4.7, 8000, 6, 30, '0987654321', 'Mandiri', 'Siti Aminah', 0.05, NOW(), NOW()),
('s3', 'u4', 'Beauty Corner', 'beauty-corner', 'Skincare dan makeup original 100%. Distributor resmi brand lokal dan internasional.', NULL, NULL, 'Surabaya', false, false, 4.5, 3000, 5, 45, '1122334455', 'BNI', 'Rudi Hartono', 0.05, NOW(), NOW());

-- ==================== DEMO WALLETS ====================

INSERT INTO "Wallet" ("id", "userId", "sellerId", "balance", "holdBalance", "createdAt", "updatedAt") VALUES
('w1', 'u1', NULL, 1500000, 200000, NOW(), NOW()),
('w2', 'u2', 's1', 5500000, 1500000, NOW(), NOW()),
('w3', 'u3', 's2', 3200000, 800000, NOW(), NOW()),
('w4', 'u4', 's3', 1500000, 500000, NOW(), NOW());

-- ==================== DEMO CATEGORIES ====================

INSERT INTO "Category" ("id", "name", "slug", "icon", "parentId", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
('cat1', 'Handphone & Tablet', 'handphone-tablet', '📱', NULL, 1, true, NOW(), NOW()),
('cat2', 'Komputer & Laptop', 'komputer-laptop', '💻', NULL, 2, true, NOW(), NOW()),
('cat3', 'Fashion Pria', 'fashion-pria', '👔', NULL, 3, true, NOW(), NOW()),
('cat4', 'Fashion Wanita', 'fashion-wanita', '👗', NULL, 4, true, NOW(), NOW()),
('cat5', 'Kecantikan', 'kecantikan', '💄', NULL, 5, true, NOW(), NOW()),
('cat6', 'Kesehatan', 'kesehatan', '💊', NULL, 6, true, NOW(), NOW()),
('cat7', 'Makanan & Minuman', 'makanan-minuman', '🍜', NULL, 7, true, NOW(), NOW()),
('cat8', 'Elektronik Rumah', 'elektronik-rumah', '🏠', NULL, 8, true, NOW(), NOW()),
('cat9', 'Olahraga', 'olahraga', '⚽', NULL, 9, true, NOW(), NOW()),
('cat10', 'Otomotif', 'otomotif', '🚗', NULL, 10, true, NOW(), NOW());

-- ==================== DEMO PRODUCTS ====================

INSERT INTO "Product" ("id", "sellerId", "categoryId", "name", "slug", "description", "price", "discountPrice", "images", "stock", "sold", "minOrder", "weight", "condition", "status", "rating", "reviewCount", "isFeatured", "isFlashSale", "flashSaleEnd", "tags", "createdAt", "updatedAt") VALUES
-- Gadget Pro Store products
('p1', 's1', 'cat1', 'iPhone 15 Pro Max 256GB', 'iphone-15-pro-max-256gb', 'iPhone 15 Pro Max dengan chip A17 Pro, kamera 48MP, desain titanium. Garansi resmi Apple Indonesia.', 21999000, NULL, '["https://placehold.co/400x400/e2e8f0/475569?text=iPhone+15+Pro", "https://placehold.co/400x400/e2e8f0/475569?text=iPhone+Back"]', 50, 1200, 1, 221, 'new', 'active', 4.9, 3520, true, false, NULL, '["iphone", "apple", "smartphone"]', NOW(), NOW()),
('p2', 's1', 'cat1', 'Samsung Galaxy S24 Ultra', 'samsung-galaxy-s24-ultra', 'Samsung Galaxy S24 Ultra dengan S Pen, kamera 200MP, Galaxy AI. Garansi resmi Samsung Indonesia.', 22499000, 19999000, '["https://placehold.co/400x400/dbeafe/1e40af?text=Galaxy+S24", "https://placehold.co/400x400/dbeafe/1e40af?text=Galaxy+S24+Back"]', 35, 890, 1, 232, 'new', 'active', 4.8, 2100, true, true, '2025-03-31T23:59:59Z', '["samsung", "galaxy", "smartphone"]', NOW(), NOW()),
('p3', 's1', 'cat2', 'MacBook Air M3 13 inci', 'macbook-air-m3-13', 'MacBook Air M3 chip, 8GB RAM, 256GB SSD, Liquid Retina Display. Garansi resmi Apple.', 17499000, NULL, '["https://placehold.co/400x400/fce7f3/9d174d?text=MacBook+Air"]', 20, 450, 1, 1280, 'new', 'active', 4.9, 980, true, false, NULL, '["macbook", "apple", "laptop"]', NOW(), NOW()),
('p4', 's1', 'cat1', 'AirPods Pro 2nd Gen USB-C', 'airpods-pro-2-usb-c', 'AirPods Pro 2nd generation dengan USB-C charging, Active Noise Cancellation, Adaptive Audio.', 3799000, 3299000, '["https://placehold.co/400x400/f3e8ff/6b21a8?text=AirPods+Pro"]', 100, 3500, 1, 50, 'new', 'active', 4.7, 5200, false, true, '2025-02-28T23:59:59Z', '["airpods", "apple", "audio"]', NOW(), NOW()),

-- Fashion Hub products
('p5', 's2', 'cat3', 'Sneakers Nike Air Max 90', 'sneakers-nike-air-max-90', 'Nike Air Max 90 classic - desain ikonik yang tidak pernah ketinggalan zaman. Original 100%.', 1299000, 999000, '["https://placehold.co/400x400/dcfce7/166534?text=Nike+AM90"]', 30, 850, 1, 800, 'new', 'active', 4.7, 1200, false, true, '2025-01-31T23:59:59Z', '["nike", "sneakers", "sepatu"]', NOW(), NOW()),
('p6', 's2', 'cat3', 'Kemeja Flannel Premium', 'kemeja-flannel-premium', 'Kemeja flannel premium bahan katun tebal, nyaman dipakai sehari-hari. Tersedia berbagai warna.', 189000, NULL, '["https://placehold.co/400x400/ffedd5/9a3412?text=Flannel"]', 100, 2300, 1, 300, 'new', 'active', 4.6, 890, false, false, NULL, '["kemeja", "flannel", "fashion"]', NOW(), NOW()),
('p7', 's2', 'cat4', 'Dress Floral Elegant', 'dress-floral-elegant', 'Dress floral bahan chiffon lembut, cocok untuk acara formal maupun casual. Motif eksklusif.', 259000, 199000, '["https://placehold.co/400x400/fce7f3/9d174d?text=Dress"]', 45, 670, 1, 250, 'new', 'active', 4.8, 780, true, false, NULL, '["dress", "wanita", "fashion"]', NOW(), NOW()),
('p8', 's2', 'cat3', 'Celana Chino Slim Fit', 'celana-chino-slim-fit', 'Celana chino slim fit bahan stretch nyaman, cocok untuk kerja dan hangout.', 159000, NULL, '["https://placehold.co/400x400/fff7ed/9a3412?text=Chino"]', 80, 1900, 1, 350, 'new', 'active', 4.5, 650, false, false, NULL, '["celana", "chino", "fashion"]', NOW(), NOW()),

-- Beauty Corner products
('p9', 's3', 'cat5', 'Lipstik Matte Velvet', 'lipstik-matte-velvet', 'Lipstik matte velvet formula tahan lama hingga 12 jam. Pigmentasi tinggi, nyaman di bibir.', 75000, 55000, '["https://placehold.co/400x400/fecdd3/9f1239?text=Lipstik"]', 200, 4500, 1, 30, 'new', 'active', 4.6, 3200, false, true, '2025-01-31T23:59:59Z', '["lipstik", "makeup", "kecantikan"]', NOW(), NOW()),
('p10', 's3', 'cat5', 'Serum Vitamin C 20%', 'serum-vitamin-c-20', 'Serum Vitamin C 20% dengan Hyaluronic Acid. Mencerahkan kulit, menghilangkan noda hitam.', 125000, NULL, '["https://placehold.co/400x400/fef9c3/854d0e?text=Serum+VitC"]', 150, 2800, 1, 50, 'new', 'active', 4.7, 1500, true, false, NULL, '["serum", "skincare", "vitamin-c"]', NOW(), NOW()),
('p11', 's3', 'cat5', 'Sunscreen SPF 50+ PA++++', 'sunscreen-spf50', 'Sunscreen ringan formula water-based, SPF 50+ PA++++. Tidak greasy, cocok untuk kulit berminyak.', 89000, 69000, '["https://placehold.co/400x400/feffd5/854d0e?text=Sunscreen"]', 180, 5200, 1, 80, 'new', 'active', 4.8, 4100, true, true, '2025-02-28T23:59:59Z', '["sunscreen", "skincare", "spf"]', NOW(), NOW()),
('p12', 's3', 'cat6', 'Masker Wajah Green Tea', 'masker-wajah-green-tea', 'Masker wajah dengan ekstrak green tea dan tea tree oil. Menenangkan kulit, mengontrol minyak.', 45000, NULL, '["https://placehold.co/400x400/dcfce7/166534?text=Masker"]', 300, 6800, 1, 100, 'new', 'active', 4.4, 2200, false, false, NULL, '["masker", "skincare", "green-tea"]', NOW(), NOW());

-- ==================== DEMO PRODUCT VARIANTS ====================

INSERT INTO "ProductVariant" ("id", "productId", "name", "value", "sku", "price", "stock", "image") VALUES
-- iPhone 15 Pro Max colors
('pv1', 'p1', 'Warna', 'Natural Titanium', 'IP15PM-NT-256', NULL, 15, NULL),
('pv2', 'p1', 'Warna', 'Blue Titanium', 'IP15PM-BT-256', NULL, 12, NULL),
('pv3', 'p1', 'Warna', 'White Titanium', 'IP15PM-WT-256', NULL, 13, NULL),
('pv4', 'p1', 'Warna', 'Black Titanium', 'IP15PM-BKT-256', NULL, 10, NULL),
-- Samsung S24 Ultra storage
('pv5', 'p2', 'Storage', '256GB', 'SS24U-256', NULL, 15, NULL),
('pv6', 'p2', 'Storage', '512GB', 'SS24U-512', 24999000, 12, NULL),
-- Nike Air Max 90 sizes
('pv7', 'p5', 'Ukuran', '39', 'NAM90-39', NULL, 5, NULL),
('pv8', 'p5', 'Ukuran', '40', 'NAM90-40', NULL, 5, NULL),
('pv9', 'p5', 'Ukuran', '41', 'NAM90-41', NULL, 5, NULL),
('pv10', 'p5', 'Ukuran', '42', 'NAM90-42', NULL, 5, NULL),
('pv11', 'p5', 'Ukuran', '43', 'NAM90-43', NULL, 5, NULL),
('pv12', 'p5', 'Ukuran', '44', 'NAM90-44', NULL, 5, NULL),
-- Lipstik colors
('pv13', 'p9', 'Shade', 'Ruby Red', 'LMV-RR', NULL, 50, NULL),
('pv14', 'p9', 'Shade', 'Nude Pink', 'LMV-NP', NULL, 50, NULL),
('pv15', 'p9', 'Shade', 'Coral Sunset', 'LMV-CS', NULL, 50, NULL),
('pv16', 'p9', 'Shade', 'Mauve Dream', 'LMV-MD', NULL, 50, NULL);

-- ==================== DEMO ADDRESSES ====================

INSERT INTO "Address" ("id", "userId", "label", "recipient", "phone", "address", "city", "province", "postalCode", "isDefault", "createdAt", "updatedAt") VALUES
('a1', 'u1', 'Rumah', 'Ahmad Fauzi', '08123456789', 'Jl. Merdeka No. 10, Kel. Menteng', 'Jakarta Selatan', 'DKI Jakarta', '10310', true, NOW(), NOW()),
('a2', 'u1', 'Kantor', 'Ahmad Fauzi', '08123456789', 'Jl. Sudirman Kav. 52-53, Senayan', 'Jakarta Pusat', 'DKI Jakarta', '12190', false, NOW(), NOW());

-- ==================== DEMO ORDERS ====================

INSERT INTO "Order" ("id", "orderNumber", "userId", "sellerId", "addressId", "status", "subtotal", "shippingCost", "discountAmount", "taxAmount", "platformFee", "totalAmount", "paymentMethod", "paymentStatus", "paidAt", "shippedAt", "deliveredAt", "cancelledAt", "cancelReason", "note", "createdAt", "updatedAt") VALUES
('o1', 'ORD-2024-001', 'u1', 's1', 'a1', 'shipped', 450000, 15000, 0, 0, 1000, 466000, 'Midtrans', 'paid', '2024-12-18T10:05:00Z', '2024-12-19T08:00:00Z', NULL, NULL, NULL, NULL, '2024-12-18T10:00:00Z', NOW()),
('o2', 'ORD-2024-002', 'u1', 's2', 'a1', 'delivered', 189000, 10000, 0, 0, 1000, 200000, 'wallet', 'paid', '2024-12-15T14:05:00Z', '2024-12-16T09:00:00Z', '2024-12-17T11:00:00Z', NULL, NULL, NULL, '2024-12-15T14:00:00Z', NOW()),
('o3', 'ORD-2024-003', 'u1', 's3', 'a1', 'pending', 75000, 9000, 5000, 0, 1000, 80000, 'COD', 'unpaid', NULL, NULL, NULL, NULL, NULL, NULL, '2024-12-20T08:00:00Z', NOW());

-- ==================== DEMO ORDER ITEMS ====================

INSERT INTO "OrderItem" ("id", "orderId", "productId", "variantId", "productName", "variantName", "price", "quantity", "subtotal", "image") VALUES
('oi1', 'o1', 'p1', 'pv1', 'iPhone 15 Pro Max 256GB', 'Warna: Natural Titanium', 450000, 1, 450000, 'https://placehold.co/400x400/e2e8f0/475569?text=iPhone+15+Pro'),
('oi2', 'o2', 'p6', NULL, 'Kemeja Flannel Premium', NULL, 189000, 1, 189000, 'https://placehold.co/400x400/ffedd5/9a3412?text=Flannel'),
('oi3', 'o3', 'p9', 'pv13', 'Lipstik Matte Velvet', 'Shade: Ruby Red', 75000, 1, 75000, 'https://placehold.co/400x400/fecdd3/9f1239?text=Lipstik');

-- ==================== DEMO SHIPPING ====================

INSERT INTO "Shipping" ("id", "orderId", "provider", "service", "trackingNumber", "estimatedDays", "status", "shippedAt", "deliveredAt") VALUES
('sh1', 'o1', 'JNE', 'REG', 'JNE1234567890', '2-3', 'in_transit', '2024-12-19T08:00:00Z', NULL),
('sh2', 'o2', 'SiCepat', 'REG', 'SI1234567890', '1-2', 'delivered', '2024-12-16T09:00:00Z', '2024-12-17T11:00:00Z'),
('sh3', 'o3', 'J&T', 'EZ', NULL, '2-4', 'pending', NULL, NULL);

-- ==================== DEMO REVIEWS ====================

INSERT INTO "Review" ("id", "userId", "productId", "orderItemId", "rating", "content", "images", "createdAt") VALUES
('r1', 'u1', 'p6', 'oi2', 5, 'Kemeja bagus banget, bahannya tebal dan nyaman. Size sesuai. Pasti order lagi!', NULL, '2024-12-18T15:00:00Z'),
('r2', 'u1', 'p1', 'oi1', 4, 'iPhone sesuai deskripsi. Pengiriman cepat. Cuma packaging bisa lebih baik lagi.', NULL, '2024-12-20T12:00:00Z');

-- ==================== DEMO VOUCHERS ====================

INSERT INTO "Voucher" ("id", "code", "name", "description", "type", "value", "minPurchase", "maxDiscount", "usageLimit", "usageCount", "perUserLimit", "sellerId", "validFrom", "validUntil", "isActive", "createdAt") VALUES
('v1', 'HEMAT20', 'Diskon 20%', 'Diskon 20% maks Rp 50.000', 'percentage', 20, 100000, 50000, 1000, 45, 1, NULL, '2024-01-01T00:00:00Z', '2025-06-30T23:59:59Z', true, NOW()),
('v2', 'GRATISONGKIR', 'Free Ongkir', 'Gratis ongkir maks Rp 25.000', 'fixed', 25000, 50000, NULL, 2000, 120, 1, NULL, '2024-01-01T00:00:00Z', '2025-08-31T23:59:59Z', true, NOW()),
('v3', 'NEWUSER50', 'Diskon Rp 50.000', 'Diskon Rp 50.000 untuk user baru', 'fixed', 50000, 200000, NULL, 500, 89, 1, 's1', '2024-01-01T00:00:00Z', '2025-12-31T23:59:59Z', true, NOW()),
('v4', 'FLASH10', 'Flash Sale 10%', 'Diskon 10% untuk Flash Sale', 'percentage', 10, 0, 30000, 5000, 230, 1, NULL, '2024-01-01T00:00:00Z', '2025-03-31T23:59:59Z', true, NOW());

-- ==================== DEMO NOTIFICATIONS ====================

INSERT INTO "Notification" ("id", "userId", "title", "content", "type", "isRead", "refType", "refId", "createdAt") VALUES
('n1', 'u1', 'Pesanan Dikirim', 'Pesanan #ORD-2024-001 telah dikirim via JNE REG', 'order', false, 'order', 'o1', '2024-12-20T10:00:00Z'),
('n2', 'u1', 'Flash Sale Dimulai!', 'Diskon hingga 70% untuk produk pilihan', 'promo', false, NULL, NULL, '2024-12-20T09:00:00Z'),
('n3', 'u1', 'Pembayaran Berhasil', 'Pembayaran sebesar Rp 250.000 berhasil', 'order', true, 'order', 'o2', '2024-12-19T15:00:00Z'),
('n4', 'u1', 'Pesan Baru', 'Toko Gadget Pro mengirim pesan', 'chat', false, NULL, NULL, '2024-12-19T12:00:00Z'),
('n5', 'u1', 'Voucher Baru', 'Kamu mendapat voucher gratis ongkir!', 'promo', true, NULL, NULL, '2024-12-18T08:00:00Z');

-- ==================== DEMO CHAT ROOMS ====================

INSERT INTO "ChatRoom" ("id", "productId", "createdAt", "updatedAt") VALUES
('cr1', 'p1', '2024-12-18T09:00:00Z', '2024-12-20T10:30:00Z'),
('cr2', 'p5', '2024-12-19T14:00:00Z', '2024-12-20T09:15:00Z'),
('cr3', 'p9', '2024-12-19T16:00:00Z', '2024-12-19T16:00:00Z');

-- ==================== DEMO CHAT PARTICIPANTS ====================

INSERT INTO "ChatParticipant" ("id", "roomId", "userId", "lastRead") VALUES
('cp1', 'cr1', 'u1', '2024-12-20T10:30:00Z'),
('cp2', 'cr1', 'u2', '2024-12-20T10:30:00Z'),
('cp3', 'cr2', 'u1', '2024-12-20T09:15:00Z'),
('cp4', 'cr2', 'u3', '2024-12-20T09:15:00Z'),
('cp5', 'cr3', 'u1', '2024-12-19T16:00:00Z'),
('cp6', 'cr3', 'u4', '2024-12-19T16:00:00Z');

-- ==================== DEMO CHAT MESSAGES ====================

INSERT INTO "ChatMessage" ("id", "roomId", "senderId", "content", "type", "isRead", "createdAt") VALUES
('cm1', 'cr1', 'u1', 'Halo kak, iPhone 15 Pro Max masih ready?', 'text', true, '2024-12-18T09:00:00Z'),
('cm2', 'cr1', 'u2', 'Ready kak! Warna Natural Titanium tersedia 🎉', 'text', true, '2024-12-18T09:01:00Z'),
('cm3', 'cr1', 'u1', 'Berapa lama pengiriman ke Jakarta Selatan?', 'text', true, '2024-12-18T09:02:00Z'),
('cm4', 'cr1', 'u2', 'Estimasi 2-3 hari kak, pakai JNE REG', 'text', true, '2024-12-18T09:03:00Z'),
('cm5', 'cr1', 'u2', 'Terima kasih sudah order kak! 🙏', 'text', false, '2024-12-20T10:30:00Z'),
('cm6', 'cr2', 'u1', 'Kak, size 42 ada?', 'text', true, '2024-12-19T14:00:00Z'),
('cm7', 'cr2', 'u3', 'Barang ready kak, silakan order', 'text', true, '2024-12-19T14:05:00Z'),
('cm8', 'cr3', 'u1', 'Shade Ruby Red ready?', 'text', true, '2024-12-19T16:00:00Z'),
('cm9', 'cr3', 'u4', 'Bisa restock minggu depan ya kak', 'text', false, '2024-12-19T16:05:00Z');

-- ==================== DEMO WALLET MUTATIONS ====================

INSERT INTO "WalletMutation" ("id", "walletId", "type", "amount", "balance", "description", "refType", "refId", "createdAt") VALUES
('wm1', 'w1', 'credit', 500000, 1500000, 'Top up via GoPay', 'deposit', NULL, '2024-12-20T10:00:00Z'),
('wm2', 'w1', 'debit', 200000, 1000000, 'Pembayaran Order #ORD-2024-002', 'order', 'o2', '2024-12-15T14:05:00Z'),
('wm3', 'w1', 'credit', 10000, 1200000, 'Cashback pembelian', 'cashback', NULL, '2024-12-17T11:00:00Z'),
('wm4', 'w1', 'debit', 50000, 1190000, 'Pembayaran Order #ORD-2024-003', 'order', 'o3', '2024-12-20T08:00:00Z');

-- ==================== DEMO CART ITEMS ====================

INSERT INTO "CartItem" ("id", "userId", "productId", "variantId", "quantity", "isChecked", "createdAt", "updatedAt") VALUES
('ci1', 'u1', 'p1', 'pv1', 1, true, NOW(), NOW()),
('ci2', 'u1', 'p5', 'pv10', 2, true, NOW(), NOW());

-- ==================== DEMO WISHLIST ====================

INSERT INTO "Wishlist" ("id", "userId", "productId", "createdAt") VALUES
('wl1', 'u1', 'p3', NOW()),
('wl2', 'u1', 'p5', NOW()),
('wl3', 'u1', 'p8', NOW());

-- ==================== DEMO BANNERS ====================

INSERT INTO "Banner" ("id", "title", "image", "link", "position", "sortOrder", "isActive", "createdAt") VALUES
('b1', 'Flash Sale 12.12', 'https://placehold.co/800x300/ef4444/ffffff?text=FLASH+SALE+70%25+OFF', '/search?isFlashSale=true', 'home_top', 1, true, NOW()),
('b2', 'Gratis Ongkir', 'https://placehold.co/800x300/22c55e/ffffff?text=GRATIS+ONGKIR', '/voucher', 'home_mid', 2, true, NOW()),
('b3', 'Voucher Baru', 'https://placehold.co/800x300/f59e0b/ffffff?text=VOUCHER+DISKON+50RB', '/voucher', 'home_mid', 3, true, NOW());

-- ==================== DEMO WITHDRAWALS ====================

INSERT INTO "Withdrawal" ("id", "sellerId", "amount", "bankAccount", "bankName", "bankHolder", "status", "createdAt", "updatedAt") VALUES
('wd1', 's1', 2000000, '1234567890', 'BCA', 'Budi Santoso', 'processed', NOW(), NOW()),
('wd2', 's2', 1000000, '0987654321', 'Mandiri', 'Siti Aminah', 'pending', NOW(), NOW());
