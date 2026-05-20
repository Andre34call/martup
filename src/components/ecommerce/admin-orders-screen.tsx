"use client"

import { motion } from "framer-motion"
import { Package, Truck, CreditCard, Check, X, Eye, Printer, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/mock-data"
import { PageHeader, StatusBadge, EmptyState } from "./shared"
import type { OrderStatus } from "@/lib/types"
import { useState } from "react"

// ==================== ANIMATION VARIANTS ====================
const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 }
}

const stagger = {
  initial: { opacity: 0, y: 16 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.3 }
  })
}

// ==================== MOCK DATA ====================
type AdminOrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"

interface AdminOrder {
  id: string
  orderNumber: string
  buyerName: string
  items: { name: string; quantity: number }[]
  totalAmount: number
  status: AdminOrderStatus
  date: string
  paymentMethod: string
}

const mockAdminOrders: AdminOrder[] = [
  {
    id: "ao1",
    orderNumber: "ORD-2024-301",
    buyerName: "Ahmad Fauzi",
    items: [{ name: "iPhone 15 Pro Max 256GB", quantity: 1 }, { name: "Case Silicone Premium", quantity: 2 }],
    totalAmount: 22499000,
    status: "pending",
    date: "20 Des 2024",
    paymentMethod: "Midtrans",
  },
  {
    id: "ao2",
    orderNumber: "ORD-2024-302",
    buyerName: "Siti Nurhaliza",
    items: [{ name: "Gaun Midi Elegant - Party Wear", quantity: 1 }],
    totalAmount: 359000,
    status: "pending",
    date: "20 Des 2024",
    paymentMethod: "GoPay",
  },
  {
    id: "ao3",
    orderNumber: "ORD-2024-303",
    buyerName: "Budi Santoso",
    items: [{ name: "MacBook Pro M3 14 inch", quantity: 1 }, { name: "Magic Mouse", quantity: 1 }],
    totalAmount: 28799000,
    status: "processing",
    date: "19 Des 2024",
    paymentMethod: "Transfer Bank",
  },
  {
    id: "ao4",
    orderNumber: "ORD-2024-304",
    buyerName: "Dewi Lestari",
    items: [{ name: "Skincare Set Glowing Package", quantity: 2 }],
    totalAmount: 490000,
    status: "processing",
    date: "19 Des 2024",
    paymentMethod: "OVO",
  },
  {
    id: "ao5",
    orderNumber: "ORD-2024-305",
    buyerName: "Rudi Hartono",
    items: [{ name: "Sneakers Nike Air Max 90", quantity: 1 }],
    totalAmount: 999000,
    status: "shipped",
    date: "18 Des 2024",
    paymentMethod: "DANA",
  },
  {
    id: "ao6",
    orderNumber: "ORD-2024-306",
    buyerName: "Maya Putri",
    items: [{ name: "Diffuser Aromatherapy Minimalis", quantity: 1 }, { name: "Essential Oil Lavender 100ml", quantity: 3 }],
    totalAmount: 497000,
    status: "shipped",
    date: "17 Des 2024",
    paymentMethod: "Midtrans",
  },
  {
    id: "ao7",
    orderNumber: "ORD-2024-307",
    buyerName: "Agus Prasetyo",
    items: [{ name: "Smart LED TV 43 inch 4K UHD", quantity: 1 }],
    totalAmount: 2899000,
    status: "delivered",
    date: "15 Des 2024",
    paymentMethod: "Transfer Bank",
  },
  {
    id: "ao8",
    orderNumber: "ORD-2024-308",
    buyerName: "Rina Wulandari",
    items: [{ name: "Kemeja Flannel Premium Cotton", quantity: 3 }],
    totalAmount: 447000,
    status: "delivered",
    date: "14 Des 2024",
    paymentMethod: "GoPay",
  },
  {
    id: "ao9",
    orderNumber: "ORD-2024-309",
    buyerName: "Hendra Gunawan",
    items: [{ name: "PS5 Slim Digital Edition", quantity: 1 }],
    totalAmount: 5799000,
    status: "cancelled",
    date: "16 Des 2024",
    paymentMethod: "COD",
  },
  {
    id: "ao10",
    orderNumber: "ORD-2024-310",
    buyerName: "Lina Susanti",
    items: [{ name: "Lipstik Matte Velvet Long Lasting", quantity: 5 }],
    totalAmount: 275000,
    status: "cancelled",
    date: "13 Des 2024",
    paymentMethod: "OVO",
  },
]

// ==================== TAB CONFIG ====================
const orderTabs: { key: string; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Diproses" },
  { key: "shipped", label: "Dikirim" },
  { key: "delivered", label: "Selesai" },
  { key: "cancelled", label: "Dibatalkan" },
]

// ==================== STATUS TO ORDERSTATUS MAPPING ====================
const adminStatusToOrderStatus: Record<AdminOrderStatus, OrderStatus> = {
  pending: "pending",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
}

// ==================== STATUS ICON & COLOR ====================
const statusIconMap: Record<AdminOrderStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  processing: <Package className="w-4 h-4" />,
  shipped: <Truck className="w-4 h-4" />,
  delivered: <Check className="w-4 h-4" />,
  cancelled: <X className="w-4 h-4" />,
}

