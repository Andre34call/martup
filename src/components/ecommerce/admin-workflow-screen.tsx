"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Building2, ClipboardList, ChevronRight, Clock, AlertTriangle,
  User, CheckCircle2, XCircle, ArrowUpCircle, Filter, Plus,
  ArrowRight, Crown, Search, MessageSquare, Package, DollarSign,
  Shield, Star, Edit, Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { PageHeader, SectionHeader, EmptyState } from "./shared"
import { WORK_TYPE_DISPLAY, WORK_PRIORITY_DISPLAY, WORK_STATUS_DISPLAY, WORK_TYPE_TO_DIVISION } from "@/lib/types"
import type { WorkItem, Division } from "@/lib/types"
import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { getAuthHeaders } from '@/lib/store/getAuthHeaders'
import { ConfirmDialog } from "./confirm-dialog"
import { LoadingSpinner } from "./loading-spinner"
import { formatRelativeTime } from "@/lib/utils"

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

// ==================== HELPERS ====================
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    open: 'border-blue-300 text-blue-600',
    in_progress: 'border-orange-300 text-orange-600',
    resolved: 'border-emerald-300 text-emerald-600',
    closed: 'border-gray-300 text-gray-500',
    escalated: 'border-red-300 text-red-600',
  }
  return colors[status] || 'border-gray-300 text-gray-500'
}

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    normal: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    high: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    urgent: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }
  return colors[priority] || 'bg-gray-100 text-gray-600'
}

const statusTabs = [
  { key: 'all', label: 'Semua' },
  { key: 'open', label: 'Terbuka' },
  { key: 'in_progress', label: 'Dikerjakan' },
  { key: 'resolved', label: 'Diselesaikan' },
  { key: 'closed', label: 'Ditutup' },
  { key: 'escalated', label: 'Eskalasi' },
]

const workTypeOptions = Object.entries(WORK_TYPE_DISPLAY).map(([key, val]) => ({
  value: key,
  label: val.label,
  icon: val.icon,
}))

