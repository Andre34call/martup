"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { PageHeader, EmptyState, TabBar } from "../shared"
import type { Order, OrderStatus } from "@/lib/types"
import { useState, useMemo, useCallback } from "react"
import { Package } from "lucide-react"
import { OrderCard } from './OrderCard'
import { OrderDetail } from './OrderDetail'

const ORDER_TABS = [
  { key: "all", label: "Semua" },
  { key: "pending", label: "Belum Bayar" },
  { key: "processing", label: "Diproses" },
  { key: "shipped", label: "Dikirim" },
  { key: "delivered", label: "Selesai" },
]

const tabStatusMap: Record<string, OrderStatus[]> = {
  all: [],
  pending: ["pending"],
  processing: ["paid", "processing"],
  shipped: ["shipped"],
  delivered: ["delivered"],
}

// ==================== ORDER SCREEN ====================
export function OrderScreen() {
  const { orders, navigate, selectedOrderId, setSelectedOrder } = useAppStore()
  const [activeTab, setActiveTab] = useState("all")

  const filteredOrders = useMemo(() => {
    const statuses = tabStatusMap[activeTab]
    if (!statuses || statuses.length === 0) return orders
    return orders.filter((o) => statuses.includes(o.status))
  }, [orders, activeTab])

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null
    return orders.find((o) => o.id === selectedOrderId) || null
  }, [orders, selectedOrderId])

  const tabCounts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    processing: orders.filter((o) => ["paid", "processing"].includes(o.status)).length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  }), [orders])

  const tabsWithCounts = ORDER_TABS.map((tab) => ({
    ...tab,
    count: tabCounts[tab.key as keyof typeof tabCounts] || 0,
  }))

  const handleOrderTap = useCallback((orderId: string) => {
    setSelectedOrder(orderId)
  }, [setSelectedOrder])

  const handleBackFromDetail = useCallback(() => {
    setSelectedOrder(null)
  }, [setSelectedOrder])

  if (selectedOrder) {
    return <OrderDetail order={selectedOrder} onBack={handleBackFromDetail} />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader title="Pesanan Saya" />

      <div className="flex-1 pb-20">
        {/* Tab Bar */}
        <div className="sticky top-14 z-30 bg-background">
          <TabBar
            tabs={tabsWithCounts}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Order List */}
        <div className="p-4 space-y-3">
          <AnimatePresence mode="wait">
            {filteredOrders.length > 0 ? (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {filteredOrders.map((order, idx) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <OrderCard order={order} onTap={() => handleOrderTap(order.id)} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={`empty-${activeTab}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <EmptyState
                  icon={<Package className="w-10 h-10 text-muted-foreground" />}
                  title="Belum Ada Pesanan"
                  subtitle="Pesanan kamu akan muncul di sini"
                  actionLabel="Mulai Belanja"
                  onAction={() => navigate("home")}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
