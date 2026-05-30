"use client"

import { motion } from "framer-motion"
import {
  MessageSquare, Check, X, Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import { PageHeader, EmptyState } from "../shared"
import { stagger } from '@/lib/animations'
import { useState, useEffect } from "react"
import { LoadingSpinner } from "../loading-spinner"

export function AdminComplaints() {
  const { showToast, adminComplaints, updateAdminComplaint, fetchAdminComplaints } = useAppStore()
  const [activeTab, setActiveTab] = useState("open")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAdminComplaints().finally(() => setIsLoading(false))
  }, [fetchAdminComplaints])

  const filtered = activeTab === "all"
    ? adminComplaints
    : adminComplaints.filter(c => c.status === activeTab)

  const statusLabel: Record<string, string> = {
    open: "Terbuka",
    processing: "Diproses",
    resolved: "Diselesaikan",
    rejected: "Ditolak",
  }

  const statusColor: Record<string, string> = {
    open: "border-red-300 text-red-600",
    processing: "border-amber-300 text-amber-600",
    resolved: "border-emerald-300 text-emerald-600",
    rejected: "border-red-300 text-red-600",
  }

  if (isLoading) return <div className="pb-20"><PageHeader title="Keluhan" /><LoadingSpinner message="Memuat keluhan..." /></div>

  return (
    <div className="pb-20">
      <PageHeader title="Keluhan" />

      <div className="px-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "open", label: "Terbuka" },
            { key: "processing", label: "Diproses" },
            { key: "resolved", label: "Diselesaikan" },
            { key: "rejected", label: "Ditolak" },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Complaints List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Keluhan"
              subtitle="Semua keluhan sudah ditangani"
            />
          ) : (
            filtered.map((complaint, i) => (
              <motion.div key={complaint.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-mono text-muted-foreground">{complaint.orderId}</p>
                    <Badge variant="outline" className={`text-[10px] ${statusColor[complaint.status]}`}>
                      {statusLabel[complaint.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mb-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Pembeli</p>
                      <p className="text-xs font-medium text-foreground">{complaint.buyer || complaint.userName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Seller</p>
                      <p className="text-xs font-medium text-foreground">{complaint.seller}</p>
                    </div>
                  </div>
                  <div className="mb-2">
                    <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">
                      {complaint.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{complaint.description}</p>

                  {complaint.status !== "resolved" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      {complaint.status === "open" && (
                        <Button size="sm" className="h-7 text-[11px] rounded-lg bg-amber-500 hover:bg-amber-600 text-white" onClick={() => {
                          updateAdminComplaint(complaint.id, { status: "processing" })
                          showToast("Keluhan sedang diproses", "info")
                        }}>
                          <Clock className="w-3 h-3 mr-0.5" /> Proses
                        </Button>
                      )}
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white" onClick={() => {
                        updateAdminComplaint(complaint.id, { status: "resolved" })
                        showToast("Keluhan diselesaikan", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Resolve
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => {
                        updateAdminComplaint(complaint.id, { status: "rejected" })
                        showToast("Keluhan ditolak", "info")
                      }}>
                        <X className="w-3 h-3 mr-0.5" /> Reject
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