const priorityOptions = [
  { value: 'low', label: 'Rendah' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Tinggi' },
  { value: 'urgent', label: 'Urgent' },
]

// ==================== CREATE WORK ITEM DIALOG ====================
function CreateWorkItemDialog({
  isOpen,
  onClose,
  divisions,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean
  onClose: () => void
  divisions: Division[]
  onSubmit: (data: {
    type: string
    title: string
    description: string
    priority: string
    divisionId: string
    dueDate: string
  }) => void
  isSubmitting: boolean
}) {
  const [type, setType] = useState('custom')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('normal')
  const [divisionId, setDivisionId] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Auto-route: compute the suggested division for the current type
  const autoDivisionSlug = WORK_TYPE_TO_DIVISION[type]
  const autoDivision = autoDivisionSlug ? divisions.find(d => d.slug === autoDivisionSlug) : null
  const effectiveDivisionId = divisionId || (autoDivision?.id ?? '')

  const handleTypeChange = (newType: string) => {
    setType(newType)
    // Reset division so auto-route kicks in for the new type
    setDivisionId('')
  }

  const handleSubmit = () => {
    if (!title.trim()) return
    onSubmit({ type, title: title.trim(), description: description.trim(), priority, divisionId: effectiveDivisionId, dueDate })
  }

  const resetAndClose = () => {
    setType('custom')
    setTitle('')
    setDescription('')
    setPriority('normal')
    setDivisionId('')
    setDueDate('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetAndClose() }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Buat Tugas Baru</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tipe Tugas</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5 max-h-40 overflow-y-auto">
              {workTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleTypeChange(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    type === opt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Judul</label>
            <Input
              className="mt-1"
              placeholder="Judul tugas..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Deskripsi</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-y"
              placeholder="Deskripsi tugas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Prioritas</label>
            <div className="flex gap-2 mt-1.5">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    priority === opt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Division selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Divisi (opsional, auto-route berdasarkan tipe)</label>
            <select
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={effectiveDivisionId}
              onChange={(e) => setDivisionId(e.target.value)}
            >
              <option value="">Auto-route</option>
              {divisions.filter(d => d.isActive).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.icon || '🏢'} {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Due date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tenggat Waktu (opsional)</label>
            <Input
              type="date"
              className="mt-1"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" className="rounded-lg" onClick={resetAndClose}>
            Batal
          </Button>
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting ? 'Menyimpan...' : 'Buat Tugas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== WORK ITEM DETAIL VIEW ====================
function WorkItemDetailView({
  item,
  onBack,
  onStatusChange,
  onAssignToMe,
  isUpdating,
}: {
  item: WorkItem
  onBack: () => void
  onStatusChange: (itemId: string, newStatus: string) => void
  onAssignToMe: (itemId: string) => void
  isUpdating: boolean
}) {
  const [confirmAction, setConfirmAction] = useState<{ status: string; label: string } | null>(null)
  const statusColor = getStatusColor(item.status)
  const priorityColor = getPriorityColor(item.priority)
  const typeDisplay = WORK_TYPE_DISPLAY[item.type]

  const actionButtons: Record<string, Array<{ status: string; label: string; icon: React.ReactNode; variant: string }>> = {
    open: [
      { status: 'in_progress', label: 'Mulai Kerjakan', icon: <ArrowUpCircle className="w-4 h-4" />, variant: 'primary' },
      { status: 'closed', label: 'Tutup', icon: <XCircle className="w-4 h-4" />, variant: 'outline' },
    ],
    in_progress: [
      { status: 'resolved', label: 'Selesaikan', icon: <CheckCircle2 className="w-4 h-4" />, variant: 'primary' },
      { status: 'escalated', label: 'Eskalasi', icon: <AlertTriangle className="w-4 h-4" />, variant: 'warning' },
      { status: 'closed', label: 'Tutup', icon: <XCircle className="w-4 h-4" />, variant: 'outline' },
    ],
    escalated: [
      { status: 'in_progress', label: 'Kerjakan Lagi', icon: <ArrowUpCircle className="w-4 h-4" />, variant: 'primary' },
      { status: 'resolved', label: 'Selesaikan', icon: <CheckCircle2 className="w-4 h-4" />, variant: 'primary' },
      { status: 'closed', label: 'Tutup', icon: <XCircle className="w-4 h-4" />, variant: 'outline' },
    ],
    resolved: [
      { status: 'closed', label: 'Tutup', icon: <XCircle className="w-4 h-4" />, variant: 'outline' },
    ],
  }

  const actions = actionButtons[item.status] || []

  const getVariantStyle = (variant: string) => {
    switch (variant) {
      case 'primary': return 'bg-emerald-500 hover:bg-emerald-600 text-white'
      case 'warning': return 'bg-amber-500 hover:bg-amber-600 text-white'
      default: return ''
    }
  }

  return (
    <div className="pb-20">
      <PageHeader title="Detail Tugas" onBack={onBack} />

      <div className="px-4 space-y-4">
        {/* Header badges */}
        <motion.div {...fadeIn}>
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-orange-50 dark:bg-orange-900/30 flex-shrink-0">
                {typeDisplay?.icon || '📋'}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-foreground">{item.title}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{typeDisplay?.label || item.type}</Badge>
                  <Badge className={`text-[10px] ${priorityColor}`}>{WORK_PRIORITY_DISPLAY[item.priority]?.label || item.priority}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${statusColor}`}>{WORK_STATUS_DISPLAY[item.status]?.label || item.status}</Badge>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Description */}
        {item.description && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Deskripsi" icon={<ClipboardList className="w-4 h-4" />} />
            <Card className="p-4 mt-2">
              <p className="text-sm text-foreground whitespace-pre-wrap">{item.description}</p>
            </Card>
          </motion.div>
        )}

        {/* Division info */}
        {item.division && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Divisi" icon={<Building2 className="w-4 h-4" />} />
            <Card className="p-4 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-emerald-50 dark:bg-emerald-900/30">
                  {item.division.icon || '🏢'}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.division.name}</p>
                  <p className="text-xs text-muted-foreground">{item.division.slug}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Assignee */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Pekerja" icon={<User className="w-4 h-4" />} />
          <Card className="p-4 mt-2">
            {item.assignee ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-sm">
                  {item.assignee.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.assignee.name}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Belum ditugaskan</p>
                <Button
                  size="sm"
                  className="h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => onAssignToMe(item.id)}
                  disabled={isUpdating}
                >
                  <User className="w-3 h-3 mr-1" /> Assign ke Saya
                </Button>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Reference info */}
        {item.refType && item.refId && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Referensi" icon={<Package className="w-4 h-4" />} />
            <Card className="p-4 mt-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{item.refType}</Badge>
                <span className="text-xs text-muted-foreground">ID:</span>
                <span className="text-xs font-mono text-foreground">{item.refId}</span>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Metadata */}
        {item.metadata && Object.keys(item.metadata).length > 0 && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Metadata" icon={<Filter className="w-4 h-4" />} />
            <Card className="p-4 mt-2">
              <div className="space-y-2">
                {Object.entries(item.metadata).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="text-xs font-medium text-foreground">{String(value)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Resolution notes */}
        {item.resolution && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Catatan Resolusi" icon={<CheckCircle2 className="w-4 h-4" />} />
            <Card className="p-4 mt-2">
              <p className="text-sm text-foreground whitespace-pre-wrap">{item.resolution}</p>
            </Card>
          </motion.div>
        )}

        {/* Timestamps */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Waktu" icon={<Clock className="w-4 h-4" />} />
          <Card className="p-4 mt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Dibuat</span>
                <span className="text-xs font-medium text-foreground">{formatRelativeTime(item.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Diperbarui</span>
                <span className="text-xs font-medium text-foreground">{formatRelativeTime(item.updatedAt)}</span>
              </div>
              {item.resolvedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Diselesaikan</span>
                  <span className="text-xs font-medium text-foreground">{formatRelativeTime(item.resolvedAt)}</span>
                </div>
              )}
              {item.dueDate && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tenggat</span>
                  <span className="text-xs font-medium text-foreground">{new Date(item.dueDate).toLocaleDateString('id-ID')}</span>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Action buttons */}
        {actions.length > 0 && (
          <motion.div {...fadeIn}>
            <div className="space-y-2">
              {actions.map((action) => (
                <Button
                  key={action.status}
                  className={`w-full h-11 rounded-lg text-sm font-medium ${getVariantStyle(action.variant)}`}
                  variant={action.variant === 'outline' ? 'outline' : undefined}
                  onClick={() => setConfirmAction({ status: action.status, label: action.label })}
                  disabled={isUpdating}
                >
                  {action.icon}
                  <span className="ml-2">{action.label}</span>
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Confirm action dialog */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            onStatusChange(item.id, confirmAction.status)
          }
          setConfirmAction(null)
        }}
        title={confirmAction?.label || 'Konfirmasi'}
        message={`Apakah Anda yakin ingin ${confirmAction?.label?.toLowerCase()} tugas ini?`}
        confirmLabel={confirmAction?.label || 'Konfirmasi'}
        variant={confirmAction?.status === 'closed' ? 'danger' : confirmAction?.status === 'escalated' ? 'warning' : 'info'}
      />
    </div>
  )
}

// ==================== DIVISION QUEUE VIEW ====================
function DivisionQueueView({
  division,
  onBack,
  onSelectItem,
  workItems,
  counts,
  loading,
}: {
  division: Division
  onBack: () => void
  onSelectItem: (item: WorkItem) => void
  workItems: WorkItem[]
  counts: Record<string, number>
  loading: boolean
}) {
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredItems = statusFilter === 'all'
    ? workItems
    : workItems.filter(item => item.status === statusFilter)

  const openCount = workItems.filter(i => i.status === 'open').length
  const inProgressCount = workItems.filter(i => i.status === 'in_progress').length
  const resolvedCount = workItems.filter(i => i.status === 'resolved').length

  return (
    <div className="pb-20">
      <PageHeader title={division.name} onBack={onBack} />

      <div className="px-4 space-y-4">
        {/* Division header */}
        <motion.div {...fadeIn}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-emerald-50 dark:bg-emerald-900/30">
                {division.icon || '🏢'}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">{division.name}</h2>
                {division.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{division.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-blue-500 text-white text-[10px]">{openCount} terbuka</Badge>
                  <Badge variant="outline" className="text-[10px]">{inProgressCount} dikerjakan</Badge>
                  <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-600">{resolvedCount} selesai</Badge>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {statusTabs.map((tab) => {
            const tabCount = tab.key === 'all'
              ? workItems.length
              : workItems.filter(i => i.status === tab.key).length
            return (
              <motion.button
                key={tab.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                  statusFilter === tab.key
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                {tab.label} ({tabCount})
              </motion.button>
            )
          })}
        </div>

        {/* Work items list */}
        <div className="space-y-2">
          {loading ? (
            <LoadingSpinner message="Memuat tugas..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Tugas"
              subtitle="Belum ada tugas untuk divisi ini"
            />
          ) : (
            filteredItems.map((item, i) => {
              const typeDisplay = WORK_TYPE_DISPLAY[item.type]
              const priorityColor = getPriorityColor(item.priority)
              const statusColor = getStatusColor(item.status)
              return (
                <motion.div key={item.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card
                    className="p-3 cursor-pointer hover:shadow-sm transition-all border-border/50"
                    onClick={() => onSelectItem(item)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base bg-orange-50 dark:bg-orange-900/30 flex-shrink-0">
                        {typeDisplay?.icon || '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate text-foreground">{item.title}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[9px]">{typeDisplay?.label || item.type}</Badge>
                          <Badge className={`text-[9px] ${priorityColor}`}>{WORK_PRIORITY_DISPLAY[item.priority]?.label || item.priority}</Badge>
                          <Badge variant="outline" className={`text-[9px] ${statusColor}`}>{WORK_STATUS_DISPLAY[item.status]?.label || item.status}</Badge>
                        </div>
                        {item.assignee && (
                          <p className="text-[10px] text-muted-foreground mt-1">👤 {item.assignee.name}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatRelativeTime(item.createdAt)}</span>
                    </div>
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

// ==================== MAIN ADMIN WORKFLOW SCREEN ====================
export function AdminWorkflow() {
  const { divisions, fetchDivisions, showToast } = useAppStore()
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null)
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Fetch work items
  const fetchWorkItems = useCallback(async (divisionId?: string, status?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (divisionId) params.set('divisionId', divisionId)
      if (status && status !== 'all') params.set('status', status)
      params.set('limit', '200')
      const res = await fetch(`/api/admin/work-items?${params.toString()}`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setWorkItems(data.data || [])
        setCounts(data.counts || {})
      }
    } catch {
      showToast('Gagal memuat tugas', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // Fetch on mount
  useEffect(() => {
    fetchDivisions()
    fetchWorkItems()
  }, [fetchDivisions, fetchWorkItems])

  // Fetch division-specific items when a division is selected
  useEffect(() => {
    if (selectedDivision && !selectedItem) {
      fetchWorkItems(selectedDivision.id)
    }
  }, [selectedDivision, selectedItem, fetchWorkItems])

  // Compute summary counts from all work items
  const totalTasks = workItems.length
  const openCount = workItems.filter(i => i.status === 'open').length
  const inProgressCount = workItems.filter(i => i.status === 'in_progress').length
  const resolvedCount = workItems.filter(i => i.status === 'resolved').length

  // Count items per division
  const divisionWorkCounts: Record<string, { open: number; inProgress: number; total: number }> = {}
  for (const item of workItems) {
    if (!divisionWorkCounts[item.divisionId]) {
      divisionWorkCounts[item.divisionId] = { open: 0, inProgress: 0, total: 0 }
    }
    divisionWorkCounts[item.divisionId].total++
    if (item.status === 'open') divisionWorkCounts[item.divisionId].open++
    if (item.status === 'in_progress') divisionWorkCounts[item.divisionId].inProgress++
  }

  // Navigate to division queue
  const showDivisionQueue = (division: Division) => {
    setSelectedDivision(division)
    setSelectedItem(null)
  }

  // Navigate to item detail
  const showDetail = (item: WorkItem) => {
    setSelectedItem(item)
  }

  // Status change handler
  const handleStatusChange = async (itemId: string, newStatus: string) => {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/admin/work-items`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ workItemId: itemId, status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Status diperbarui ke ${WORK_STATUS_DISPLAY[newStatus]?.label || newStatus}`, 'success')
        // Refresh data
        if (selectedDivision) {
          await fetchWorkItems(selectedDivision.id)
        } else {
          await fetchWorkItems()
        }
        // Update selected item if it's the one being changed
        if (selectedItem && selectedItem.id === itemId) {
          const updatedItem = data.data || { ...selectedItem, status: newStatus, updatedAt: new Date().toISOString() }
          setSelectedItem(updatedItem)
        }
      } else {
        showToast(data.error || 'Gagal memperbarui status', 'error')
      }
    } catch {
      showToast('Gagal memperbarui status', 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  // Assign to me handler
  const handleAssignToMe = async (itemId: string) => {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/admin/work-items`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ workItemId: itemId, assignToSelf: true }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Tugas ditugaskan ke Anda', 'success')
        if (selectedDivision) {
          await fetchWorkItems(selectedDivision.id)
        } else {
          await fetchWorkItems()
        }
        if (selectedItem && selectedItem.id === itemId) {
          const updatedItem = data.data || selectedItem
          setSelectedItem(updatedItem)
        }
      } else {
        showToast(data.error || 'Gagal menugaskan', 'error')
      }
    } catch {
      showToast('Gagal menugaskan', 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  // Create work item handler
  const handleCreateWorkItem = async (formData: {
    type: string
    title: string
    description: string
    priority: string
    divisionId: string
    dueDate: string
  }) => {
    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        type: formData.type,
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
      }
      if (formData.divisionId) {
        body.divisionId = formData.divisionId
      }
      const res = await fetch('/api/admin/work-items', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Tugas berhasil dibuat', 'success')
        setShowCreateDialog(false)
        // Refresh data
        if (selectedDivision) {
          await fetchWorkItems(selectedDivision.id)
        } else {
          await fetchWorkItems()
        }
      } else {
        showToast(data.error || 'Gagal membuat tugas', 'error')
      }
    } catch {
      showToast('Gagal membuat tugas', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show work item detail view
  if (selectedItem) {
    return (
      <WorkItemDetailView
        item={selectedItem}
        onBack={() => setSelectedItem(null)}
        onStatusChange={handleStatusChange}
        onAssignToMe={handleAssignToMe}
        isUpdating={isUpdating}
      />
    )
  }

  // Show division queue view
  if (selectedDivision) {
    return (
      <DivisionQueueView
        division={selectedDivision}
        onBack={() => {
          setSelectedDivision(null)
          fetchWorkItems() // Re-fetch all items when going back to overview
        }}
        onSelectItem={showDetail}
        workItems={workItems}
        counts={counts}
        loading={loading}
      />
    )
  }

  // ==================== OVERVIEW VIEW ====================
  return (
    <div className="pb-20">
      <PageHeader
        title="Alur Kerja Divisi"
        showBack={false}
        rightAction={
          <Button
            size="sm"
            className="h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Buat Tugas
          </Button>
        }
      />

      <div className="px-4 space-y-4">
        {/* Summary cards */}
        <motion.div {...fadeIn} className="grid grid-cols-4 gap-2">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{totalTasks}</p>
            <p className="text-[9px] text-emerald-600 font-medium">Total Tugas</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-blue-600">{openCount}</p>
            <p className="text-[9px] text-blue-600 font-medium">Terbuka</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-orange-600">{inProgressCount}</p>
            <p className="text-[9px] text-orange-600 font-medium">Dikerjakan</p>
          </div>
          <div className="bg-teal-50 dark:bg-teal-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-teal-600">{resolvedCount}</p>
            <p className="text-[9px] text-teal-600 font-medium">Diselesaikan</p>
          </div>
        </motion.div>

        {/* Division cards */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Antrian Divisi" icon={<Building2 className="w-4 h-4" />} />
        </motion.div>

        <div className="space-y-2">
          {loading ? (
            <LoadingSpinner message="Memuat divisi..." />
          ) : divisions.filter(d => d.isActive).length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-10 h-10 text-muted-foreground" />}
              title="Belum Ada Divisi"
              subtitle="Buat divisi terlebih dahulu untuk mengelola alur kerja"
            />
          ) : (
            divisions.filter(d => d.isActive).map((division, i) => {
              const wc = divisionWorkCounts[division.id] || { open: 0, inProgress: 0, total: 0 }
              return (
                <motion.div key={division.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card
                    className="p-4 cursor-pointer hover:shadow-md transition-all border-border/50"
                    onClick={() => showDivisionQueue(division)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-emerald-50 dark:bg-emerald-900/30 flex-shrink-0">
                        {division.icon || '🏢'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-foreground">{division.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-blue-500 text-white text-[10px]">{wc.open} terbuka</Badge>
                          <Badge variant="outline" className="text-[10px]">{wc.inProgress} dikerjakan</Badge>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Card>
                </motion.div>
              )
            })
          )}
        </div>

        {/* Unassigned / recent items */}
        {workItems.length > 0 && (
          <motion.div {...fadeIn}>
            <SectionHeader
              title="Tugas Terbaru"
              icon={<ClipboardList className="w-4 h-4" />}
              actionLabel="Lihat Semua"
              onAction={() => {}}
            />
            <div className="space-y-2 mt-3 max-h-96 overflow-y-auto">
              {workItems
                .filter(i => i.status === 'open' || i.status === 'in_progress')
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10)
                .map((item, i) => {
                  const typeDisplay = WORK_TYPE_DISPLAY[item.type]
                  const priorityColor = getPriorityColor(item.priority)
                  const statusColor = getStatusColor(item.status)
                  return (
                    <motion.div key={item.id} custom={i} variants={stagger} initial="initial" animate="animate">
                      <Card
                        className="p-3 cursor-pointer hover:shadow-sm transition-all border-border/50"
                        onClick={() => showDetail(item)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base bg-orange-50 dark:bg-orange-900/30 flex-shrink-0">
                            {typeDisplay?.icon || '📋'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-[9px]">{typeDisplay?.label || item.type}</Badge>
                              <Badge className={`text-[9px] ${priorityColor}`}>{WORK_PRIORITY_DISPLAY[item.priority]?.label || item.priority}</Badge>
                              <Badge variant="outline" className={`text-[9px] ${statusColor}`}>{WORK_STATUS_DISPLAY[item.status]?.label || item.status}</Badge>
                            </div>
                            {item.assignee && (
                              <p className="text-[10px] text-muted-foreground mt-1">👤 {item.assignee.name}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatRelativeTime(item.createdAt)}</span>
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Create Work Item Dialog */}
      <CreateWorkItemDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        divisions={divisions}
        onSubmit={handleCreateWorkItem}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
