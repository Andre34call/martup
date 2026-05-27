/**
 * MartUp Database Seed Script
 * Populates Supabase PostgreSQL with comprehensive demo data
 */

// Override system-level DATABASE_URL if it points to SQLite
// (The .env file has the correct PostgreSQL URL, but system env takes precedence)
if (process.env.DATABASE_URL?.startsWith('file:')) {
  delete process.env.DATABASE_URL
}
if (process.env.DIRECT_URL?.startsWith('file:')) {
  delete process.env.DIRECT_URL
}

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Hash passwords with bcrypt (same as the registration/login flow)
const SALT_ROUNDS = 12
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

async function main() {
  console.log('🌱 Seeding database...')

  // Clean existing data (respect foreign key order)
  console.log('🧹 Cleaning existing data...')
  const deleteOrder = [
    'VoucherUsage', 'Voucher', 'Complaint', 'Shipping', 'OrderItem', 'Order',
    'CartItem', 'Wishlist', 'Review', 'ChatMessage', 'ChatParticipant', 'ChatRoom',
    'Notification', 'WalletMutation', 'Wallet', 'Withdrawal', 'Deposit', 'Transaction',
    'Campaign', 'Banner', 'ProductVariant', 'Product', 'Category', 'Seller', 'Address', 'Referral', 'User',
  ]
  for (const table of deleteOrder) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`)
    } catch {
      // Table may not exist yet
    }
  }

  // ==================== USERS ====================
  console.log('👤 Creating users...')
  // Hash passwords with bcrypt so login (bcrypt.compare) works correctly
  const hashedPassword = await hashPassword('password123')
  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: 'u1',
        email: 'buyer@martup.com',
        phone: '081234567890',
        name: 'Ahmad Fauzi',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmad',
        role: 'buyer',
        password: hashedPassword,
        isVerified: true,
        loyaltyPoints: 1250,
        coins: 5000,
        referralCode: 'AHMAD2024',
      },
    }),
    prisma.user.create({
      data: {
        id: 'u2',
        email: 'seller@martup.com',
        phone: '082345678901',
        name: 'Budi Santoso',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Budi',
        role: 'seller',
        password: hashedPassword,
        isVerified: true,
        loyaltyPoints: 500,
        coins: 2000,
        referralCode: 'BUDI2024',
      },
    }),
    prisma.user.create({
      data: {
        id: 'u3',
        email: 'admin@martup.com',
        phone: '083456789012',
        name: 'Admin MartUp',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
        role: 'admin',
        password: hashedPassword,
        isVerified: true,
        loyaltyPoints: 0,
        coins: 0,
        referralCode: 'ADMIN2024',
      },
    }),
    prisma.user.create({
      data: {
        id: 'u4',
        email: 'seller2@martup.com',
        phone: '084567890123',
        name: 'Citra Dewi',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Citra',
        role: 'seller',
        password: hashedPassword,
        isVerified: true,
        loyaltyPoints: 300,
        coins: 1500,
        referralCode: 'CITRA2024',
      },
    }),
  ])

  // ==================== SELLERS ====================
  console.log('🏪 Creating sellers...')
  const sellers = await Promise.all([
    prisma.seller.create({
      data: {
        id: 's1',
        userId: 'u2',
        storeName: 'Gadget Pro Store',
        storeSlug: 'gadget-pro',
        storeDesc: 'Toko gadget terpercaya sejak 2020. Jual HP, laptop, aksesoris dengan garansi resmi.',
        storeAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=gadgetpro',
        storeBanner: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop',
        storeAddress: 'Jl. Mangga Dua Raya No. 88, Jakarta Utara',
        isVerified: true,
        isPremium: true,
        rating: 4.9,
        totalSales: 15000,
        totalProducts: 6,
        responseTime: 5,
        bankAccount: '1234567890',
        bankName: 'BCA',
        bankHolder: 'Budi Santoso',
        autoReply: 'Terima kasih sudah menghubungi Gadget Pro Store! 🙏 Kami akan membalas pesan Anda secepatnya.',
        commissionRate: 0.05,
      },
    }),
    prisma.seller.create({
      data: {
        id: 's2',
        userId: 'u3',
        storeName: 'Fashion Hub',
        storeSlug: 'fashion-hub',
        storeDesc: 'Fashion trend terkini dengan harga terjangkau. Kemeja, kaos, sepatu, dan lainnya.',
        storeAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=fashionhub',
        storeBanner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop',
        storeAddress: 'Jl. Tanah Abang Blok A No. 12, Jakarta Pusat',
        isVerified: true,
        isPremium: false,
        rating: 4.7,
        totalSales: 8000,
        totalProducts: 4,
        responseTime: 15,
        bankAccount: '0987654321',
        bankName: 'Mandiri',
        bankHolder: 'Admin MartUp',
        commissionRate: 0.05,
      },
    }),
    prisma.seller.create({
      data: {
        id: 's3',
        userId: 'u4',
        storeName: 'Beauty Corner',
        storeSlug: 'beauty-corner',
        storeDesc: 'Produk kecantikan original import & lokal. Skincare, makeup, body care.',
        storeAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=beautycorner',
        storeBanner: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&auto=format&fit=crop',
        storeAddress: 'Jl. Kemang Raya No. 45, Jakarta Selatan',
        isVerified: false,
        isPremium: false,
        rating: 4.5,
        totalSales: 3000,
        totalProducts: 2,
        responseTime: 30,
        bankAccount: '1122334455',
        bankName: 'BNI',
        bankHolder: 'Citra Dewi',
        commissionRate: 0.05,
      },
    }),
  ])

  // ==================== CATEGORIES ====================
  console.log('📂 Creating categories...')
  const categories = await Promise.all([
    prisma.category.create({ data: { id: 'cat1', name: 'Handphone', slug: 'handphone', icon: '📱', sortOrder: 1 } }),
    prisma.category.create({ data: { id: 'cat2', name: 'Laptop', slug: 'laptop', icon: '💻', sortOrder: 2 } }),
    prisma.category.create({ data: { id: 'cat3', name: 'Sepatu', slug: 'sepatu', icon: '👟', sortOrder: 3 } }),
    prisma.category.create({ data: { id: 'cat4', name: 'Pakaian Pria', slug: 'pakaian-pria', icon: '👔', sortOrder: 4 } }),
    prisma.category.create({ data: { id: 'cat5', name: 'Elektronik', slug: 'elektronik', icon: '🔌', sortOrder: 5 } }),
    prisma.category.create({ data: { id: 'cat6', name: 'Kecantikan', slug: 'kecantikan', icon: '💄', sortOrder: 6 } }),
    prisma.category.create({ data: { id: 'cat7', name: 'Makanan', slug: 'makanan', icon: '🍜', sortOrder: 7 } }),
    prisma.category.create({ data: { id: 'cat8', name: 'Olahraga', slug: 'olahraga', icon: '⚽', sortOrder: 8 } }),
    prisma.category.create({ data: { id: 'cat9', name: 'Mainan', slug: 'mainan', icon: '🧸', sortOrder: 9 } }),
    prisma.category.create({ data: { id: 'cat10', name: 'Otomotif', slug: 'otomotif', icon: '🚗', sortOrder: 10 } }),
    prisma.category.create({ data: { id: 'cat11', name: 'Rumah Tangga', slug: 'rumah-tangga', icon: '🏠', sortOrder: 11 } }),
    prisma.category.create({ data: { id: 'cat12', name: 'Buku', slug: 'buku', icon: '📚', sortOrder: 12 } }),
    prisma.category.create({ data: { id: 'cat13', name: 'Ibu & Bayi', slug: 'ibu-bayi', icon: '🍼', sortOrder: 13 } }),
    prisma.category.create({ data: { id: 'cat14', name: 'Kesehatan', slug: 'kesehatan', icon: '💊', sortOrder: 14 } }),
    prisma.category.create({ data: { id: 'cat15', name: 'Pakaian Wanita', slug: 'pakaian-wanita', icon: '👗', sortOrder: 15 } }),
    prisma.category.create({ data: { id: 'cat16', name: 'Aksesoris', slug: 'aksesoris', icon: '💎', sortOrder: 16 } }),
  ])

  // ==================== PRODUCTS ====================
  console.log('📦 Creating products...')
  const products = await Promise.all([
    // Gadget Pro Store products
    prisma.product.create({
      data: {
        id: 'p1', sellerId: 's1', categoryId: 'cat1',
        name: 'iPhone 15 Pro Max 256GB', slug: 'iphone-15-pro-max',
        description: 'iPhone 15 Pro Max dengan chip A17 Pro, kamera 48MP, titanium design. Garansi resmi Apple Indonesia.',
        price: 21999000, discountPrice: 19999000,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop',
        ]),
        stock: 50, sold: 1200, minOrder: 1, weight: 221, condition: 'new', status: 'active',
        rating: 4.9, reviewCount: 3520, isFeatured: true, isFlashSale: false,
        tags: JSON.stringify(['iphone', 'apple', 'smartphone']),
        variants: {
          create: [
            { id: 'pv1', name: 'Warna', value: 'Natural Titanium', stock: 20, price: 0 },
            { id: 'pv2', name: 'Warna', value: 'Blue Titanium', stock: 15, price: 0 },
            { id: 'pv3', name: 'Warna', value: 'White Titanium', stock: 15, price: 0 },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        id: 'p2', sellerId: 's1', categoryId: 'cat2',
        name: 'MacBook Air M3 13 inch', slug: 'macbook-air-m3',
        description: 'MacBook Air terbaru dengan chip M3, layar Liquid Retina 13.6 inch, 8GB RAM, 256GB SSD.',
        price: 17499000, discountPrice: 15999000,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop',
        ]),
        stock: 25, sold: 850, minOrder: 1, weight: 1280, condition: 'new', status: 'active',
        rating: 4.8, reviewCount: 2100, isFeatured: true, isFlashSale: true,
        flashSaleEnd: new Date('2027-12-31T23:59:59'),
        tags: JSON.stringify(['macbook', 'laptop', 'apple']),
      }
    }),
    prisma.product.create({
      data: {
        id: 'p3', sellerId: 's1', categoryId: 'cat5',
        name: 'AirPods Pro 2nd Gen USB-C', slug: 'airpods-pro-2',
        description: 'AirPods Pro 2nd Gen dengan USB-C charging, Active Noise Cancellation, Adaptive Audio.',
        price: 3799000, discountPrice: 2999000,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&auto=format&fit=crop',
        ]),
        stock: 100, sold: 3200, minOrder: 1, weight: 56, condition: 'new', status: 'active',
        rating: 4.7, reviewCount: 5800, isFeatured: true, isFlashSale: true,
        flashSaleEnd: new Date('2027-12-31T23:59:59'),
        tags: JSON.stringify(['airpods', 'earbuds', 'apple']),
      }
    }),
    prisma.product.create({
      data: {
        id: 'p4', sellerId: 's1', categoryId: 'cat1',
        name: 'Samsung Galaxy S24 Ultra', slug: 'samsung-galaxy-s24-ultra',
        description: 'Samsung Galaxy S24 Ultra dengan Galaxy AI, kamera 200MP, S Pen, titanium frame.',
        price: 19999000, discountPrice: 17999000,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop',
        ]),
        stock: 40, sold: 2100, minOrder: 1, weight: 232, condition: 'new', status: 'active',
        rating: 4.8, reviewCount: 4100, isFeatured: false, isFlashSale: false,
        tags: JSON.stringify(['samsung', 'galaxy', 'smartphone']),
        variants: {
          create: [
            { id: 'pv4', name: 'Warna', value: 'Titanium Black', stock: 15 },
            { id: 'pv5', name: 'Warna', value: 'Titanium Gray', stock: 15 },
            { id: 'pv6', name: 'RAM/Storage', value: '12/256GB', stock: 20, price: 0 },
            { id: 'pv7', name: 'RAM/Storage', value: '12/512GB', stock: 10, price: 2000000 },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        id: 'p5', sellerId: 's1', categoryId: 'cat5',
        name: 'Samsung Galaxy Watch 6 Classic', slug: 'galaxy-watch-6-classic',
        description: 'Smartwatch premium dengan rotating bezel, sensor BioActive, sleep coaching.',
        price: 5999000, discountPrice: 4499000,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=800&auto=format&fit=crop',
        ]),
        stock: 30, sold: 1500, minOrder: 1, weight: 52, condition: 'new', status: 'active',
        rating: 4.6, reviewCount: 2800, isFeatured: false, isFlashSale: true,
        flashSaleEnd: new Date('2027-12-31T23:59:59'),
        tags: JSON.stringify(['smartwatch', 'samsung', 'wearable']),
      }
    }),
    prisma.product.create({
      data: {
        id: 'p6', sellerId: 's1', categoryId: 'cat5',
        name: 'Charger Anker 65W GaN Prime', slug: 'anker-65w-gan',
        description: 'Charger ultra-compact 65W dengan GaN technology, 3 port (2 USB-C + 1 USB-A).',
        price: 599000, discountPrice: null,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop',
        ]),
        stock: 200, sold: 8900, minOrder: 1, weight: 200, condition: 'new', status: 'active',
        rating: 4.8, reviewCount: 12000, isFeatured: false, isFlashSale: false,
        tags: JSON.stringify(['charger', 'anker', 'elektronik']),
      }
    }),

    // Fashion Hub products
    prisma.product.create({
      data: {
        id: 'p7', sellerId: 's2', categoryId: 'cat4',
        name: 'Kemeja Flannel Premium', slug: 'kemeja-flannel-premium',
        description: 'Kemeja flannel premium bahan cotton tebal, nyaman dipakai sehari-hari. Available berbagai warna.',
        price: 189000, discountPrice: null,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1598033129183-c4f50c736c10?w=800&auto=format&fit=crop',
        ]),
        stock: 150, sold: 5200, minOrder: 1, weight: 300, condition: 'new', status: 'active',
        rating: 4.6, reviewCount: 8200, isFeatured: true, isFlashSale: false,
        tags: JSON.stringify(['kemeja', 'flannel', 'pakaian']),
        variants: {
          create: [
            { id: 'pv8', name: 'Ukuran', value: 'M', stock: 50 },
            { id: 'pv9', name: 'Ukuran', value: 'L', stock: 50 },
            { id: 'pv10', name: 'Ukuran', value: 'XL', stock: 50 },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        id: 'p8', sellerId: 's2', categoryId: 'cat3',
        name: 'Sneakers Nike Air Max 90', slug: 'nike-air-max-90',
        description: 'Nike Air Max 90 classic, desain timeless dengan Air cushioning untuk kenyamanan seharian.',
        price: 1299000, discountPrice: 999000,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=800&auto=format&fit=crop',
        ]),
        stock: 30, sold: 850, minOrder: 1, weight: 800, condition: 'new', status: 'active',
        rating: 4.7, reviewCount: 1200, isFeatured: false, isFlashSale: true,
        flashSaleEnd: new Date('2027-12-31T23:59:59'),
        tags: JSON.stringify(['nike', 'sepatu', 'sneakers']),
        variants: {
          create: [
            { id: 'pv11', name: 'Ukuran', value: '40', stock: 8 },
            { id: 'pv12', name: 'Ukuran', value: '41', stock: 8 },
            { id: 'pv13', name: 'Ukuran', value: '42', stock: 8 },
            { id: 'pv14', name: 'Ukuran', value: '43', stock: 6 },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        id: 'p9', sellerId: 's2', categoryId: 'cat4',
        name: 'Kaos Oversize Cotton Combed 30s', slug: 'kaos-oversize-cotton',
        description: 'Kaos oversize premium cotton combed 30s, nyaman dan adem. Unisex fit untuk pria & wanita.',
        price: 89000, discountPrice: 69000,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop',
        ]),
        stock: 500, sold: 15000, minOrder: 1, weight: 200, condition: 'new', status: 'active',
        rating: 4.5, reviewCount: 25000, isFeatured: false, isFlashSale: true,
        flashSaleEnd: new Date('2027-12-31T23:59:59'),
        tags: JSON.stringify(['kaos', 'oversize', 'cotton']),
        variants: {
          create: [
            { id: 'pv15', name: 'Ukuran', value: 'M', stock: 100 },
            { id: 'pv16', name: 'Ukuran', value: 'L', stock: 100 },
            { id: 'pv17', name: 'Ukuran', value: 'XL', stock: 100 },
            { id: 'pv18', name: 'Ukuran', value: 'XXL', stock: 100 },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        id: 'p10', sellerId: 's2', categoryId: 'cat3',
        name: 'Sepatu Running Adidas Ultraboost', slug: 'adidas-ultraboost',
        description: 'Adidas Ultraboost Light, running shoes dengan BOOST midside untuk responsivitas maksimal.',
        price: 2800000, discountPrice: 2199000,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&auto=format&fit=crop',
        ]),
        stock: 20, sold: 450, minOrder: 1, weight: 700, condition: 'new', status: 'active',
        rating: 4.8, reviewCount: 680, isFeatured: true, isFlashSale: false,
        tags: JSON.stringify(['adidas', 'running', 'sepatu']),
        variants: {
          create: [
            { id: 'pv19', name: 'Ukuran', value: '42', stock: 5 },
            { id: 'pv20', name: 'Ukuran', value: '43', stock: 5 },
            { id: 'pv21', name: 'Ukuran', value: '44', stock: 5 },
          ]
        }
      }
    }),

    // Beauty Corner products
    prisma.product.create({
      data: {
        id: 'p11', sellerId: 's3', categoryId: 'cat6',
        name: 'Lipstik Matte Velvet Rose', slug: 'lipstik-matte-velvet',
        description: 'Lipstik matte velvet formula tahan lama, pigmented, tidak kering. Shade Rose untuk sehari-hari.',
        price: 75000, discountPrice: null,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&auto=format&fit=crop',
        ]),
        stock: 300, sold: 12000, minOrder: 1, weight: 30, condition: 'new', status: 'active',
        rating: 4.6, reviewCount: 18500, isFeatured: false, isFlashSale: false,
        tags: JSON.stringify(['lipstik', 'makeup', 'kecantikan']),
        variants: {
          create: [
            { id: 'pv22', name: 'Shade', value: 'Rose Pink', stock: 100 },
            { id: 'pv23', name: 'Shade', value: 'Coral', stock: 100 },
            { id: 'pv24', name: 'Shade', value: 'Mauve', stock: 100 },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        id: 'p12', sellerId: 's3', categoryId: 'cat6',
        name: 'Skincare Set Glowing Package', slug: 'skincare-set-glowing',
        description: 'Paket skincare lengkap untuk kulit glowing: Cleanser, Toner, Serum, Moisturizer, Sunscreen.',
        price: 350000, discountPrice: 245000,
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1570194065650-d99fb4cb867c?w=800&auto=format&fit=crop',
        ]),
        stock: 300, sold: 5600, minOrder: 1, weight: 500, condition: 'new', status: 'active',
        rating: 4.7, reviewCount: 4100, isFeatured: true, isFlashSale: true,
        flashSaleEnd: new Date('2027-12-31T23:59:59'),
        tags: JSON.stringify(['skincare', 'kecantikan', 'glowing', 'set']),
        variants: {
          create: [
            { id: 'pv25', name: 'Tipe Kulit', value: 'Normal', stock: 100 },
            { id: 'pv26', name: 'Tipe Kulit', value: 'Oily', stock: 100 },
            { id: 'pv27', name: 'Tipe Kulit', value: 'Dry', stock: 100 },
          ]
        }
      }
    }),
  ])

  // ==================== ADDRESSES ====================
  console.log('📍 Creating addresses...')
  await Promise.all([
    prisma.address.create({
      data: { id: 'a1', userId: 'u1', label: 'Rumah', recipient: 'Ahmad Fauzi', phone: '081234567890', address: 'Jl. Merdeka No. 10, Kel. Menteng', city: 'Jakarta Selatan', province: 'DKI Jakarta', postalCode: '10310', isDefault: true },
    }),
    prisma.address.create({
      data: { id: 'a2', userId: 'u1', label: 'Kantor', recipient: 'Ahmad Fauzi', phone: '081234567890', address: 'Jl. Sudirman Kav. 52-53, Senayan', city: 'Jakarta Pusat', province: 'DKI Jakarta', postalCode: '12190', isDefault: false },
    }),
    prisma.address.create({
      data: { id: 'a3', userId: 'u2', label: 'Toko', recipient: 'Budi Santoso', phone: '082345678901', address: 'Jl. Mangga Dua Raya No. 88', city: 'Jakarta Utara', province: 'DKI Jakarta', postalCode: '14230', isDefault: true },
    }),
  ])

  // ==================== WALLETS ====================
  console.log('💰 Creating wallets...')
  const wallets = await Promise.all([
    prisma.wallet.create({
      data: { id: 'w1', userId: 'u1', balance: 1500000, holdBalance: 200000 },
    }),
    prisma.wallet.create({
      data: { id: 'w2', userId: 'u2', sellerId: 's1', balance: 5500000, holdBalance: 500000 },
    }),
    prisma.wallet.create({
      data: { id: 'w3', userId: 'u3', sellerId: 's2', balance: 3200000, holdBalance: 300000 },
    }),
  ])

  // Wallet mutations
  await Promise.all([
    prisma.walletMutation.create({ data: { id: 'wm1', walletId: 'w1', type: 'credit', amount: 500000, balance: 1500000, description: 'Top up via GoPay', refType: 'deposit' } }),
    prisma.walletMutation.create({ data: { id: 'wm2', walletId: 'w1', type: 'debit', amount: 200000, balance: 1000000, description: 'Pembayaran Order #ORD-2024-002', refType: 'order' } }),
    prisma.walletMutation.create({ data: { id: 'wm3', walletId: 'w1', type: 'credit', amount: 10000, balance: 1200000, description: 'Cashback pembelian', refType: 'cashback' } }),
    prisma.walletMutation.create({ data: { id: 'wm4', walletId: 'w1', type: 'debit', amount: 50000, balance: 1190000, description: 'Pembayaran Order #ORD-2024-003', refType: 'order' } }),
  ])

  // ==================== ORDERS ====================
  console.log('📋 Creating orders...')
  await Promise.all([
    prisma.order.create({
      data: {
        id: 'o1', orderNumber: 'ORD-2024-001', userId: 'u1', sellerId: 's1', addressId: 'a1',
        status: 'shipped', subtotal: 450000, shippingCost: 15000, discountAmount: 20000,
        taxAmount: 0, platformFee: 1000, totalAmount: 446000, paymentMethod: 'Midtrans',
        paymentStatus: 'paid', paidAt: new Date('2024-12-18T10:05:00'), shippedAt: new Date('2024-12-19T08:00:00'),
        items: {
          create: [{ id: 'oi1', productId: 'p1', productName: 'iPhone 15 Pro Max 256GB', price: 450000, quantity: 1, subtotal: 450000 }],
        },
        shipping: { create: { id: 'sh1', provider: 'JNE', service: 'REG', trackingNumber: 'JNE1234567890', estimatedDays: '2-3', status: 'in_transit', shippedAt: new Date('2024-12-19T08:00:00') } },
      }
    }),
    prisma.order.create({
      data: {
        id: 'o2', orderNumber: 'ORD-2024-002', userId: 'u1', sellerId: 's2', addressId: 'a1',
        status: 'delivered', subtotal: 189000, shippingCost: 10000, discountAmount: 0,
        taxAmount: 0, platformFee: 1000, totalAmount: 200000, paymentMethod: 'Wallet',
        paymentStatus: 'paid', paidAt: new Date('2024-12-15T14:05:00'),
        shippedAt: new Date('2024-12-16T09:00:00'), deliveredAt: new Date('2024-12-17T11:00:00'),
        items: {
          create: [{ id: 'oi2', productId: 'p7', productName: 'Kemeja Flannel Premium', price: 189000, quantity: 1, subtotal: 189000 }],
        },
        shipping: { create: { id: 'sh2', provider: 'SiCepat', service: 'REG', trackingNumber: 'SI1234567890', estimatedDays: '1-2', status: 'delivered', shippedAt: new Date('2024-12-16T09:00:00'), deliveredAt: new Date('2024-12-17T11:00:00') } },
      }
    }),
    prisma.order.create({
      data: {
        id: 'o3', orderNumber: 'ORD-2024-003', userId: 'u1', sellerId: 's3', addressId: 'a1',
        status: 'pending', subtotal: 75000, shippingCost: 9000, discountAmount: 5000,
        taxAmount: 0, platformFee: 1000, totalAmount: 80000, paymentMethod: 'COD',
        paymentStatus: 'unpaid',
        items: {
          create: [{ id: 'oi3', productId: 'p11', productName: 'Lipstik Matte Velvet Rose', price: 75000, quantity: 1, subtotal: 75000 }],
        },
        shipping: { create: { id: 'sh3', provider: 'J&T', service: 'EZ', estimatedDays: '2-4', status: 'pending' } },
      }
    }),
  ])

  // ==================== CART ITEMS ====================
  console.log('🛒 Creating cart items...')
  await prisma.cartItem.create({
    data: { id: 'c1', userId: 'u1', productId: 'p1', quantity: 1, isChecked: true },
  })

  // ==================== NOTIFICATIONS ====================
  console.log('🔔 Creating notifications...')
  await Promise.all([
    prisma.notification.create({ data: { id: 'n1', userId: 'u1', title: 'Pesanan Dikirim', content: 'Pesanan #ORD-2024-001 telah dikirim via JNE REG', type: 'order', isRead: false } }),
    prisma.notification.create({ data: { id: 'n2', userId: 'u1', title: 'Flash Sale Dimulai!', content: 'Diskon hingga 70% untuk produk pilihan', type: 'promo', isRead: false } }),
    prisma.notification.create({ data: { id: 'n3', userId: 'u1', title: 'Pembayaran Berhasil', content: 'Pembayaran sebesar Rp 250.000 berhasil', type: 'order', isRead: true } }),
    prisma.notification.create({ data: { id: 'n4', userId: 'u1', title: 'Pesan Baru', content: 'Toko Gadget Pro mengirim pesan', type: 'chat', isRead: false } }),
    prisma.notification.create({ data: { id: 'n5', userId: 'u1', title: 'Voucher Baru', content: 'Kamu mendapat voucher gratis ongkir!', type: 'promo', isRead: true } }),
  ])

  // ==================== CHAT ROOMS ====================
  console.log('💬 Creating chat rooms...')
  await Promise.all([
    prisma.chatRoom.create({
      data: {
        id: 'cr1', productId: 'p1',
        participants: {
          create: [
            { id: 'cp1', userId: 'u1', lastRead: new Date('2024-12-20T10:30:00') },
            { id: 'cp2', userId: 'u2', lastRead: new Date('2024-12-20T10:25:00') },
          ]
        },
        messages: {
          create: [
            { id: 'cm1', senderId: 'u1', content: 'Halo kak, ini iPhone 15 Pro Max masih ready?', type: 'text' },
            { id: 'cm2', senderId: 'u2', content: 'Masih ready kak! Warna Natural Titanium dan Blue Titanium tersedia 🙏', type: 'text' },
            { id: 'cm3', senderId: 'u1', content: 'Boleh nego ga kak? Atau ada voucher diskon?', type: 'text' },
            { id: 'cm4', senderId: 'u2', content: 'Untuk sekarang harga sudah best ya kak. Tapi bisa pakai voucher HEMAT20 untuk diskon tambahan!', type: 'text' },
          ]
        }
      }
    }),
    prisma.chatRoom.create({
      data: {
        id: 'cr2', productId: 'p8',
        participants: {
          create: [
            { id: 'cp3', userId: 'u1', lastRead: new Date('2024-12-20T09:15:00') },
            { id: 'cp4', userId: 'u3', lastRead: new Date('2024-12-20T09:15:00') },
          ]
        },
        messages: {
          create: [
            { id: 'cm5', senderId: 'u1', content: 'Size 42 available?', type: 'text' },
            { id: 'cm6', senderId: 'u3', content: 'Barang ready kak, silakan order', type: 'text' },
          ]
        }
      }
    }),
    prisma.chatRoom.create({
      data: {
        id: 'cr3', productId: 'p12',
        participants: {
          create: [
            { id: 'cp5', userId: 'u1', lastRead: new Date('2024-12-19T16:00:00') },
            { id: 'cp6', userId: 'u4', lastRead: new Date('2024-12-19T15:55:00') },
          ]
        },
        messages: {
          create: [
            { id: 'cm7', senderId: 'u1', content: 'Skincare set ini cocok untuk kulit sensitif?', type: 'text' },
            { id: 'cm8', senderId: 'u4', content: 'Bisa restock minggu depan ya kak', type: 'text', isRead: false },
          ]
        }
      }
    }),
  ])

  // ==================== VOUCHERS ====================
  console.log('🎫 Creating vouchers...')
  await Promise.all([
    prisma.voucher.create({
      data: { id: 'v1', code: 'HEMAT20', name: 'Diskon 20%', description: 'Diskon 20% maks Rp 50.000', type: 'percentage', value: 20, minPurchase: 100000, maxDiscount: 50000, usageLimit: 1000, usageCount: 250, perUserLimit: 3, validFrom: new Date('2024-01-01'), validUntil: new Date('2027-12-31T23:59:59'), isActive: true },
    }),
    prisma.voucher.create({
      data: { id: 'v2', code: 'GRATISONGKIR', name: 'Free Ongkir', description: 'Gratis ongkir maks Rp 25.000', type: 'fixed', value: 25000, minPurchase: 50000, usageLimit: 5000, usageCount: 1200, perUserLimit: 5, validFrom: new Date('2024-01-01'), validUntil: new Date('2027-12-31T23:59:59'), isActive: true },
    }),
    prisma.voucher.create({
      data: { id: 'v3', code: 'NEWUSER50', name: 'Diskon Rp 50.000', description: 'Diskon Rp 50.000 untuk user baru', type: 'fixed', value: 50000, minPurchase: 200000, sellerId: 's1', usageLimit: 10000, usageCount: 3500, perUserLimit: 1, validFrom: new Date('2024-01-01'), validUntil: new Date('2027-12-31T23:59:59'), isActive: true },
    }),
  ])

  // ==================== WISHLIST ====================
  console.log('❤️ Creating wishlists...')
  await Promise.all([
    prisma.wishlist.create({ data: { userId: 'u1', productId: 'p7' } }),
    prisma.wishlist.create({ data: { userId: 'u1', productId: 'p8' } }),
    prisma.wishlist.create({ data: { userId: 'u1', productId: 'p11' } }),
  ])

  // ==================== BANNERS ====================
  console.log('🖼️ Creating banners...')
  await Promise.all([
    prisma.banner.create({ data: { id: 'b1', title: 'Mega Sale 🔥', image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1200&auto=format&fit=crop', link: '/search?tag=flash-sale', position: 'home_top', sortOrder: 1, isActive: true } }),
    prisma.banner.create({ data: { id: 'b2', title: 'Gratis Ongkir 🚚', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&auto=format&fit=crop', link: '/voucher', position: 'home_top', sortOrder: 2, isActive: true } }),
  ])

  // ==================== REVIEWS ====================
  console.log('⭐ Creating reviews...')
  await Promise.all([
    prisma.review.create({ data: { id: 'r1', userId: 'u1', productId: 'p3', rating: 5, content: 'Suara sangat jernih, ANC mantap! Worth every penny 🔥', images: null } }),
    prisma.review.create({ data: { id: 'r2', userId: 'u1', productId: 'p7', rating: 4, content: 'Bahan tebal dan nyaman, cuma size chart agak besar sedikit', images: null } }),
  ])

  console.log('\n✅ Seed completed successfully!')
  console.log(`  👤 ${users.length} users`)
  console.log(`  🏪 ${sellers.length} sellers`)
  console.log(`  📂 ${categories.length} categories`)
  console.log(`  📦 ${products.length} products`)
  console.log(`  💰 ${wallets.length} wallets`)
  console.log(`  🎫 3 vouchers`)
  console.log(`  💬 3 chat rooms`)
  console.log(`  🔔 5 notifications`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
