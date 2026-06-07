"use client"

import { motion } from "framer-motion"
import { Plus, Box, AlertTriangle, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import { apiClient } from '@/lib/api-client'
import { formatPrice } from "@/lib/utils"
import { stagger } from '@/lib/animations'
import { PageHeader, SearchBar, EmptyState } from "../shared"
import { useState } from "react"

export function SellerProducts() {
  const { navigate, showToast, products, removeProduct, setSelectedProduct, seller } = useAppStore()
  const [search, setSearch] = useState("")

  // Derive sellerId from store seller
  const sellerId = seller?.id || ''

  // Filter products for current seller
  const sellerProducts = products.filter(p => p.sellerId === sellerId)
  const filtered = sellerProducts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Produk" rightAction={
        <Button
          onClick={() => navigate("seller-add-product")}
          className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
        </Button>
      } />

      <div className="px-4 space-y-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari produk..." />

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Box className="w-10 h-10 text-muted-foreground" />}
            title="Produk Tidak Ditemukan"
            subtitle="Coba kata kunci lain"
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((product, i) => (
              <motion.div key={product.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Box className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-1">{product.name}</p>
                          {product.productType === 'jasa' ? (
                            <Badge className="bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0 rounded flex-shrink-0">
                              Tolong Mas
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 border-border text-muted-foreground flex-shrink-0">
                              Barang
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${product.status === "active" ? "border-emerald-300 text-emerald-600" : "border-amber-300 text-amber-600"}`}>
                          {product.status === "active" ? "Aktif" : "Draft"}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(product.discountPrice || product.price)}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">Stok: {product.stock}</span>
                        {product.stock < 10 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            <AlertTriangle className="w-2.5 h-2.5" /> Stok Rendah
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{product.sold} terjual</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-lg" onClick={() => {
                      setSelectedProduct(product.id)
                      navigate("seller-add-product")
                    }}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={async () => {
                      if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) return
                      try {
                        const res = await apiClient.rawDelete('/api/seller/products', { productId: product.id })
                        const data = await res.json()
                        if (data.success) {
                          removeProduct(product.id)
                          showToast("Produk berhasil dihapus", "success")
                        } else {
                          showToast(data.error || "Gagal menghapus produk", "error")
                        }
                      } catch {
                        showToast("Gagal menghapus produk", "error")
                      }
                    }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
