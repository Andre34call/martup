import type { Product, Category, ShippingOption, SellerStats, AdminStats } from './types'

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat1', name: 'Handphone', slug: 'handphone', icon: '📱', productCount: 15230 },
  { id: 'cat2', name: 'Laptop', slug: 'laptop', icon: '💻', productCount: 8450 },
  { id: 'cat3', name: 'Sepatu', slug: 'sepatu', icon: '👟', productCount: 23100 },
  { id: 'cat4', name: 'Fashion Pria', slug: 'fashion-pria', icon: '👔', productCount: 45000 },
  { id: 'cat5', name: 'Fashion Wanita', slug: 'fashion-wanita', icon: '👗', productCount: 67000 },
  { id: 'cat6', name: 'Kecantikan', slug: 'kecantikan', icon: '💄', productCount: 35000 },
  { id: 'cat7', name: 'Makanan', slug: 'makanan', icon: '🍕', productCount: 28500 },
  { id: 'cat8', name: 'Elektronik', slug: 'elektronik', icon: '🔌', productCount: 19200 },
  { id: 'cat9', name: 'Olahraga', slug: 'olahraga', icon: '⚽', productCount: 12300 },
  { id: 'cat10', name: 'Rumah Tangga', slug: 'rumah-tangga', icon: '🏠', productCount: 31400 },
  { id: 'cat11', name: 'Ibu & Bayi', slug: 'ibu-bayi', icon: '👶', productCount: 21800 },
  { id: 'cat12', name: 'Otomotif', slug: 'otomotif', icon: '🚗', productCount: 9700 },
  { id: 'cat13', name: 'Buku', slug: 'buku', icon: '📚', productCount: 42000 },
  { id: 'cat14', name: 'Gaming', slug: 'gaming', icon: '🎮', productCount: 15600 },
  { id: 'cat15', name: 'Kesehatan', slug: 'kesehatan', icon: '💊', productCount: 18200 },
  { id: 'cat16', name: 'Hobi', slug: 'hobi', icon: '🎨', productCount: 8900 },
]

const defaultSeller1 = { id: 's1', userId: 'u2', storeName: 'Gadget Pro Store', storeSlug: 'gadget-pro', storeAvatar: '', isVerified: true, isPremium: true, rating: 4.9, totalSales: 15000, totalProducts: 250 }
const defaultSeller2 = { id: 's2', userId: 'u3', storeName: 'Fashion Hub', storeSlug: 'fashion-hub', storeAvatar: '', isVerified: true, isPremium: false, rating: 4.7, totalSales: 8000, totalProducts: 120 }
const defaultSeller3 = { id: 's3', userId: 'u4', storeName: 'Beauty Corner', storeSlug: 'beauty-corner', storeAvatar: '', isVerified: false, isPremium: false, rating: 4.5, totalSales: 3000, totalProducts: 80 }
const defaultSeller4 = { id: 's4', userId: 'u5', storeName: 'Home Living ID', storeSlug: 'home-living', storeAvatar: '', isVerified: true, isPremium: true, rating: 4.8, totalSales: 12000, totalProducts: 180 }
const defaultSeller5 = { id: 's5', userId: 'u6', storeName: 'Sport Zone', storeSlug: 'sport-zone', storeAvatar: '', isVerified: true, isPremium: false, rating: 4.6, totalSales: 6000, totalProducts: 95 }

