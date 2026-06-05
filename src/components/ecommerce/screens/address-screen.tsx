"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { stagger } from '@/lib/animations'
import { PageHeader, SectionHeader, PrimaryButton } from "../shared"
import { useState, useEffect, useRef, useCallback } from "react"
import { Plus, Edit, Trash2, MapPin, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

// ==================== CITY TYPE FROM RAJAONGKIR ====================
interface CityOption {
  id: string
  name: string
  type: string
  province: string
  postalCode: string
}

// ==================== CITY AUTOCOMPLETE INPUT ====================
function CityAutocomplete({
  value,
  onChange,
  onCitySelect,
  placeholder
}: {
  value: string
  onChange: (val: string) => void
  onCitySelect: (city: CityOption) => void
  placeholder: string
}) {
  const [cityResults, setCityResults] = useState<CityOption[]>([])
  const [isSearchingCity, setIsSearchingCity] = useState(false)
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced search
  const searchCities = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCityResults([])
      setShowCityDropdown(false)
      return
    }

    setIsSearchingCity(true)
    try {
      const res = await fetch(`/api/shipping/cities?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setCityResults(data.data)
        setShowCityDropdown(data.data.length > 0)
        setSelectedIndex(-1)
      } else {
        setCityResults([])
        setShowCityDropdown(false)
      }
    } catch {
      setCityResults([])
      setShowCityDropdown(false)
    } finally {
      setIsSearchingCity(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    setSelectedIndex(-1)

    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchCities(val)
    }, 300)
  }

  const handleSelectCity = (city: CityOption) => {
    // Format: capitalize city name properly from RajaOngkir data
    const cityName = city.type
      ? `${city.type.charAt(0).toUpperCase() + city.type.slice(1)} ${city.name.charAt(0).toUpperCase() + city.name.slice(1)}`
      : city.name.charAt(0).toUpperCase() + city.name.slice(1)

    onChange(cityName)
    onCitySelect(city)
    setShowCityDropdown(false)
    setCityResults([])
    setSelectedIndex(-1)
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showCityDropdown || cityResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, cityResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSelectCity(cityResults[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowCityDropdown(false)
    }
  }

  // Click outside closes dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (cityResults.length > 0) setShowCityDropdown(true)
          }}
          placeholder={placeholder}
          className="rounded-xl h-9 pr-8"
          autoComplete="off"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {isSearchingCity ? (
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showCityDropdown && cityResults.length > 0 && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto"
          >
            {cityResults.map((city, idx) => (
              <button
                key={city.id}
                type="button"
                onClick={() => handleSelectCity(city)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  idx === selectedIndex
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                    : 'hover:bg-muted/50 text-foreground'
                } ${idx !== cityResults.length - 1 ? 'border-b border-border/30' : ''}`}
              >
                <span className="font-medium">
                  {city.type.charAt(0).toUpperCase() + city.type.slice(1)} {city.name.charAt(0).toUpperCase() + city.name.slice(1)}
                </span>
                <span className="text-muted-foreground ml-1.5">
                  — {city.province.charAt(0).toUpperCase() + city.province.slice(1)}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================
export function AddressScreen() {
  const { addresses, addAddress, updateAddress, deleteAddress, setDefaultAddress, showToast } = useAppStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formLabel, setFormLabel] = useState("")
  const [formRecipient, setFormRecipient] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formAddress, setFormAddress] = useState("")
  const [formCity, setFormCity] = useState("")
  const [formProvince, setFormProvince] = useState("")
  const [formPostalCode, setFormPostalCode] = useState("")

  const resetForm = () => {
    setFormLabel("")
    setFormRecipient("")
    setFormPhone("")
    setFormAddress("")
    setFormCity("")
    setFormProvince("")
    setFormPostalCode("")
    setEditingId(null)
  }

  const handleEdit = (addr: typeof addresses[0]) => {
    setEditingId(addr.id)
    setFormLabel(addr.label)
    setFormRecipient(addr.recipient)
    setFormPhone(addr.phone)
    setFormAddress(addr.address)
    setFormCity(addr.city)
    setFormProvince(addr.province)
    setFormPostalCode(addr.postalCode)
    setShowAddForm(true)
  }

  const [isSaving, setIsSaving] = useState(false)

  // Handle city selection from RajaOngkir autocomplete
  const handleCitySelect = (city: CityOption) => {
    // Auto-fill province when a city is selected
    const provinceName = city.province.charAt(0).toUpperCase() + city.province.slice(1)
    setFormProvince(provinceName)
    // Auto-fill postal code if available and form is empty
    if (city.postalCode && !formPostalCode) {
      setFormPostalCode(city.postalCode)
    }
  }

  const handleSaveAddress = async () => {
    if (!formLabel.trim() || !formRecipient.trim() || !formPhone.trim() || !formAddress.trim() || !formCity.trim() || !formProvince.trim() || !formPostalCode.trim()) {
      showToast("Semua field wajib diisi", "error")
      return
    }

    // Validate phone format (Indonesian: starts with 0 or +62, 10-15 digits)
    const phoneDigits = formPhone.replace(/[^\d+]/g, '')
    if (!/^(0\d{9,14}|\+62\d{9,14})$/.test(phoneDigits)) {
      showToast("Format nomor HP tidak valid (gunakan 08xx atau +628xx, 10-15 digit)", "error")
      return
    }

    // Validate postal code (exactly 5 digits)
    if (!/^\d{5}$/.test(formPostalCode.trim())) {
      showToast("Kode pos harus 5 digit angka", "error")
      return
    }

    setIsSaving(true)
    try {
      if (editingId) {
        const existingAddr = addresses.find(a => a.id === editingId)
        await updateAddress({
          id: editingId,
          label: formLabel,
          recipient: formRecipient,
          phone: formPhone,
          address: formAddress,
          city: formCity,
          province: formProvince,
          postalCode: formPostalCode,
          isDefault: existingAddr?.isDefault || false,
        })
        showToast("Alamat berhasil diperbarui!", "success")
      } else {
        await addAddress({
          label: formLabel,
          recipient: formRecipient,
          phone: formPhone,
          address: formAddress,
          city: formCity,
          province: formProvince,
          postalCode: formPostalCode,
          isDefault: addresses.length === 0,
        })
        showToast("Alamat berhasil ditambahkan!", "success")
      }
      resetForm()
      setShowAddForm(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan alamat"
      showToast(message, "error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultAddress(id)
      showToast("Alamat utama berhasil diubah!", "success")
    } catch {
      showToast("Gagal mengubah alamat utama", "error")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAddress(id)
      showToast("Alamat berhasil dihapus", "success")
    } catch {
      showToast("Gagal menghapus alamat", "error")
    }
  }

  const handleToggleAddForm = () => {
    if (showAddForm) {
      resetForm()
    }
    setShowAddForm(!showAddForm)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader title="Alamat" rightAction={
        <PrimaryButton
          onClick={handleToggleAddForm}
          className="rounded-xl h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> {editingId ? "Edit" : "Tambah"}
        </PrimaryButton>
      } />

      <div className="flex-1 px-4 space-y-4 pb-28 overflow-y-auto">
        {/* Address List */}
        <div className="space-y-3">
          {addresses.length === 0 && !showAddForm && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MapPin className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Belum ada alamat</p>
              <p className="text-xs text-muted-foreground mt-1">Tambahkan alamat pertamamu</p>
            </div>
          )}
          {addresses.map((addr, i) => (
            <motion.div key={addr.id} custom={i} variants={stagger} initial="initial" animate="animate">
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${addr.isDefault ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {addr.label}
                    </Badge>
                    {addr.isDefault && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Utama</Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground mt-2">{addr.recipient}</p>
                <p className="text-xs text-muted-foreground">{addr.phone}</p>
                <p className="text-xs text-muted-foreground mt-1">{addr.address}, {addr.city}, {addr.province} {addr.postalCode}</p>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => handleEdit(addr)}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  {!addr.isDefault && (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-emerald-600" onClick={() => handleSetDefault(addr.id)}>
                      Utamakan
                    </Button>
                  )}
                  {!addr.isDefault && (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => handleDelete(addr.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Add/Edit Address Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <SectionHeader title={editingId ? "Edit Alamat" : "Tambah Alamat Baru"} icon={<Plus className="w-4 h-4" />} />
              <Card className="mt-3 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Label <span className="text-red-500">*</span></label>
                    <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Rumah" className="rounded-xl h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Penerima <span className="text-red-500">*</span></label>
                    <Input value={formRecipient} onChange={(e) => setFormRecipient(e.target.value)} placeholder="Nama" className="rounded-xl h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">No. Telepon <span className="text-red-500">*</span></label>
                  <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="08123456789" className="rounded-xl h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Alamat Lengkap <span className="text-red-500">*</span></label>
                  <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Jl. ..." className="rounded-xl h-9" />
                </div>

                {/* City + Province + Postal Code with RajaOngkir autocomplete */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Kota <span className="text-red-500">*</span></label>
                    <CityAutocomplete
                      value={formCity}
                      onChange={setFormCity}
                      onCitySelect={handleCitySelect}
                      placeholder="Cari kota..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Provinsi <span className="text-red-500">*</span></label>
                    <Input
                      value={formProvince}
                      onChange={(e) => setFormProvince(e.target.value)}
                      placeholder="DKI Jakarta"
                      className="rounded-xl h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Kode Pos <span className="text-red-500">*</span></label>
                    <Input value={formPostalCode} onChange={(e) => setFormPostalCode(e.target.value)} placeholder="12345" className="rounded-xl h-9" />
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Ketik nama kota untuk mencari dari database RajaOngkir. Provinsi akan terisi otomatis saat kota dipilih.
                </p>

                <PrimaryButton onClick={handleSaveAddress} className="w-full rounded-xl h-10">
                  {isSaving ? 'Menyimpan...' : 'Simpan Alamat'}
                </PrimaryButton>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Button */}
      {!showAddForm && (
        <div className="fixed bottom-6 right-4 z-50 sm:hidden">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleAddForm}
            className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center"
          >
            <Plus className="w-6 h-6" />
          </motion.button>
          <span className="block text-center text-[10px] font-medium text-muted-foreground mt-1">Tambah</span>
        </div>
      )}
    </div>
  )
}
