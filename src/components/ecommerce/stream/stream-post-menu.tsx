"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Pencil,
  Trash2,
  Lock,
  Unlock,
  Copy,
  Link2,
  Flag,
  User,
} from "lucide-react"
import { StreamPost } from "./stream-types"

interface PostActionMenuProps {
  post: StreamPost
  currentUserId: string | null
  isOpen: boolean
  onClose: () => void
  onEdit: (post: StreamPost) => void
  onDelete: (post: StreamPost) => void
  onTogglePrivate: (post: StreamPost) => void
  onCopyLink: (post: StreamPost) => void
  onReport?: (post: StreamPost) => void
  onViewProfile?: (userId: string) => void
}

// ==================== POST ACTION MENU ====================
export function PostActionMenu({
  post,
  currentUserId,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onTogglePrivate,
  onCopyLink,
  onReport,
  onViewProfile,
}: PostActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  const isOwner = currentUserId === post.userId

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, onClose])

  const menuItems = [
    // Owner-only actions
    ...(isOwner
      ? [
          {
            key: "edit",
            label: "Edit Postingan",
            icon: Pencil,
            color: "text-foreground",
            hoverBg: "hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
            onClick: () => { onEdit(post); onClose() },
          },
          {
            key: "private",
            label: post.isPrivate ? "Buat Publik" : "Buat Privat",
            icon: post.isPrivate ? Unlock : Lock,
            color: post.isPrivate ? "text-emerald-600" : "text-amber-600",
            hoverBg: "hover:bg-amber-50 dark:hover:bg-amber-950/30",
            onClick: () => { onTogglePrivate(post); onClose() },
          },
          {
            key: "delete",
            label: "Hapus Postingan",
            icon: Trash2,
            color: "text-red-500",
            hoverBg: "hover:bg-red-50 dark:hover:bg-red-950/30",
            onClick: () => { onDelete(post); onClose() },
          },
        ]
      : []),
    // Public actions
    ...(onViewProfile && !isOwner
      ? [
          {
            key: "viewprofile",
            label: "Lihat Profil",
            icon: User,
            color: "text-foreground",
            hoverBg: "hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
            onClick: () => { onViewProfile(post.userId); onClose() },
          },
        ]
      : []),
    {
      key: "copylink",
      label: "Salin Link",
      icon: Link2,
      color: "text-foreground",
      hoverBg: "hover:bg-muted/50",
      onClick: () => { onCopyLink(post); onClose() },
    },
    // Report (non-owners only)
    ...(!isOwner && onReport
      ? [
          {
            key: "report",
            label: "Laporkan",
            icon: Flag,
            color: "text-red-500",
            hoverBg: "hover:bg-red-50 dark:hover:bg-red-950/30",
            onClick: () => { onReport(post); onClose() },
          },
        ]
      : []),
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[55]"
          />

          {/* Menu */}
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-4 top-12 z-[60] min-w-[200px] bg-popover border border-border rounded-xl shadow-xl overflow-hidden"
          >
            <div className="py-1">
              {menuItems.map((item, idx) => (
                <motion.button
                  key={item.key}
                  whileTap={{ scale: 0.98 }}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${item.color} ${item.hoverBg} transition-colors`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </motion.button>
              ))}
            </div>

            {/* Private badge info */}
            {isOwner && post.isPrivate && (
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Postingan privat — hanya kamu yang bisa lihat
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
