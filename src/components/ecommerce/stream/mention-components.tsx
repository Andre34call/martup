"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { apiClient } from "@/lib/api-client"
import { parseMentionSegments } from "@/lib/mention"

// ==================== TYPES ====================
interface MentionUser {
  id: string
  name: string
  username?: string
  avatar?: string
}

// ==================== AVATAR COLORS ====================
const avatarColors = [
  "bg-emerald-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-amber-500",
]

function getAvatarColor(name: string): string {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

// ==================== MENTION TEXT RENDERER ====================
// Renders text with @mentions highlighted as emerald-colored spans
interface MentionTextProps {
  content: string
  className?: string
  maxChars?: number
  onExpand?: () => void
  isExpanded?: boolean
}

export function MentionText({ content, className = "", maxChars, onExpand, isExpanded }: MentionTextProps) {
  const displayContent = maxChars && !isExpanded && content.length > maxChars
    ? content.slice(0, maxChars)
    : content

  const segments = parseMentionSegments(displayContent)

  return (
    <span className={className}>
      {segments.map((segment, i) =>
        segment.type === "mention" ? (
          <span key={i} className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-0.5 rounded">
            {segment.value}
          </span>
        ) : (
          <span key={i}>{segment.value}</span>
        )
      )}
      {maxChars && !isExpanded && content.length > maxChars && (
        <>
          <span className="text-muted-foreground">... </span>
          <button
            onClick={onExpand}
            className="text-emerald-600 font-semibold text-xs hover:text-emerald-700"
          >
            Baca selengkapnya
          </button>
        </>
      )}
      {maxChars && isExpanded && onExpand && (
        <button
          onClick={onExpand}
          className="text-emerald-600 font-semibold text-xs hover:text-emerald-700 ml-1"
        >
          Tampilkan lebih sedikit
        </button>
      )}
    </span>
  )
}

// ==================== MENTION INPUT (TEXTAREA) ====================
// Smart textarea that detects @ and shows user suggestion dropdown
interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  rows?: number
  className?: string
}

