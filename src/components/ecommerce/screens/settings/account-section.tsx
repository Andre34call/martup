"use client"

import { motion } from "framer-motion"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fadeIn } from '@/lib/animations'

// ==================== ACCOUNT SECTION (DELETE) ====================
export function AccountSection({
  onDeleteAccount,
}: {
  onDeleteAccount: () => void
}) {
  return (
    <motion.div {...fadeIn} className="pt-2 pb-4">
      <Button variant="outline" onClick={onDeleteAccount} className="w-full h-11 rounded-xl text-red-500 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20">
        <Trash2 className="w-4 h-4 mr-2" /> Hapus Akun
      </Button>
    </motion.div>
  )
}