export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1', sellerId: 's1', categoryId: 'cat1', name: 'iPhone 15 Pro Max 256GB', slug: 'iphone-15-pro-max',
    description: 'iPhone 15 Pro Max dengan chip A17 Pro, kamera 48MP, dan desain titanium. Performa terbaik untuk pengguna premium.',
    price: 21999000, stock: 50, sold: 1200, minOrder: 1, weight: 221, condition: 'new', status: 'active',
    rating: 4.9, reviewCount: 3520, isFeatured: true, isFlashSale: false,
    images: [
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800&auto=format&fit=crop',
    ],
    variants: [
      { id: 'pv1', productId: '1', name: 'Warna', value: 'Natural Titanium', stock: 20 },
      { id: 'pv2', productId: '1', name: 'Warna', value: 'Blue Titanium', stock: 15 },
      { id: 'pv3', productId: '1', name: 'Warna', value: 'White Titanium', stock: 10 },
      { id: 'pv4', productId: '1', name: 'Warna', value: 'Black Titanium', stock: 5 },
    ],
    seller: defaultSeller1, category: { id: 'cat1', name: 'Handphone', slug: 'handphone' },
    tags: ['iphone', 'apple', 'smartphone', 'premium']
  },
  {
    id: '2', sellerId: 's1', categoryId: 'cat1', name: 'Samsung Galaxy S24 Ultra', slug: 'samsung-galaxy-s24-ultra',
    description: 'Samsung Galaxy S24 Ultra dengan Galaxy AI, S Pen, dan kamera 200MP. Smartphone paling canggih dari Samsung.',
    price: 19999000, discountPrice: 17999000, stock: 35, sold: 890, minOrder: 1, weight: 232, condition: 'new', status: 'active',
    rating: 4.8, reviewCount: 2150, isFeatured: true, isFlashSale: true, flashSaleEnd: '2024-12-25T23:59:59Z',
    images: [
      'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=800&auto=format&fit=crop',
    ],
    variants: [
      { id: 'pv5', productId: '2', name: 'Warna', value: 'Titanium Gray', stock: 15 },
      { id: 'pv6', productId: '2', name: 'Warna', value: 'Titanium Violet', stock: 10 },
    ],
    seller: defaultSeller1, category: { id: 'cat1', name: 'Handphone', slug: 'handphone' },
    tags: ['samsung', 'galaxy', 'android', 'premium']
  },
  {
    id: '3', sellerId: 's2', categoryId: 'cat4', name: 'Kemeja Flannel Premium Cotton', slug: 'kemeja-flannel-premium',
    description: 'Kemeja flannel premium dengan bahan cotton 100% nyaman dipakai sehari-hari. Available dalam berbagai warna.',
    price: 189000, discountPrice: 149000, stock: 200, sold: 3500, minOrder: 1, weight: 250, condition: 'new', status: 'active',
    rating: 4.6, reviewCount: 890, isFeatured: false, isFlashSale: false,
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop',
    ],
    variants: [
      { id: 'pv7', productId: '3', name: 'Ukuran', value: 'M', stock: 50 },
      { id: 'pv8', productId: '3', name: 'Ukuran', value: 'L', stock: 60 },
      { id: 'pv9', productId: '3', name: 'Ukuran', value: 'XL', stock: 40 },
    ],
    seller: defaultSeller2, category: { id: 'cat4', name: 'Fashion Pria', slug: 'fashion-pria' },
  },
  {
    id: '4', sellerId: 's2', categoryId: 'cat5', name: 'Gaun Midi Elegant - Party Wear', slug: 'gaun-midi-elegant',
    description: 'Gaun midi elegan untuk pesta dan acara formal. Bahan premium dengan detail payet yang mewah.',
    price: 459000, discountPrice: 359000, stock: 80, sold: 1200, minOrder: 1, weight: 300, condition: 'new', status: 'active',
    rating: 4.7, reviewCount: 650, isFeatured: true, isFlashSale: false,
    images: [
      'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop',
    ],
    variants: [
      { id: 'pv10', productId: '4', name: 'Ukuran', value: 'S', stock: 20 },
      { id: 'pv11', productId: '4', name: 'Ukuran', value: 'M', stock: 30 },
      { id: 'pv12', productId: '4', name: 'Ukuran', value: 'L', stock: 15 },
    ],
    seller: defaultSeller2, category: { id: 'cat5', name: 'Fashion Wanita', slug: 'fashion-wanita' },
  },
  {
    id: '5', sellerId: 's5', categoryId: 'cat3', name: 'Sneakers Nike Air Max 90', slug: 'nike-air-max-90',
    description: 'Nike Air Max 90 - Classic sneaker dengan teknologi Air Max untuk kenyamanan maksimal.',
    price: 1299000, discountPrice: 999000, stock: 30, sold: 850, minOrder: 1, weight: 800, condition: 'new', status: 'active',
    rating: 4.7, reviewCount: 1200, isFeatured: true, isFlashSale: true, flashSaleEnd: '2024-12-25T23:59:59Z',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&auto=format&fit=crop',
    ],
    variants: [
      { id: 'pv13', productId: '5', name: 'Ukuran', value: '40', stock: 8 },
      { id: 'pv14', productId: '5', name: 'Ukuran', value: '41', stock: 10 },
      { id: 'pv15', productId: '5', name: 'Ukuran', value: '42', stock: 7 },
      { id: 'pv16', productId: '5', name: 'Ukuran', value: '43', stock: 5 },
    ],
    seller: defaultSeller5, category: { id: 'cat3', name: 'Sepatu', slug: 'sepatu' },
  },
  {
    id: '6', sellerId: 's1', categoryId: 'cat2', name: 'MacBook Pro M3 14 inch', slug: 'macbook-pro-m3',
    description: 'MacBook Pro dengan chip M3, layar Liquid Retina XDR, dan performa luar biasa untuk profesional.',
    price: 27999000, discountPrice: 25999000, stock: 20, sold: 450, minOrder: 1, weight: 1550, condition: 'new', status: 'active',
    rating: 4.9, reviewCount: 780, isFeatured: true, isFlashSale: false,
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&auto=format&fit=crop',
    ],
    variants: [
      { id: 'pv17', productId: '6', name: 'Storage', value: '512GB', price: 0, stock: 12 },
      { id: 'pv18', productId: '6', name: 'Storage', value: '1TB', price: 4000000, stock: 8 },
    ],
    seller: defaultSeller1, category: { id: 'cat2', name: 'Laptop', slug: 'laptop' },
  },
  {
    id: '7', sellerId: 's3', categoryId: 'cat6', name: 'Lipstik Matte Velvet Long Lasting', slug: 'lipstik-matte-velvet',
    description: 'Lipstik matte velvet formula terbaru, tahan lama hingga 12 jam. Warna pigmented dan nyaman di bibir.',
    price: 75000, discountPrice: 55000, stock: 500, sold: 8900, minOrder: 1, weight: 30, condition: 'new', status: 'active',
    rating: 4.5, reviewCount: 3200, isFeatured: false, isFlashSale: true, flashSaleEnd: '2024-12-25T23:59:59Z',
    images: [
      'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?w=800&auto=format&fit=crop',
    ],
    variants: [
      { id: 'pv19', productId: '7', name: 'Warna', value: 'Ruby Red', stock: 120 },
      { id: 'pv20', productId: '7', name: 'Warna', value: 'Nude Pink', stock: 150 },
      { id: 'pv21', productId: '7', name: 'Warna', value: 'Mauve', stock: 100 },
    ],
    seller: defaultSeller3, category: { id: 'cat6', name: 'Kecantikan', slug: 'kecantikan' },
  },
  {
    id: '8', sellerId: 's4', categoryId: 'cat10', name: 'Diffuser Aromatherapy Minimalis', slug: 'diffuser-aromatherapy',
    description: 'Diffuser aromatherapy dengan desain minimalis modern. Kapasitas 300ml dengan LED 7 warna.',
    price: 189000, discountPrice: 149000, stock: 120, sold: 2300, minOrder: 1, weight: 450, condition: 'new', status: 'active',
    rating: 4.6, reviewCount: 1560, isFeatured: true, isFlashSale: false,
    images: [
      'https://images.unsplash.com/photo-1602928321679-560bb453f190?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&auto=format&fit=crop',
    ],
    variants: [],
    seller: defaultSeller4, category: { id: 'cat10', name: 'Rumah Tangga', slug: 'rumah-tangga' },
  },
  {
    id: '9', sellerId: 's5', categoryId: 'cat9', name: 'Yoga Mat Premium Anti Slip', slug: 'yoga-mat-premium',
    description: 'Yoga mat premium 8mm anti slip dengan bahan TPE eco-friendly. Nyaman dan aman untuk olahraga.',
    price: 250000, discountPrice: 189000, stock: 200, sold: 1800, minOrder: 1, weight: 1200, condition: 'new', status: 'active',
    rating: 4.8, reviewCount: 920, isFeatured: false, isFlashSale: false,
    images: [
      'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop',
    ],
    variants: [
      { id: 'pv22', productId: '9', name: 'Warna', value: 'Purple', stock: 60 },
      { id: 'pv23', productId: '9', name: 'Warna', value: 'Blue', stock: 80 },
      { id: 'pv24', productId: '9', name: 'Warna', value: 'Pink', stock: 60 },
    ],
    seller: defaultSeller5, category: { id: 'cat9', name: 'Olahraga', slug: 'olahraga' },
  },
  {
    id: '10', sellerId: 's4', categoryId: 'cat8', name: 'Smart LED TV 43 inch 4K UHD', slug: 'smart-led-tv-43',
    description: 'Smart LED TV 43 inch 4K UHD dengan Android TV built-in. Dolby Audio dan HDMI x3.',
    price: 3299000, discountPrice: 2899000, stock: 40, sold: 620, minOrder: 1, weight: 6500, condition: 'new', status: 'active',
    rating: 4.6, reviewCount: 450, isFeatured: true, isFlashSale: false,
    images: [
      'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1461151304267-38535e780c79?w=800&auto=format&fit=crop',
    ],
    variants: [],
    seller: defaultSeller4, category: { id: 'cat8', name: 'Elektronik', slug: 'elektronik' },
  },
  {
    id: '11', sellerId: 's1', categoryId: 'cat14', name: 'PS5 Slim Digital Edition', slug: 'ps5-slim-digital',
    description: 'PlayStation 5 Slim Digital Edition - Konsol gaming next-gen dengan SSD super cepat dan DualSense controller.',
    price: 6499000, discountPrice: 5799000, stock: 25, sold: 380, minOrder: 1, weight: 3200, condition: 'new', status: 'active',
    rating: 4.9, reviewCount: 890, isFeatured: true, isFlashSale: true, flashSaleEnd: '2024-12-25T23:59:59Z',
    images: [
      'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=800&auto=format&fit=crop',
    ],
    variants: [],
    seller: defaultSeller1, category: { id: 'cat14', name: 'Gaming', slug: 'gaming' },
  },
  {
    id: '12', sellerId: 's3', categoryId: 'cat6', name: 'Skincare Set Glowing Package', slug: 'skincare-set-glowing',
    description: 'Paket skincare lengkap untuk kulit glowing: Cleanser, Toner, Serum, Moisturizer, Sunscreen.',
    price: 350000, discountPrice: 245000, stock: 300, sold: 5600, minOrder: 1, weight: 500, condition: 'new', status: 'active',
    rating: 4.7, reviewCount: 4100, isFeatured: true, isFlashSale: true, flashSaleEnd: '2024-12-25T23:59:59Z',
    images: [
      'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1570194065650-d99fb4cb867c?w=800&auto=format&fit=crop',
    ],
    variants: [
      { id: 'pv25', productId: '12', name: 'Tipe Kulit', value: 'Normal', stock: 100 },
      { id: 'pv26', productId: '12', name: 'Tipe Kulit', value: 'Oily', stock: 100 },
      { id: 'pv27', productId: '12', name: 'Tipe Kulit', value: 'Dry', stock: 100 },
    ],
    seller: defaultSeller3, category: { id: 'cat6', name: 'Kecantikan', slug: 'kecantikan' },
  },
]

