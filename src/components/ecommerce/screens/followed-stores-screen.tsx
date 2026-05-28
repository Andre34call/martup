"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { PageHeader, EmptyState } from "../shared"
import { useState } from "react"
import { Heart, Star, Check } from "lucide-react"
import { Card } from "@/components/ui/card"
import { stagger } from '@/lib/animations'

export function FollowedStoresScreen() {
  const { setSelectedSeller, navigate } = useAppStore()
  const [following, setFollowing] = useState<Record<string, boolean>>({
    s1: true, s2: true, s4: true, s5: true, s3: true
  })

  const stores = [
    { id: "s1", name: "Gadget Pro Store", isVerified: true, rating: 4.9, products: 250, avatar: "" },
    { id: "s2", name: "Fashion Hub", isVerified: true, rating: 4.7, products: 120, avatar: "" },
    { id: "s4", name: "Home Living ID", isVerified: true, rating: 4.8, products: 180, avatar: "" },
    { id: "s5", name: "Sport Zone", isVerified: true, rating: 4.6, products: 95, avatar: "" },
    { id: "s3", name: "Beauty Corner", isVerified: false, rating: 4.5, products: 80, avatar: "" },
  ]

  const colors = ["bg-emerald-500", "bg-orange-500", "bg-pink-500", "bg-violet-500", "bg-cyan-500"]

  const handleStoreClick = (storeId: string) => {
    setSelectedSeller(storeId)
    navigate("seller-shop")
  }

  return (
    <div className="pb-24">
      <PageHeader title="Toko Favorit" />

      <div className="px-4 space-y-3">
        {stores.length === 0 ? (
          <EmptyState
            icon={<Heart className="w-10 h-10 text-muted-foreground" />}
            title="Belum Ada Toko Favorit"
            subtitle="Ikuti toko untuk mendapat update produk terbaru"
          />
        ) : (
          stores.map((store, i) => (
            <motion.div key={store.id} custom={i} variants={stagger} initial="initial" animate="animate">
              <Card className="p-4 cursor-pointer" onClick={() => handleStoreClick(store.id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${colors[i % colors.length]} text-white font-bold flex items-center justify-center text-lg flex-shrink-0`}>
                    {store.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{store.name}</p>
                      {store.isVerified && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-muted-foreground">{store.rating}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{store.products} produk</span>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); setFollowing(prev => ({ ...prev, [store.id]: !prev[store.id] })) }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      following[store.id]
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {following[store.id] ? "Mengikuti" : "Ikuti"}
                  </motion.button>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
