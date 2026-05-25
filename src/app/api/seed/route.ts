import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

// Seed endpoint - creates demo sellers with products and categories
// SECURITY: Requires admin authentication
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication
    const authResult = await verifyAdmin(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Legacy secret check removed - admin auth is now required

    // 1. Create demo seller users
    const sellerUsers = []
    const sellerData = [
      { email: 'gadgetpro@martup.demo', name: 'Gadget Pro Store', storeName: 'Gadget Pro Store', storeSlug: 'gadget-pro', storeDesc: 'Toko gadget terpercaya sejak 2020. Jual HP, laptop, dan aksesoris terbaru.', isVerified: true, isPremium: true, rating: 4.9, totalSales: 15000, totalProducts: 6 },
      { email: 'fashionhub@martup.demo', name: 'Fashion Hub', storeName: 'Fashion Hub', storeSlug: 'fashion-hub', storeDesc: 'Fashion terkini untuk pria dan wanita. Kualitas premium, harga terjangkau.', isVerified: true, isPremium: false, rating: 4.7, totalSales: 8000, totalProducts: 2 },
      { email: 'beautycorner@martup.demo', name: 'Beauty Corner', storeName: 'Beauty Corner', storeSlug: 'beauty-corner', storeDesc: 'Kecantikan alami dan modern. Skincare, makeup, dan perawatan kulit.', isVerified: false, isPremium: false, rating: 4.5, totalSales: 3000, totalProducts: 2 },
      { email: 'homeliving@martup.demo', name: 'Home Living ID', storeName: 'Home Living ID', storeSlug: 'home-living', storeDesc: 'Peralatan rumah tangga dan dekorasi. Buat rumahmu makin nyaman!', isVerified: true, isPremium: true, rating: 4.8, totalSales: 12000, totalProducts: 2 },
      { email: 'sportzone@martup.demo', name: 'Sport Zone', storeName: 'Sport Zone', storeSlug: 'sport-zone', storeDesc: 'Peralatan olahraga dan fitness. Stay active, stay healthy!', isVerified: true, isPremium: false, rating: 4.6, totalSales: 6000, totalProducts: 2 },
    ]

    for (const sd of sellerData) {
      // Check if user already exists
      const existingUser = await db.user.findUnique({ where: { email: sd.email } })
      if (existingUser) {
        // Check if seller already exists for this user
        const existingSeller = await db.seller.findUnique({ where: { userId: existingUser.id } })
        if (existingSeller) {
          sellerUsers.push({ userId: existingUser.id, sellerId: existingSeller.id, storeName: sd.storeName })
          continue
        }
        // User exists but no seller - create seller separately
        const seller = await db.seller.create({
          data: {
            userId: existingUser.id,
            storeName: sd.storeName,
            storeSlug: sd.storeSlug,
            storeDesc: sd.storeDesc,
            isVerified: sd.isVerified,
            isPremium: sd.isPremium,
            rating: sd.rating,
            totalSales: sd.totalSales,
            totalProducts: sd.totalProducts,
            bankAccount: '1234567890',
            bankName: 'BCA',
            bankHolder: sd.name,
            commissionRate: 0.05,
          },
        })
        // Create wallet for seller
        await db.wallet.upsert({
          where: { sellerId: seller.id },
          update: {},
          create: { sellerId: seller.id, balance: sd.totalSales * 5000, holdBalance: 1500000 },
        })
        // Update user role
        await db.user.update({ where: { id: existingUser.id }, data: { role: 'seller', isVerified: sd.isVerified } })
        sellerUsers.push({ userId: existingUser.id, sellerId: seller.id, storeName: sd.storeName })
        continue
      }

      // Check if storeSlug is already taken by another seller
      const existingSlug = await db.seller.findUnique({ where: { storeSlug: sd.storeSlug } })
      if (existingSlug) {
        sellerUsers.push({ userId: existingSlug.userId, sellerId: existingSlug.id, storeName: sd.storeName })
        continue
      }

      // Create new user with seller
      const user = await db.user.create({
        data: {
          email: sd.email,
          name: sd.name,
          role: 'seller',
          isVerified: sd.isVerified,
          wallet: { create: { balance: sd.totalSales * 5000, holdBalance: 1500000 } },
          seller: {
            create: {
              storeName: sd.storeName,
              storeSlug: sd.storeSlug,
              storeDesc: sd.storeDesc,
              isVerified: sd.isVerified,
              isPremium: sd.isPremium,
              rating: sd.rating,
              totalSales: sd.totalSales,
              totalProducts: sd.totalProducts,
              bankAccount: '1234567890',
              bankName: 'BCA',
              bankHolder: sd.name,
              commissionRate: 0.05,
            },
          },
        },
        include: { seller: true },
      })
      sellerUsers.push({ userId: user.id, sellerId: user.seller!.id, storeName: sd.storeName })
    }

    // 2. Create categories
    const categoriesData = [
      { name: 'Handphone', slug: 'handphone', icon: '📱' },
      { name: 'Laptop', slug: 'laptop', icon: '💻' },
      { name: 'Sepatu', slug: 'sepatu', icon: '👟' },
      { name: 'Fashion Pria', slug: 'fashion-pria', icon: '👔' },
      { name: 'Fashion Wanita', slug: 'fashion-wanita', icon: '👗' },
      { name: 'Kecantikan', slug: 'kecantikan', icon: '💄' },
      { name: 'Makanan', slug: 'makanan', icon: '🍕' },
      { name: 'Elektronik', slug: 'elektronik', icon: '🔌' },
      { name: 'Olahraga', slug: 'olahraga', icon: '⚽' },
      { name: 'Rumah Tangga', slug: 'rumah-tangga', icon: '🏠' },
      { name: 'Ibu & Bayi', slug: 'ibu-bayi', icon: '👶' },
      { name: 'Otomotif', slug: 'otomotif', icon: '🚗' },
      { name: 'Buku', slug: 'buku', icon: '📚' },
      { name: 'Gaming', slug: 'gaming', icon: '🎮' },
      { name: 'Kesehatan', slug: 'kesehatan', icon: '💊' },
      { name: 'Hobi', slug: 'hobi', icon: '🎨' },
    ]

    const categoryMap: Record<string, string> = {}
    for (const cat of categoriesData) {
      const existing = await db.category.findUnique({ where: { slug: cat.slug } })
      if (existing) {
        categoryMap[cat.slug] = existing.id
        continue
      }
      const created = await db.category.create({ data: cat })
      categoryMap[cat.slug] = created.id
    }

    // 3. Create products for demo sellers
    const sellerMap: Record<string, string> = {}
    sellerUsers.forEach(s => { sellerMap[s.storeName] = s.sellerId })

    const productsData = [
      {
        name: 'iPhone 15 Pro Max 256GB', slug: 'iphone-15-pro-max', description: 'iPhone 15 Pro Max dengan chip A17 Pro, kamera 48MP, dan desain titanium. Performa terbaik untuk pengguna premium.',
        price: 21999000, stock: 50, sold: 1200, weight: 221, condition: 'new', status: 'active',
        rating: 4.9, reviewCount: 3520, isFeatured: true, isFlashSale: false,
        images: JSON.stringify(['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop']),
        tags: JSON.stringify(['iphone', 'apple', 'smartphone', 'premium']),
        sellerName: 'Gadget Pro Store', categorySlug: 'handphone',
        variants: [
          { name: 'Warna', value: 'Natural Titanium', stock: 20 },
          { name: 'Warna', value: 'Blue Titanium', stock: 15 },
          { name: 'Warna', value: 'White Titanium', stock: 10 },
          { name: 'Warna', value: 'Black Titanium', stock: 5 },
        ],
      },
      {
        name: 'Samsung Galaxy S24 Ultra', slug: 'samsung-galaxy-s24-ultra', description: 'Samsung Galaxy S24 Ultra dengan Galaxy AI, S Pen, dan kamera 200MP. Smartphone paling canggih dari Samsung.',
        price: 19999000, discountPrice: 17999000, stock: 35, sold: 890, weight: 232, condition: 'new', status: 'active',
        rating: 4.8, reviewCount: 2150, isFeatured: true, isFlashSale: true, flashSaleEnd: new Date('2025-12-31T23:59:59Z'),
        images: JSON.stringify(['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=800&auto=format&fit=crop']),
        tags: JSON.stringify(['samsung', 'galaxy', 'android', 'premium']),
        sellerName: 'Gadget Pro Store', categorySlug: 'handphone',
        variants: [
          { name: 'Warna', value: 'Titanium Gray', stock: 15 },
          { name: 'Warna', value: 'Titanium Violet', stock: 10 },
        ],
      },
      {
        name: 'MacBook Pro M3 14 inch', slug: 'macbook-pro-m3', description: 'MacBook Pro dengan chip M3, layar Liquid Retina XDR, dan performa luar biasa untuk profesional.',
        price: 27999000, discountPrice: 25999000, stock: 20, sold: 450, weight: 1550, condition: 'new', status: 'active',
        rating: 4.9, reviewCount: 780, isFeatured: true, isFlashSale: false,
        images: JSON.stringify(['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&auto=format&fit=crop']),
        tags: JSON.stringify(['macbook', 'apple', 'laptop', 'premium']),
        sellerName: 'Gadget Pro Store', categorySlug: 'laptop',
        variants: [
          { name: 'Storage', value: '512GB', price: 0, stock: 12 },
          { name: 'Storage', value: '1TB', price: 4000000, stock: 8 },
        ],
      },
      {
        name: 'PS5 Slim Digital Edition', slug: 'ps5-slim-digital', description: 'PlayStation 5 Slim Digital Edition - Konsol gaming next-gen dengan SSD super cepat dan DualSense controller.',
        price: 6499000, discountPrice: 5799000, stock: 25, sold: 380, weight: 3200, condition: 'new', status: 'active',
        rating: 4.9, reviewCount: 890, isFeatured: true, isFlashSale: true, flashSaleEnd: new Date('2025-12-31T23:59:59Z'),
        images: JSON.stringify(['https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=800&auto=format&fit=crop']),
        sellerName: 'Gadget Pro Store', categorySlug: 'gaming',
        variants: [],
      },
      {
        name: 'AirPods Pro 2nd Gen', slug: 'airpods-pro-2', description: 'AirPods Pro 2nd Gen dengan Active Noise Cancellation, Adaptive Transparency, dan Personalized Spatial Audio.',
        price: 3799000, discountPrice: 3299000, stock: 100, sold: 2100, weight: 56, condition: 'new', status: 'active',
        rating: 4.8, reviewCount: 1560, isFeatured: false, isFlashSale: false,
        images: JSON.stringify(['https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&auto=format&fit=crop']),
        tags: JSON.stringify(['airpods', 'apple', 'earbuds']),
        sellerName: 'Gadget Pro Store', categorySlug: 'elektronik',
        variants: [],
      },
      {
        name: 'iPad Air M2', slug: 'ipad-air-m2', description: 'iPad Air M2 dengan chip M2, layar 11-inch Liquid Retina, dan Apple Pencil support.',
        price: 10999000, discountPrice: 9999000, stock: 30, sold: 620, weight: 462, condition: 'new', status: 'active',
        rating: 4.7, reviewCount: 890, isFeatured: true, isFlashSale: false,
        images: JSON.stringify(['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&auto=format&fit=crop']),
        sellerName: 'Gadget Pro Store', categorySlug: 'elektronik',
        variants: [],
      },
      {
        name: 'Kemeja Flannel Premium Cotton', slug: 'kemeja-flannel-premium', description: 'Kemeja flannel premium dengan bahan cotton 100% nyaman dipakai sehari-hari. Available dalam berbagai warna.',
        price: 189000, discountPrice: 149000, stock: 200, sold: 3500, weight: 250, condition: 'new', status: 'active',
        rating: 4.6, reviewCount: 890, isFeatured: false, isFlashSale: false,
        images: JSON.stringify(['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop']),
        sellerName: 'Fashion Hub', categorySlug: 'fashion-pria',
        variants: [
          { name: 'Ukuran', value: 'M', stock: 50 },
          { name: 'Ukuran', value: 'L', stock: 60 },
          { name: 'Ukuran', value: 'XL', stock: 40 },
        ],
      },
      {
        name: 'Gaun Midi Elegant - Party Wear', slug: 'gaun-midi-elegant', description: 'Gaun midi elegan untuk pesta dan acara formal. Bahan premium dengan detail payet yang mewah.',
        price: 459000, discountPrice: 359000, stock: 80, sold: 1200, weight: 300, condition: 'new', status: 'active',
        rating: 4.7, reviewCount: 650, isFeatured: true, isFlashSale: false,
        images: JSON.stringify(['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop']),
        sellerName: 'Fashion Hub', categorySlug: 'fashion-wanita',
        variants: [
          { name: 'Ukuran', value: 'S', stock: 20 },
          { name: 'Ukuran', value: 'M', stock: 30 },
          { name: 'Ukuran', value: 'L', stock: 15 },
        ],
      },
      {
        name: 'Lipstik Matte Velvet Long Lasting', slug: 'lipstik-matte-velvet', description: 'Lipstik matte velvet formula terbaru, tahan lama hingga 12 jam. Warna pigmented dan nyaman di bibir.',
        price: 75000, discountPrice: 55000, stock: 500, sold: 8900, weight: 30, condition: 'new', status: 'active',
        rating: 4.5, reviewCount: 3200, isFeatured: false, isFlashSale: true, flashSaleEnd: new Date('2025-12-31T23:59:59Z'),
        images: JSON.stringify(['https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?w=800&auto=format&fit=crop']),
        sellerName: 'Beauty Corner', categorySlug: 'kecantikan',
        variants: [
          { name: 'Warna', value: 'Ruby Red', stock: 120 },
          { name: 'Warna', value: 'Nude Pink', stock: 150 },
          { name: 'Warna', value: 'Mauve', stock: 100 },
        ],
      },
      {
        name: 'Skincare Set Glowing Package', slug: 'skincare-set-glowing', description: 'Paket skincare lengkap untuk kulit glowing: Cleanser, Toner, Serum, Moisturizer, Sunscreen.',
        price: 350000, discountPrice: 245000, stock: 300, sold: 5600, weight: 500, condition: 'new', status: 'active',
        rating: 4.7, reviewCount: 4100, isFeatured: true, isFlashSale: true, flashSaleEnd: new Date('2025-12-31T23:59:59Z'),
        images: JSON.stringify(['https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1570194065650-d99fb4cb867c?w=800&auto=format&fit=crop']),
        sellerName: 'Beauty Corner', categorySlug: 'kecantikan',
        variants: [
          { name: 'Tipe Kulit', value: 'Normal', stock: 100 },
          { name: 'Tipe Kulit', value: 'Oily', stock: 100 },
          { name: 'Tipe Kulit', value: 'Dry', stock: 100 },
        ],
      },
      {
        name: 'Diffuser Aromatherapy Minimalis', slug: 'diffuser-aromatherapy', description: 'Diffuser aromatherapy dengan desain minimalis modern. Kapasitas 300ml dengan LED 7 warna.',
        price: 189000, discountPrice: 149000, stock: 120, sold: 2300, weight: 450, condition: 'new', status: 'active',
        rating: 4.6, reviewCount: 1560, isFeatured: true, isFlashSale: false,
        images: JSON.stringify(['https://images.unsplash.com/photo-1602928321679-560bb453f190?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&auto=format&fit=crop']),
        sellerName: 'Home Living ID', categorySlug: 'rumah-tangga',
        variants: [],
      },
      {
        name: 'Smart LED TV 43 inch 4K UHD', slug: 'smart-led-tv-43', description: 'Smart LED TV 43 inch 4K UHD dengan Android TV built-in. Dolby Audio dan HDMI x3.',
        price: 3299000, discountPrice: 2899000, stock: 40, sold: 620, weight: 6500, condition: 'new', status: 'active',
        rating: 4.6, reviewCount: 450, isFeatured: true, isFlashSale: false,
        images: JSON.stringify(['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1461151304267-38535e780c79?w=800&auto=format&fit=crop']),
        sellerName: 'Home Living ID', categorySlug: 'elektronik',
        variants: [],
      },
      {
        name: 'Sneakers Nike Air Max 90', slug: 'nike-air-max-90', description: 'Nike Air Max 90 - Classic sneaker dengan teknologi Air Max untuk kenyamanan maksimal.',
        price: 1299000, discountPrice: 999000, stock: 30, sold: 850, weight: 800, condition: 'new', status: 'active',
        rating: 4.7, reviewCount: 1200, isFeatured: true, isFlashSale: true, flashSaleEnd: new Date('2025-12-31T23:59:59Z'),
        images: JSON.stringify(['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=800&auto=format&fit=crop']),
        sellerName: 'Sport Zone', categorySlug: 'sepatu',
        variants: [
          { name: 'Ukuran', value: '40', stock: 8 },
          { name: 'Ukuran', value: '41', stock: 10 },
          { name: 'Ukuran', value: '42', stock: 7 },
          { name: 'Ukuran', value: '43', stock: 5 },
        ],
      },
      {
        name: 'Yoga Mat Premium Anti Slip', slug: 'yoga-mat-premium', description: 'Yoga mat premium 8mm anti slip dengan bahan TPE eco-friendly. Nyaman dan aman untuk olahraga.',
        price: 250000, discountPrice: 189000, stock: 200, sold: 1800, weight: 1200, condition: 'new', status: 'active',
        rating: 4.8, reviewCount: 920, isFeatured: false, isFlashSale: false,
        images: JSON.stringify(['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop']),
        sellerName: 'Sport Zone', categorySlug: 'olahraga',
        variants: [
          { name: 'Warna', value: 'Purple', stock: 60 },
          { name: 'Warna', value: 'Blue', stock: 80 },
          { name: 'Warna', value: 'Pink', stock: 60 },
        ],
      },
    ]

    let productsCreated = 0
    let productsSkipped = 0
    for (const pd of productsData) {
      const existing = await db.product.findUnique({ where: { slug: pd.slug } })
      if (existing) {
        productsSkipped++
        continue
      }

      const sellerId = sellerMap[pd.sellerName]
      if (!sellerId) continue

      const categoryId = categoryMap[pd.categorySlug]
      if (!categoryId) continue

      const { sellerName, categorySlug, variants, ...productData } = pd

      const product = await db.product.create({
        data: {
          ...productData,
          sellerId,
          categoryId,
          flashSaleEnd: pd.flashSaleEnd || null,
          minOrder: 1,
          variants: {
            create: variants,
          },
        },
      })
      productsCreated++
    }

    // 4. Create vouchers
    const vouchersData = [
      { code: 'HEMAT20', name: 'Diskon 20%', description: 'Diskon 20% maks Rp 50.000', type: 'percentage', value: 20, minPurchase: 100000, maxDiscount: 50000, validFrom: new Date(), validUntil: new Date('2025-12-31'), isActive: true },
      { code: 'GRATISONGKIR', name: 'Free Ongkir', description: 'Gratis ongkir maks Rp 25.000', type: 'fixed', value: 25000, minPurchase: 50000, validFrom: new Date(), validUntil: new Date('2025-12-31'), isActive: true },
      { code: 'NEWUSER50', name: 'Diskon Rp 50.000', description: 'Diskon Rp 50.000 untuk user baru', type: 'fixed', value: 50000, minPurchase: 200000, validFrom: new Date(), validUntil: new Date('2025-12-31'), sellerId: sellerMap['Gadget Pro Store'], isActive: true },
      { code: 'FLASH10', name: 'Flash Sale 10%', description: 'Diskon 10% untuk Flash Sale', type: 'percentage', value: 10, minPurchase: 0, maxDiscount: 30000, validFrom: new Date(), validUntil: new Date('2025-12-31'), isActive: true },
    ]

    let vouchersCreated = 0
    for (const vd of vouchersData) {
      const existing = await db.voucher.findUnique({ where: { code: vd.code } })
      if (existing) continue
      await db.voucher.create({ data: vd })
      vouchersCreated++
    }

    return NextResponse.json({
      success: true,
      message: 'Seed completed',
      stats: {
        sellers: sellerUsers.length,
        categories: Object.keys(categoryMap).length,
        productsCreated,
        productsSkipped,
        vouchersCreated,
      },
    })
  } catch (error: any) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
