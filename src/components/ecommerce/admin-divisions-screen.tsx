"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Users, Building2, ChevronRight, Shield, Check, X, Plus,
  UserPlus, Settings, Edit, ArrowRight, Crown, AlertTriangle,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { PageHeader, SectionHeader, EmptyState } from "./shared"
import { fadeIn, stagger } from '@/lib/animations'
import { ROLE_DISPLAY, STAFF_ROLES } from "@/lib/types"
import type { Division } from "@/lib/types"
import { useState, useEffect, useRef } from "react"

// Color mapping for divisions
const colorMap: Record<string, { bg: string; text: string; border: string; light: string }> = {
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-300', light: 'bg-emerald-50 dark:bg-emerald-900/30' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-300', light: 'bg-blue-50 dark:bg-blue-900/30' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-300', light: 'bg-purple-50 dark:bg-purple-900/30' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-300', light: 'bg-orange-50 dark:bg-orange-900/30' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-600', border: 'border-pink-300', light: 'bg-pink-50 dark:bg-pink-900/30' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-300', light: 'bg-amber-50 dark:bg-amber-900/30' },
  red: { bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-300', light: 'bg-red-50 dark:bg-red-900/30' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-300', light: 'bg-teal-50 dark:bg-teal-900/30' },
}

// ==================== DIVISION CARD ====================
function DivisionCard({ division, index, onSelect }: {
  division: Division
  index: number
  onSelect: (division: Division) => void
}) {
  const colors = colorMap[division.color || 'blue'] || colorMap.blue

  return (
    <motion.div custom={index} variants={stagger} initial="initial" animate="animate">
      <Card
        className="p-4 cursor-pointer hover:shadow-md transition-all border-border/50"
        onClick={() => onSelect(division)}
      >
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${colors.light}`}>
            {division.icon || '🏢'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground truncate">{division.name}</h3>
              {!division.isActive && (
                <Badge variant="outline" className="text-[9px] border-red-300 text-red-600">Inactive</Badge>
              )}
            </div>
            {division.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{division.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                <Users className={`w-3.5 h-3.5 ${colors.text}`} />
                <span className="text-xs font-medium text-foreground">{division.memberCount}</span>
                <span className="text-[10px] text-muted-foreground">anggota</span>
              </div>
              {division.headUser && (
                <div className="flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-500" />
                  <span className="text-xs text-muted-foreground truncate max-w-[100px]">{division.headUser.name}</span>
                </div>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </Card>
    </motion.div>
  )
}

// ==================== DIVISION DETAIL PANEL ====================
function DivisionDetail({ division, onBack }: {
  division: Division
  onBack: () => void
}) {
  const { adminUsers, assignUserToDivision, showToast, updateDivision } = useAppStore()
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState(division.name)
  const [editDesc, setEditDesc] = useState(division.description || '')
  const [searchUser, setSearchUser] = useState('')
  const colors = colorMap[division.color || 'blue'] || colorMap.blue

  const divisionMembers = adminUsers.filter(u => {
    // Check if user has a divisionId matching this division
    return (u as any).divisionId === division.id
  })

  const availableUsers = adminUsers.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase())
    const notInDivision = (u as any).divisionId !== division.id
    // Only show staff/admin roles
    const isStaffRole = ['admin', ...STAFF_ROLES].includes(u.role)
    return matchesSearch && notInDivision && isStaffRole
  })

  const handleAssign = async (userId: string) => {
    await assignUserToDivision(userId, division.id)
    showToast('Anggota ditambahkan ke divisi', 'success')
    setShowAssignModal(false)
  }

  const handleRemoveMember = async (userId: string) => {
    await assignUserToDivision(userId, null)
    showToast('Anggota dikeluarkan dari divisi', 'info')
  }

  const handleEditSave = async () => {
    await updateDivision(division.id, { name: editName, description: editDesc })
    showToast('Divisi diperbarui', 'success')
    setShowEditModal(false)
  }

  const handleToggleActive = async () => {
    await updateDivision(division.id, { isActive: !division.isActive })
    showToast(division.isActive ? 'Divisi dinonaktifkan' : 'Divisi diaktifkan', 'info')
  }

  return (
    <div className="pb-20">
      <PageHeader title={division.name} onBack={onBack} rightAction={
        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowEditModal(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            <Edit className="w-4 h-4 text-muted-foreground" />
          </motion.button>
        </div>
      } />

      <div className="px-4 space-y-4">
        {/* Division Header */}
        <motion.div {...fadeIn}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl ${colors.light}`}>
                {division.icon || '🏢'}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">{division.name}</h2>
                {division.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{division.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={`${colors.bg} text-white text-[10px]`}>
                    {division.memberCount} Anggota
                  </Badge>
                  {division.headUser && (
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">
                      <Crown className="w-2.5 h-2.5 mr-0.5" /> {division.headUser.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className={`flex-1 h-9 text-xs rounded-lg ${colors.bg} hover:opacity-90 text-white`}
            onClick={() => setShowAssignModal(true)}
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" /> Tambah Anggota
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs rounded-lg"
            onClick={handleToggleActive}
          >
            {division.isActive ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
        </div>

        {/* Members List */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Anggota Divisi" icon={<Users className="w-4 h-4" />} />
          <div className="space-y-2 mt-3">
            {divisionMembers.length === 0 ? (
              <EmptyState
                icon={<Users className="w-10 h-10 text-muted-foreground" />}
                title="Belum Ada Anggota"
                subtitle="Tambahkan anggota ke divisi ini"
              />
            ) : (
              divisionMembers.map((user, i) => (
                <motion.div key={user.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${colors.bg} text-white font-bold flex items-center justify-center flex-shrink-0 text-sm`}>
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                          {division.headUserId === user.id && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[9px] ${
                          ROLE_DISPLAY[user.role]?.color === 'emerald' ? 'border-emerald-300 text-emerald-600' :
                          ROLE_DISPLAY[user.role]?.color === 'purple' ? 'border-purple-300 text-purple-600' :
                          ROLE_DISPLAY[user.role]?.color === 'orange' ? 'border-orange-300 text-orange-600' :
                          ROLE_DISPLAY[user.role]?.color === 'blue' ? 'border-blue-300 text-blue-600' :
                          'border-gray-300 text-gray-600'
                        }`}>
                          {ROLE_DISPLAY[user.role]?.icon || ''} {ROLE_DISPLAY[user.role]?.label || user.role}
                        </Badge>
                        {division.headUserId !== user.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleRemoveMember(user.id)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Statistik Divisi" icon={<Settings className="w-4 h-4" />} />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Total Anggota</p>
              <p className="text-xl font-bold text-foreground">{division.memberCount}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className={`text-sm font-bold ${division.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                {division.isActive ? 'Aktif' : 'Nonaktif'}
              </p>
            </Card>
          </div>
        </motion.div>
      </div>

      {/* Assign Member Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            onClick={() => setShowAssignModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-card rounded-t-2xl w-full max-w-lg max-h-[70vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">Tambah Anggota</h3>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowAssignModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <Input
                  className="mt-3"
                  placeholder="Cari user..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />
              </div>
              <div className="overflow-y-auto max-h-[50vh] p-4 space-y-2">
                {availableUsers.length === 0 ? (
                  <EmptyState
                    icon={<Users className="w-8 h-8 text-muted-foreground" />}
                    title="Tidak Ada User Tersedia"
                    subtitle="Semua user staf sudah ditugaskan"
                  />
                ) : (
                  availableUsers.map((user) => (
                    <Card key={user.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${colors.bg} text-white font-bold flex items-center justify-center text-sm`}>
                          {user.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px]">
                          {ROLE_DISPLAY[user.role]?.label || user.role}
                        </Badge>
                        <Button
                          size="sm"
                          className={`h-7 text-[11px] rounded-lg ${colors.bg} hover:opacity-90 text-white`}
                          onClick={() => handleAssign(user.id)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-card rounded-t-2xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">Edit Divisi</h3>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowEditModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nama Divisi</label>
                  <Input
                    className="mt-1"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Deskripsi</label>
                  <Input
                    className="mt-1"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-lg"
                    onClick={() => setShowEditModal(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    className={`flex-1 h-10 rounded-lg ${colors.bg} hover:opacity-90 text-white`}
                    onClick={handleEditSave}
                  >
                    Simpan
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==================== MAIN ADMIN DIVISIONS SCREEN ====================
export function AdminDivisions() {
  const { divisions, fetchDivisions, fetchAdminUsers, adminUsers } = useAppStore()
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => {
    fetchDivisions()
    fetchAdminUsers()
  }, [])

  const filteredDivisions = divisions.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' ||
      (filter === 'active' && d.isActive) ||
      (filter === 'inactive' && !d.isActive)
    return matchesSearch && matchesFilter
  })

  const activeDivisions = divisions.filter(d => d.isActive).length
  const totalMembers = divisions.reduce((sum, d) => sum + d.memberCount, 0)

  if (selectedDivision) {
    return <DivisionDetail division={selectedDivision} onBack={() => setSelectedDivision(null)} />
  }

  return (
    <div className="pb-20">
      <PageHeader title="Divisi & Departemen" />

      <div className="px-4 space-y-4">
        {/* Summary Cards */}
        <motion.div {...fadeIn} className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{divisions.length}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Total Divisi</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-blue-600">{activeDivisions}</p>
            <p className="text-[10px] text-blue-600 font-medium">Aktif</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-purple-600">{totalMembers}</p>
            <p className="text-[10px] text-purple-600 font-medium">Staf Total</p>
          </div>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Input
            placeholder="Cari divisi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: 'all' as const, label: 'Semua' },
            { key: 'active' as const, label: 'Aktif' },
            { key: 'inactive' as const, label: 'Nonaktif' },
          ].map((f) => (
            <motion.button
              key={f.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                filter === f.key
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
            >
              {f.label}
            </motion.button>
          ))}
        </div>

        {/* Division List */}
        <div className="space-y-2">
          {filteredDivisions.length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-10 h-10 text-muted-foreground" />}
              title="Divisi Tidak Ditemukan"
              subtitle="Coba kata kunci lain"
            />
          ) : (
            filteredDivisions.map((division, i) => (
              <DivisionCard
                key={division.id}
                division={division}
                index={i}
                onSelect={setSelectedDivision}
              />
            ))
          )}
        </div>

        {/* Role Reference */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Referensi Role Staf" />
          <div className="grid grid-cols-2 gap-2 mt-3">
            {['admin', ...STAFF_ROLES].map((role) => {
              const display = ROLE_DISPLAY[role]
              if (!display) return null
              const colors = colorMap[display.color] || colorMap.blue
              return (
                <Card key={role} className="p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{display.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{display.label}</p>
                      <Badge variant="outline" className={`text-[8px] mt-0.5 ${colors.border} ${colors.text}`}>
                        {role}
                      </Badge>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