export function MentionTextarea({
  value,
  onChange,
  placeholder = "Tulis sesuatu...",
  maxLength = 2000,
  rows = 5,
  className = "",
}: MentionTextareaProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<MentionUser[]>([])
  const [mentionQuery, setMentionQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Detect @ mention trigger from cursor position
  const detectMention = useCallback((text: string, cursorPos: number) => {
    // Look backwards from cursor to find the start of a @mention
    let start = -1
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '@') {
        // Check if this @ is the start of a mention (preceded by space or start of string)
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
          start = i
        }
        break
      }
      // If we hit a space or newline, stop looking
      if (text[i] === ' ' || text[i] === '\n') {
        break
      }
    }

    if (start >= 0) {
      const query = text.slice(start + 1, cursorPos)
      // Only show suggestions if query doesn't contain spaces
      if (!query.includes(' ') && query.length <= 20) {
        setMentionStartIndex(start)
        setMentionQuery(query)
        setShowSuggestions(true)
        setSelectedIndex(0)
        return
      }
    }

    setShowSuggestions(false)
    setMentionStartIndex(-1)
  }, [])

  // Search users when mention query changes
  useEffect(() => {
    if (!showSuggestions || mentionQuery.length < 1) {
      setSuggestions([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.get<{ success: boolean; data: MentionUser[] }>(
          "/api/user/search",
          { q: mentionQuery, limit: "6" }
        )
        if (data.success && data.data) {
          setSuggestions(data.data)
        }
      } catch {
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [mentionQuery, showSuggestions])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    const cursorPos = e.target.selectionStart ?? newValue.length
    detectMention(newValue, cursorPos)
  }, [onChange, detectMention])

  // Insert mention using username (preferred) or name as fallback
  const insertMention = useCallback((user: MentionUser) => {
    if (mentionStartIndex < 0) return

    // Use username if available, otherwise use name (lowercase, spaces replaced with underscores)
    const mentionHandle = user.username || user.name.toLowerCase().replace(/\s+/g, '_')
    const beforeMention = value.slice(0, mentionStartIndex)
    const afterMention = value.slice(mentionStartIndex + 1 + mentionQuery.length)
    const newValue = `${beforeMention}@${mentionHandle} ${afterMention}`
    onChange(newValue)
    setShowSuggestions(false)
    setMentionStartIndex(-1)

    // Focus back on textarea and set cursor after the inserted mention
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionHandle.length + 2 // +2 for @ and space
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    })
  }, [value, mentionStartIndex, mentionQuery, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      insertMention(suggestions[selectedIndex])
    } else if (e.key === "Escape") {
      e.preventDefault()
      setShowSuggestions(false)
    }
  }, [showSuggestions, suggestions, selectedIndex, insertMention])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={className}
      />

      {/* Mention suggestions dropdown */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            ref={suggestionsRef}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
          >
            <div className="p-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Mention Seseorang
                </span>
                {isLoading && (
                  <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                )}
              </div>

              {suggestions.length > 0 ? (
                suggestions.map((user, idx) => (
                  <motion.button
                    key={user.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => insertMention(user)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
                      idx === selectedIndex
                        ? "bg-emerald-50 dark:bg-emerald-950/30"
                        : "hover:bg-muted/50"
                    }`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement
                            img.style.display = "none"
                            const fallback = img.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = "flex"
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full rounded-full ${getAvatarColor(user.name)} text-white font-bold items-center justify-center text-xs`}
                        style={{ display: user.avatar ? "none" : "flex" }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    {/* Name & Username */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">
                        {user.name}
                      </span>
                      {user.username && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          @{user.username}
                        </span>
                      )}
                    </div>

                    {/* Selected indicator */}
                    {idx === selectedIndex && (
                      <span className="ml-auto text-xs text-emerald-600 font-medium">Enter ↵</span>
                    )}
                  </motion.button>
                ))
              ) : !isLoading && mentionQuery.length >= 1 ? (
                <div className="px-2.5 py-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Tidak ada user &quot;{mentionQuery}&quot;
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==================== MENTION INPUT (SINGLE LINE) ====================
// Smart input that detects @ and shows user suggestion dropdown (for comments)
interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Tulis komentar...",
  disabled = false,
  className = "",
  inputRef: externalInputRef,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<MentionUser[]>([])
  const [mentionQuery, setMentionQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)

  const internalInputRef = useRef<HTMLInputElement>(null)
  const inputRef = externalInputRef || internalInputRef
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const detectMention = useCallback((text: string, cursorPos: number) => {
    let start = -1
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '@') {
        if (i === 0 || text[i - 1] === ' ') {
          start = i
        }
        break
      }
      if (text[i] === ' ') break
    }

    if (start >= 0) {
      const query = text.slice(start + 1, cursorPos)
      if (!query.includes(' ') && query.length <= 20) {
        setMentionStartIndex(start)
        setMentionQuery(query)
        setShowSuggestions(true)
        setSelectedIndex(0)
        return
      }
    }

    setShowSuggestions(false)
    setMentionStartIndex(-1)
  }, [])

  useEffect(() => {
    if (!showSuggestions || mentionQuery.length < 1) {
      setSuggestions([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.get<{ success: boolean; data: MentionUser[] }>(
          "/api/user/search",
          { q: mentionQuery, limit: "6" }
        )
        if (data.success && data.data) {
          setSuggestions(data.data)
        }
      } catch {
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [mentionQuery, showSuggestions])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    const cursorPos = e.target.selectionStart ?? newValue.length
    detectMention(newValue, cursorPos)
  }, [onChange, detectMention])

  // Insert mention using username (preferred) or name as fallback
  const insertMention = useCallback((user: MentionUser) => {
    if (mentionStartIndex < 0) return

    const mentionHandle = user.username || user.name.toLowerCase().replace(/\s+/g, '_')
    const beforeMention = value.slice(0, mentionStartIndex)
    const afterMention = value.slice(mentionStartIndex + 1 + mentionQuery.length)
    const newValue = `${beforeMention}@${mentionHandle} ${afterMention}`
    onChange(newValue)
    setShowSuggestions(false)
    setMentionStartIndex(-1)

    requestAnimationFrame(() => {
      if (inputRef.current) {
        const newCursorPos = beforeMention.length + mentionHandle.length + 2
        inputRef.current.focus()
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    })
  }, [value, mentionStartIndex, mentionQuery, onChange, inputRef])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
        return
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        return
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        insertMention(suggestions[selectedIndex])
        return
      } else if (e.key === "Escape") {
        e.preventDefault()
        setShowSuggestions(false)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }, [showSuggestions, suggestions, selectedIndex, insertMention, onSubmit])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [inputRef])

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />

      {/* Mention suggestions dropdown */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            ref={suggestionsRef}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
          >
            <div className="p-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Mention
                </span>
                {isLoading && (
                  <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                )}
              </div>

              {suggestions.length > 0 ? (
                suggestions.map((user, idx) => (
                  <motion.button
                    key={user.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => insertMention(user)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
                      idx === selectedIndex
                        ? "bg-emerald-50 dark:bg-emerald-950/30"
                        : "hover:bg-muted/50"
                    }`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement
                            img.style.display = "none"
                            const fallback = img.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = "flex"
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full rounded-full ${getAvatarColor(user.name)} text-white font-bold items-center justify-center text-xs`}
                        style={{ display: user.avatar ? "none" : "flex" }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">
                        {user.name}
                      </span>
                      {user.username && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          @{user.username}
                        </span>
                      )}
                    </div>

                    {idx === selectedIndex && (
                      <span className="ml-auto text-xs text-emerald-600 font-medium">Enter ↵</span>
                    )}
                  </motion.button>
                ))
              ) : !isLoading && mentionQuery.length >= 1 ? (
                <div className="px-2.5 py-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Tidak ada user &quot;{mentionQuery}&quot;
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
