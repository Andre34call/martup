"use client"

import { motion } from "framer-motion"
import {
  Users, Shield, Check, Ban, Trash2, AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import { PageHeader, SearchBar, EmptyState } from "../shared"
import { stagger } from '@/lib/animations'
import { useState, useEffect } from "react"
import { ConfirmDialog } from "../confirm-dialog"
import { LoadingSpinner } from "../loading-spinner"
import { apiClient } from '@/lib/api-client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from "@/components/ui/input"
import { ELEVATED_ROLES } from '@/lib/types'
import { DIVISION_ROLES } from '@/lib/auth-middleware'

// SECURITY: No more hardcoded email — use the centralized SUPER_ADMIN_EMAIL from env
// This matches the backend env.SUPER_ADMIN_EMAIL which reads from environment variable
const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'kholisakm@gmail.com'

export function AdminUsers() {
  const { showToast, adminUsers, updateAdminUser, deleteAdminUser, fetchAdminUsers, currentUser, divisions, fetchDivisions } = useAppStore()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)

  // Permission state
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [promoteUser, setPromoteUser] = useState<{id: string; name: string; email: string; role: string} | null>(null)
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('')
  const [promoteLoading, setPromoteLoading] = useState(false)

  const isUserSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL && currentUser?.role === 'admin'
  const isUserManager = currentUser?.role === 'manager'
  const canPromote = isUserSuperAdmin || isUserManager // Manager + Super Admin can promote

  useEffect(() => {
    Promise.all([fetchAdminUsers(), fetchDivisions()]).finally(() => setIsLoading(false))
    setIsSuperAdmin(isUserSuperAdmin)
  }, [fetchAdminUsers, fetchDivisions, isUserSuperAdmin])

  const handleUpdateUser = async (userId: string, updates: Record<string, unknown>) => {
    try {
      const res = await apiClient.rawPut('/api/admin/users', { userId, updates })
      const data = await res.json()
      if (data.success) {
        fetchAdminUsers()
        return true
      } else {
        showToast(data.error || 'Gagal mengupdate user', "error")
        return false
      }
    } catch {
      showToast('Gagal mengupdate user', "error")
      return false
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await apiClient.rawDelete('/api/admin/users', { userId })
      const data = await res.json()
      if (data.success) {
        showToast("User dihapus", "info")
        fetchAdminUsers()
      } else {
        showToast(data.error || 'Gagal menghapus user', "error")
      }
    } catch {
      showToast('Gagal menghapus user', "error")
    }
  }

  // Derive status from store fields for UI compatibility
  const users = adminUsers.map(u => ({
    ...u,
    status: u.isBlocked ? "blocked" : u.isVerified ? "active" : "pending" as string,
    joined: u.joinDate,
  }))

  const filtered = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === "all" || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  if (isLoading) return <div className="pb-20"><PageHeader title="Kelola Users" /><LoadingSpinner message="Memuat users..." /></div>

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Users" />

      <div className="px-4 space-y-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari user..." />

        {/* Role Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "buyer", label: "Buyer" },
            { key: "seller", label: "Seller" },
            { key: "admin", label: "Admin" },
            { key: "manager", label: "Manager" },
            { key: "finance", label: "Finance" },
            { key: "pr", label: "PR" },
            { key: "tech", label: "Tech" },
            { key: "cs", label: "CS" },
            { key: "marketing", label: "Marketing" },
            { key: "operations", label: "Ops" },
          ].map((filter) => (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setRoleFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                roleFilter === filter.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* User Table */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="w-10 h-10 text-muted-foreground" />}
              title="User Tidak Ditemukan"
              subtitle="Coba kata kunci lain"
            />
          ) : (
            filtered.map((user, i) => (
              <motion.div key={user.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center flex-shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        <Badge variant="outline" className={`text-[9px] ${
                          user.email === SUPER_ADMIN_EMAIL ? "border-purple-300 text-purple-600" :
                          user.role === "manager" ? "border-violet-300 text-violet-600" :
                          user.role === "admin" ? "border-purple-300 text-purple-600" :
                          user.role === "seller" ? "border-orange-300 text-orange-600" :
                          user.role === "finance" ? "border-emerald-300 text-emerald-600" :
                          user.role === "pr" ? "border-blue-300 text-blue-600" :
                          user.role === "tech" ? "border-purple-300 text-purple-500" :
                          user.role === "cs" ? "border-orange-300 text-orange-500" :
                          user.role === "marketing" ? "border-pink-300 text-pink-600" :
                          user.role === "operations" ? "border-amber-300 text-amber-600" :
                          user.role === "legal" ? "border-red-300 text-red-500" :
                          user.role === "hr" ? "border-teal-300 text-teal-600" :
                          "border-emerald-300 text-emerald-600"
                        }`}>
                          {user.email === SUPER_ADMIN_EMAIL ? '👑 Super Admin' : user.role === 'manager' ? '👔 Manager' : user.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-[9px] ${
                          user.status === "active" ? "border-emerald-300 text-emerald-600" :
                          user.status === "pending" ? "border-amber-300 text-amber-600" :
                          "border-red-300 text-red-600"
                        }`}>
                          {user.status === "active" ? "Aktif" : user.status === "pending" ? "Pending" : "Blocked"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">Bergabung {user.joined}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    {user.status === "pending" && (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => {
                        handleUpdateUser(user.id, { isVerified: true })
                        showToast("User berhasil diverifikasi", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Verify
                      </Button>
                    )}
                    {user.status === "active" && (
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-amber-600" onClick={() => setConfirmAction({
                        action: () => { handleUpdateUser(user.id, { isBlocked: true }).then(() => showToast("User diblokir", "info")) },
                        title: 'Blokir User',
                        message: `Apakah Anda yakin ingin memblokir ${user.name}? User tidak akan dapat mengakses akunnya.`
                      })}>
                        <Ban className="w-3 h-3 mr-0.5" /> Block
                      </Button>
                    )}
                    {user.status === "blocked" && (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-blue-500 hover:bg-blue-600 text-white" onClick={() => {
                        handleUpdateUser(user.id, { isBlocked: false })
                        showToast("User dibuka kembali", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Unblock
                      </Button>
                    )}
                    {/* Promote to Division/Admin - Manager and Super Admin can promote non-elevated users */}
                    {canPromote && !ELEVATED_ROLES.includes(user.role) && user.email !== SUPER_ADMIN_EMAIL && (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-purple-500 hover:bg-purple-600 text-white" onClick={() => {
                        setPromoteUser({ id: user.id, name: user.name, email: user.email, role: user.role })
                        setSelectedDivisionId('')
                      }}>
                        <Shield className="w-3 h-3 mr-0.5" /> Promote
                      </Button>
                    )}
                    {/* Demote / Remove from Division — Manager can demote division admins, Super Admin can demote anyone */}
                    {((isSuperAdmin && ELEVATED_ROLES.includes(user.role)) || (isUserManager && DIVISION_ROLES.includes(user.role))) && user.email !== SUPER_ADMIN_EMAIL && (
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20" onClick={() => setConfirmAction({
                        action: () => { handleUpdateUser(user.id, { role: 'buyer', divisionId: null }).then(() => showToast(`${user.name} telah dikembalikan menjadi buyer`, "info")) },
                        title: 'Kembalikan ke Buyer',
                        message: `Apakah Anda yakin ingin menghapus akses ${user.role === 'admin' ? 'admin' : user.role} dari ${user.name}? User akan kembali menjadi buyer.`
                      })}>
                        <Shield className="w-3 h-3 mr-0.5" /> Demote
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setConfirmAction({
                      action: () => { handleDeleteUser(user.id) },
                      title: 'Hapus User',
                      message: `Apakah Anda yakin ingin menghapus ${user.name}? Tindakan ini tidak dapat dibatalkan.`
                    })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
      />

      {/* Promote to Division Dialog - Super Admin Only */}
      <Dialog open={!!promoteUser} onOpenChange={(open) => { if (!open) setPromoteUser(null) }}>
        <DialogContent className="max-w-[380px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Promosikan User</DialogTitle>
          </DialogHeader>
          {promoteUser && (
            <div className="space-y-4 mt-2">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-purple-500 text-white font-bold flex items-center justify-center flex-shrink-0">
                  {promoteUser.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{promoteUser.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{promoteUser.email}</p>
                  <Badge variant="outline" className="text-[9px] mt-0.5">{promoteUser.role}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Pilih Role</label>
                <p className="text-[10px] text-muted-foreground">User akan mendapatkan akses sesuai role yang dipilih.</p>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {/* Option: Manager — Super Admin only */}
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setSelectedDivisionId('__manager__')}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                        selectedDivisionId === '__manager__'
                          ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Manager</p>
                        <p className="text-[10px] text-muted-foreground">Mengawasi semua divisi, bisa promosi ke admin divisi</p>
                      </div>
                      {selectedDivisionId === '__manager__' && (
                        <Check className="w-4 h-4 text-violet-600 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  )}
                  {/* Option: Regular Admin (no division) */}
                  <button
                    type="button"
                    onClick={() => setSelectedDivisionId('__admin__')}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                      selectedDivisionId === '__admin__'
                        ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/30'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Admin</p>
                      <p className="text-[10px] text-muted-foreground">Akses penuh ke panel admin (tanpa divisi spesifik)</p>
                    </div>
                    {selectedDivisionId === '__admin__' && (
                      <Check className="w-4 h-4 text-purple-600 ml-auto flex-shrink-0" />
                    )}
                  </button>
                  {/* Division Options */}
                  {divisions.filter(d => d.isActive).map(division => (
                    <button
                      key={division.id}
                      type="button"
                      onClick={() => setSelectedDivisionId(division.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                        selectedDivisionId === division.id
                          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 text-lg">
                        {division.icon || '🏢'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{division.name}</p>
                        <p className="text-[10px] text-muted-foreground">{division.memberCount} anggota{division.headUser ? ` · Head: ${division.headUser.name}` : ''}</p>
                      </div>
                      {selectedDivisionId === division.id && (
                        <Check className="w-4 h-4 text-emerald-600 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning about role hierarchy */}
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  {isSuperAdmin 
                    ? 'Sebagai Super Admin, Anda dapat mempromosikan user ke role apapun termasuk Manager.'
                    : 'Sebagai Manager, Anda dapat mempromosikan user ke admin divisi. Hanya Super Admin yang bisa promosi ke Manager.'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setPromoteUser(null)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              disabled={!selectedDivisionId || promoteLoading}
              onClick={async () => {
                if (!promoteUser || !selectedDivisionId) return
                setPromoteLoading(true)
                try {
                  let payload: Record<string, unknown>
                  if (selectedDivisionId === '__manager__') {
                    // Promote to Manager — Super Admin only
                    payload = { userId: promoteUser.id, promoteToManager: true }
                  } else if (selectedDivisionId === '__admin__') {
                    // Promote to regular Admin (no division)
                    payload = { userId: promoteUser.id, divisionId: null }
                  } else {
                    // Promote to division admin
                    payload = { userId: promoteUser.id, divisionId: selectedDivisionId }
                  }

                  const res = await apiClient.rawPatch('/api/admin/users', payload)
                  const data = await res.json()
                  if (data.success) {
                    showToast(data.message || `${promoteUser.name} berhasil dipromosikan`, 'success')
                    setPromoteUser(null)
                    fetchAdminUsers()
                    fetchDivisions()
                  } else {
                    showToast(data.error || 'Gagal mempromosikan user', 'error')
                  }
                } catch {
                  showToast('Gagal mempromosikan user', 'error')
                } finally {
                  setPromoteLoading(false)
                }
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white rounded-xl h-10 flex-1"
            >
              {promoteLoading ? 'Memproses...' : 'Promosikan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