export const MOCK_SHIPPING_OPTIONS: ShippingOption[] = [
  { provider: 'JNE', service: 'REG', name: 'JNE Reguler', price: 15000, estimatedDays: '2-3 hari', logo: '📦' },
  { provider: 'JNE', service: 'YES', name: 'JNE YES', price: 25000, estimatedDays: '1 hari', logo: '🚀' },
  { provider: 'SiCepat', service: 'REG', name: 'SiCepat Reguler', price: 12000, estimatedDays: '2-3 hari', logo: '✈️' },
  { provider: 'SiCepat', service: 'BEST', name: 'SiCepat BEST', price: 22000, estimatedDays: '1-2 hari', logo: '⚡' },
  { provider: 'J&T', service: 'EZ', name: 'J&T Express', price: 10000, estimatedDays: '2-4 hari', logo: '🚚' },
  { provider: 'AnterAja', service: 'REG', name: 'AnterAja Reguler', price: 9000, estimatedDays: '3-5 hari', logo: '📮' },
  { provider: 'Tiki', service: 'REG', name: 'Tiki Reguler', price: 14000, estimatedDays: '2-3 hari', logo: '📬' },
]

export const MOCK_SELLER_STATS: SellerStats = {
  totalRevenue: 45680000,
  totalOrders: 234,
  totalProducts: 45,
  totalVisitors: 12500,
  pendingOrders: 12,
  monthlyRevenue: [
    { month: 'Jul', revenue: 28000000 },
    { month: 'Aug', revenue: 32000000 },
    { month: 'Sep', revenue: 29500000 },
    { month: 'Oct', revenue: 35000000 },
    { month: 'Nov', revenue: 38000000 },
    { month: 'Dec', revenue: 45680000 },
  ],
  topProducts: [
    { name: 'iPhone 15 Pro Max', sold: 120, revenue: 2639880000 },
    { name: 'Samsung Galaxy S24', sold: 89, revenue: 1601921000 },
    { name: 'MacBook Pro M3', sold: 45, revenue: 1169955000 },
    { name: 'PS5 Slim Digital', sold: 38, revenue: 220362000 },
  ],
  recentOrders: [],
}

export const MOCK_ADMIN_STATS: AdminStats = {
  totalUsers: 125000,
  totalSellers: 8500,
  totalOrders: 450000,
  totalRevenue: 12500000000,
  pendingWithdrawals: 23,
  activeProducts: 850000,
  revenueChart: [
    { date: 'Jul', revenue: 8500000000 },
    { date: 'Aug', revenue: 9200000000 },
    { date: 'Sep', revenue: 8800000000 },
    { date: 'Oct', revenue: 10500000000 },
    { date: 'Nov', revenue: 11200000000 },
    { date: 'Dec', revenue: 12500000000 },
  ],
  userGrowth: [
    { date: 'Jul', users: 95000 },
    { date: 'Aug', users: 98000 },
    { date: 'Sep', users: 102000 },
    { date: 'Oct', users: 108000 },
    { date: 'Nov', users: 116000 },
    { date: 'Dec', users: 125000 },
  ],
}

// Helper to format price
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

// Helper to format date
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Baru saja'
  if (diffMins < 60) return `${diffMins} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 7) return `${diffDays} hari lalu`
  return formatDate(dateStr)
}

// Helper to truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