const statusColorMap: Record<AdminOrderStatus, string> = {
  pending: "text-amber-600 bg-amber-50 dark:bg-amber-900/30",
  processing: "text-violet-600 bg-violet-50 dark:bg-violet-900/30",
  shipped: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30",
  delivered: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30",
  cancelled: "text-red-600 bg-red-50 dark:bg-red-900/30",
}

// ==================== ACTION BUTTONS CONFIG ====================
function getOrderActions(status: AdminOrderStatus): { label: string; icon: React.ReactNode; variant: "default" | "outline"; className: string }[] {
  switch (status) {
    case "pending":
      return [
        { label: "Approve", icon: <Check className="w-3 h-3 mr-1" />, variant: "default", className: "bg-emerald-500 hover:bg-emerald-600 text-white" },
        { label: "Batalkan", icon: <X className="w-3 h-3 mr-1" />, variant: "outline", className: "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" },
      ]
    case "processing":
      return [
        { label: "Kirim", icon: <Truck className="w-3 h-3 mr-1" />, variant: "default", className: "bg-cyan-500 hover:bg-cyan-600 text-white" },
      ]
    case "shipped":
      return [
        { label: "Selesai", icon: <Check className="w-3 h-3 mr-1" />, variant: "default", className: "bg-emerald-500 hover:bg-emerald-600 text-white" },
      ]
    case "delivered":
      return []
    case "cancelled":
      return []
    default:
      return []
  }
}

// ==================== COMPONENT ====================
export function AdminOrdersScreen() {
  const [activeTab, setActiveTab] = useState("all")

  const filtered = activeTab === "all"
    ? mockAdminOrders
    : mockAdminOrders.filter((o) => o.status === activeTab)

  const pendingCount = mockAdminOrders.filter((o) => o.status === "pending").length
  const processingCount = mockAdminOrders.filter((o) => o.status === "processing").length
  const shippedCount = mockAdminOrders.filter((o) => o.status === "shipped").length
  const deliveredCount = mockAdminOrders.filter((o) => o.status === "delivered").length
  const cancelledCount = mockAdminOrders.filter((o) => o.status === "cancelled").length

  const tabCounts: Record<string, number> = {
    all: mockAdminOrders.length,
    pending: pendingCount,
    processing: processingCount,
    shipped: shippedCount,
    delivered: deliveredCount,
    cancelled: cancelledCount,
  }

  // Summary stats for top cards
  const summaryCards = [
    { label: "Pending", count: pendingCount, icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400" },
    { label: "Diproses", count: processingCount, icon: Package, color: "text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400" },
    { label: "Dikirim", count: shippedCount, icon: Truck, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 dark:text-cyan-400" },
    { label: "Selesai", count: deliveredCount, icon: Check, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" },
  ]

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Pesanan" />

      <div className="px-4 space-y-4">
        {/* Summary Stats */}
        <motion.div {...fadeIn} className="grid grid-cols-4 gap-2">
          {summaryCards.map((card, i) => (
            <motion.div key={card.label} custom={i} variants={stagger} initial="initial" animate="animate">
              <Card className="p-3 text-center">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5 ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold text-foreground">{card.count}</p>
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Tab Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {orderTabs.map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeTab === tab.key
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {tab.label}
              <span className={`min-w-[18px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold px-1 ${
                activeTab === tab.key
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              }`}>
                {tabCounts[tab.key]}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Order List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Pesanan"
              subtitle="Belum ada pesanan dengan status ini"
            />
          ) : (
            filtered.map((order, i) => {
              const actions = getOrderActions(order.status)
              const itemsText = order.items.length > 1
                ? `${order.items[0].name} +${order.items.length - 1} lainnya`
                : order.items[0].name

              return (
                <motion.div key={order.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-4">
                    {/* Order Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${statusColorMap[order.status]}`}>
                          {statusIconMap[order.status]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{order.orderNumber}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{order.buyerName}</p>
                        </div>
                      </div>
                      <StatusBadge status={adminStatusToOrderStatus[order.status]} size="sm" />
                    </div>

                    <Separator className="my-3" />

                    {/* Order Details */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Package className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-foreground line-clamp-1">{itemsText}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{order.paymentMethod}</span>
                        </div>
                        <p className="text-sm font-bold text-emerald-600">{formatPrice(order.totalAmount)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{order.date}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {actions.length > 0 && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                        {actions.map((action) => (
                          <Button
                            key={action.label}
                            variant={action.variant}
                            size="sm"
                            className={`h-8 text-[11px] rounded-lg ${action.className}`}
                          >
                            {action.icon}
                            {action.label}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] rounded-lg ml-auto"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Detail
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] rounded-lg"
                        >
                          <Printer className="w-3 h-3" />
                        </Button>
                      </div>
                    )}

                    {/* Delivered / Cancelled - only show detail & print */}
                    {(order.status === "delivered" || order.status === "cancelled") && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] rounded-lg ml-auto"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Detail
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] rounded-lg"
                        >
                          <Printer className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
