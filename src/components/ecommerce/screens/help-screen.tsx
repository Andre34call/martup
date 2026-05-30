"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { PageHeader, EmptyState, SearchBar } from "../shared"
import { useState } from "react"
import { HelpCircle, ChevronDown, ChevronUp, Phone, Package, CreditCard, MapPin, RotateCcw, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { stagger } from '@/lib/animations'

export function HelpScreen() {
  const { showToast, navigate } = useAppStore()
  const [searchHelp, setSearchHelp] = useState("")
  const [openSection, setOpenSection] = useState<string | null>(null)

  const faqSections = [
    {
      key: "orders",
      title: "Pesanan",
      icon: <Package className="w-4 h-4" />,
      questions: [
        { q: "Bagaimana cara melacak pesanan?", a: "Buka menu Pesanan, pilih pesanan yang ingin dilacak, lalu klik 'Lacak Pesanan' untuk melihat status pengiriman real-time." },
        { q: "Berapa lama estimasi pengiriman?", a: "Estimasi pengiriman tergantung lokasi dan kurir yang dipilih, biasanya 1-5 hari kerja untuk wilayah Jawa dan 3-7 hari kerja untuk luar Jawa." },
        { q: "Bagaimana cara membatalkan pesanan?", a: "Pesanan bisa dibatalkan sebelum seller memproses. Buka detail pesanan dan klik 'Batalkan Pesanan'." },
        { q: "Apa yang harus dilakukan jika pesanan tidak datang?", a: "Hubungi seller melalui fitur chat atau ajukan pengembalian jika melewati batas waktu pengiriman." },
      ]
    },
    {
      key: "payment",
      title: "Pembayaran",
      icon: <CreditCard className="w-4 h-4" />,
      questions: [
        { q: "Metode pembayaran apa saja yang tersedia?", a: "Kami menerima transfer bank, e-wallet (GoPay, OVO, DANA), kartu kredit/debit, dan COD." },
        { q: "Bagaimana jika pembayaran gagal?", a: "Pastikan saldo mencukupi dan koneksi stabil. Coba lagi atau gunakan metode pembayaran lain. Jika sudah terdeduk, hubungi CS." },
        { q: "Apakah bisa paylater?", a: "Ya, kami mendukung paylater melalui mitra tertentu. Pilih opsi paylater saat checkout." },
      ]
    },
    {
      key: "shipping",
      title: "Pengiriman",
      icon: <MapPin className="w-4 h-4" />,
      questions: [
        { q: "Kurir apa saja yang tersedia?", a: "JNE, SiCepat, J&T, AnterAja, dan Tiki tersedia untuk pengiriman." },
        { q: "Apakah ada gratis ongkir?", a: "Gratis ongkir tersedia untuk produk tertentu dan saat menggunakan voucher gratis ongkir." },
        { q: "Bisa ganti alamat setelah checkout?", a: "Hubungi seller sesegera mungkin melalui chat. Jika belum diproses, alamat masih bisa diubah." },
      ]
    },
    {
      key: "refund",
      title: "Pengembalian",
      icon: <RotateCcw className="w-4 h-4" />,
      questions: [
        { q: "Bagaimana cara mengajukan pengembalian?", a: "Buka pesanan yang sudah selesai, klik 'Ajukan Pengembalian' dan isi formulir pengembalian." },
        { q: "Berapa lama proses refund?", a: "Proses refund membutuhkan 3-7 hari kerja setelah barang diterima seller dan diverifikasi." },
        { q: "Apakah bisa return jika sudah buka packaging?", a: "Ya, selama kondisi barang masih baik dan dalam masa garansi return 7 hari." },
      ]
    },
    {
      key: "account",
      title: "Akun",
      icon: <Shield className="w-4 h-4" />,
      questions: [
        { q: "Bagaimana cara reset password?", a: "Klik 'Lupa Password' di halaman login, masukkan email, dan ikuti petunjuk di email." },
        { q: "Apakah bisa punya lebih dari satu akun?", a: "Satu nomor HP hanya bisa terdaftar pada satu akun. Gunakan fitur switch role untuk berbagai kebutuhan." },
        { q: "Bagaimana cara menghapus akun?", a: "Buka Pengaturan > scroll ke bawah > klik 'Hapus Akun'. Tindakan ini tidak bisa dibatalkan." },
      ]
    },
  ]

  const filteredSections = searchHelp.trim()
    ? faqSections.filter(section =>
        section.title.toLowerCase().includes(searchHelp.toLowerCase()) ||
        section.questions.some(q =>
          q.q.toLowerCase().includes(searchHelp.toLowerCase()) ||
          q.a.toLowerCase().includes(searchHelp.toLowerCase())
        )
      )
    : faqSections

  const handleContactCS = () => {
    showToast("Menghubungi Customer Service...", "info")
    navigate("chat")
  }

  return (
    <div className="pb-24">
      <PageHeader title="Pusat Bantuan" />

      <div className="px-4 space-y-4">
        <SearchBar value={searchHelp} onChange={setSearchHelp} placeholder="Cari pertanyaan..." />

        <div className="space-y-2">
          {filteredSections.map((section, i) => (
            <motion.div key={section.key} custom={i} variants={stagger} initial="initial" animate="animate">
              <Card className="overflow-hidden">
                <button
                  onClick={() => setOpenSection(openSection === section.key ? null : section.key)}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                      {section.icon}
                    </div>
                    <span className="text-sm font-medium text-foreground">{section.title}</span>
                  </div>
                  {openSection === section.key ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {openSection === section.key && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 pb-4 space-y-3">
                    {section.questions
                      .filter(q =>
                        !searchHelp.trim() ||
                        q.q.toLowerCase().includes(searchHelp.toLowerCase()) ||
                        q.a.toLowerCase().includes(searchHelp.toLowerCase())
                      )
                      .map((q, idx) => (
                      <div key={idx} className="pl-12">
                        <p className="text-sm font-medium text-foreground">{q.q}</p>
                        <p className="text-xs text-muted-foreground mt-1">{q.a}</p>
                        {idx < section.questions.length - 1 && <Separator className="mt-3" />}
                      </div>
                    ))}
                  </motion.div>
                )}
              </Card>
            </motion.div>
          ))}
          {filteredSections.length === 0 && (
            <EmptyState
              icon={<HelpCircle className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ditemukan"
              subtitle="Coba kata kunci lain untuk menemukan bantuan"
            />
          )}
        </div>

        <Button onClick={handleContactCS} className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-11">
          <Phone className="w-4 h-4 mr-2" /> Hubungi CS
        </Button>
      </div>
    </div>
  )
}
