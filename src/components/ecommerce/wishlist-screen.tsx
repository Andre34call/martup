"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore, useWishlistStore } from "@/lib/store"
import { MOCK_PRODUCTS } from "@/lib/mock-data"
import { PageHeader, ProductCard, EmptyState } from "./shared"
import type { Product } from "@/lib/types"
import { useMemo, useCallback } from "react"
import { Heart, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"

export function WishlistScreen() {
  const { productIds } = useWishlistStore()
  const { navigate, setSelectedProduct } = useAppStore()

  const wishlistedProducts = useMemo(() => {
    return MOCK_PRODUCTS.filter((p) => productIds.includes(p.id))
  }, [productIds])

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product.id)
    navigate("product-detail")
  }, [setSelectedProduct, navigate])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader title="Wishlist" />

      <div className="flex-1 pb-20">
        {wishlistedProducts.length > 0 ? (
          <div className="p-4">
            {/* Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{wishlistedProducts.length}</span> produk di wishlist
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-lg"
                onClick={() => navigate("home")}
              >
                <ShoppingBag className="w-3.5 h-3.5 mr-1" />
                Belanja
              </Button>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence>
                {wishlistedProducts.map((product, idx) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <ProductCard
                      product={product}
                      onClick={() => handleProductClick(product)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Heart className="w-10 h-10 text-muted-foreground" />}
            title="Wishlist Kosong"
            subtitle="Tambahkan produk favorit ke wishlist untuk memudahkan pencarian"
            actionLabel="Mulai Belanja"
            onAction={() => navigate("home")}
          />
        )}
      </div>
    </div>
  )
}
