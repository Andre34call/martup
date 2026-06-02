"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
import { useState, useCallback } from "react"
import { pageVariants, pageTransition } from "./shared"

// ==================== ONBOARDING SCREEN ====================
const onboardingSlides = [
  {
    emoji: "🛍️",
    title: "Temukan Produk Terbaik",
    description: "Jutaan produk berkualitas dari seller terpercaya",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    emoji: "💰",
    title: "Harga Terbaik & Promo",
    description: "Flash sale, voucher, dan cashback setiap hari",
    gradient: "from-orange-400 to-amber-500",
  },
  {
    emoji: "🚀",
    title: "Pengiriman Cepat",
    description: "Tracking real-time dan pengiriman ke seluruh Indonesia",
    gradient: "from-cyan-400 to-blue-500",
  },
]

export function OnboardingScreen() {
  const { navigate } = useAppStore()
  const [currentSlide, setCurrentSlide] = useState(0)

  const goToNext = useCallback(() => {
    if (currentSlide < onboardingSlides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      navigate("login")
    }
  }, [currentSlide, navigate])

  const handleSkip = useCallback(() => {
    navigate("login")
  }, [navigate])

  const slide = onboardingSlides[currentSlide]

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background"
    >
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            {/* Illustration */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
              className={`w-40 h-40 rounded-full bg-gradient-to-br ${slide.gradient} flex items-center justify-center mb-8 shadow-lg`}
            >
              <span className="text-7xl">{slide.emoji}</span>
            </motion.div>

            <h2 className="text-2xl font-bold text-foreground mb-3">
              {slide.title}
            </h2>
            <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom section: dots + button */}
      <div className="px-6 pb-10 space-y-8">
        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2">
          {onboardingSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className="focus:outline-none"
            >
              <motion.div
                animate={{
                  width: idx === currentSlide ? 24 : 8,
                  backgroundColor: idx === currentSlide ? "#10b981" : "#d1d5db",
                }}
                transition={{ duration: 0.3 }}
                className="h-2 rounded-full"
              />
            </button>
          ))}
        </div>

        {/* Next / Start button */}
        <Button
          onClick={goToNext}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold text-base"
        >
          {currentSlide === onboardingSlides.length - 1 ? "Mulai Belanja" : "Next"}
        </Button>
      </div>
    </motion.div>
  )
}
