"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { PageHeader, EmptyState } from "../shared"
import { useEffect, useState } from "react"
import { Heart, Star, Check, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { stagger } from '@/lib/animations'

export function FollowedStoresScreen() {
  const { setSelectedSeller, navigate, followedStoresData, followedStoreIds, toggleFollowStore, fetchFollowedStores, currentUser, showToast } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (currentUser?.id) {
        setIsLoading(true)
        await fetchFollowedStores(currentUser.id)
        setIsLoading(false)
      } else {
        setIsLoading(false)
      }
    }
    load()
  }, [currentUser?.id, fetchFollowedStores])

  const colors = ["bg-emerald-500", "bg-orange-500", "bg-pink-500", "bg-violet-500", "bg-cyan-500"]

  const handleStoreClick = (storeId: string) => {
    setSelectedSeller(storeId)
    navigate("seller-shop")
  }

  const handleToggleFollow = async (storeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await toggleFollowStore(storeId)
    const isNowFollowing = !followedStoreIds.includes(storeId)
    showToast(isNowFollowing ? "Toko diikuti!" : "Toko berhenti diikuti", "info")
  }

  return (
    <div className="pb-24">
      <PageHeader title="Toko Favorit" />

      <div className="px-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : followedStoresData.length === 0 ? (
          <EmptyState
            icon={<Heart className="w-10 h-10 text-muted-foreground" />}
            title="Belum Ada Toko Favorit"
            subtitle="Ikuti toko untuk mendapat update produk terbaru"
          />
        ) : (
          followedStoresData.map((store, i) => (
            <motion.div key={store.id} custom={i} variants={stagger} initial="initial" animate="animate">
              <Card className="p-4 cursor-pointer" onClick={() => handleStoreClick(store.id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${store.storeAvatar ? '' : colors[i % colors.length]} text-white font-bold flex items-center justify-center text-lg flex-shrink-0 overflow-hidden`}>
                    {store.storeAvatar ? (
                      <img src={store.storeAvatar} alt={store.storeName} className="w-full h-full object-cover" />
                    ) : (
                      store.storeName.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{store.storeName}</p>
                      {store.isVerified && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-muted-foreground">{store.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{store.totalProducts} produk</span>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => handleToggleFollow(store.id, e)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      followedStoreIds.includes(store.id)
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {followedStoreIds.includes(store.id) ? "Mengikuti" : "Ikuti"}
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
