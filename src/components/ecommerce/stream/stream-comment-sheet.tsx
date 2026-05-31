"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  Send,
  Heart,
  ChevronDown,
  Loader2,
  MessageCircle,
} from "lucide-react"
import { apiClient, ApiClientError } from "@/lib/api-client"
import { formatRelativeTime, truncateText } from "@/lib/utils"

// ==================== LOCAL TYPES ====================
interface StreamPost {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  type: "text" | "image" | "video"
  content: string
  mediaUrl?: string
  likeCount: number
  commentCount: number
  isLiked: boolean
  createdAt: string
}

interface StreamComment {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  likeCount: number
  isLiked: boolean
  parentId?: string
  replyCount: number
  createdAt: string
  replies?: StreamComment[]
}

interface CommentsResponse {
  success: boolean
  data: StreamComment[]
  hasMore?: boolean
}

interface CommentMutationResponse {
  success: boolean
  data?: StreamComment
  error?: string
}

interface LikeCommentResponse {
  success: boolean
  isLiked: boolean
  likeCount: number
}

// ==================== AVATAR HELPER ====================
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

// ==================== PROPS ====================
interface StreamCommentSheetProps {
  post: StreamPost | null
  onClose: () => void
  onCommentAdded?: (postId: string) => void
}

// ==================== STREAM COMMENT SHEET ====================
export function StreamCommentSheet({
  post,
  onClose,
  onCommentAdded,
}: StreamCommentSheetProps) {
  const [comments, setComments] = useState<StreamComment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [replyingTo, setReplyingTo] = useState<StreamComment | null>(null)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [isLoadingReplies, setIsLoadingReplies] = useState<Set<string>>(new Set())

  const inputRef = useRef<HTMLInputElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // ==================== FETCH COMMENTS ====================
  const fetchComments = useCallback(async () => {
    if (!post) return

    setIsLoading(true)
    try {
      const data = await apiClient.get<CommentsResponse>(
        `/api/stream/${post.id}/comments`,
        { limit: "20" }
      )
      if (data.success && data.data) {
        setComments(data.data)
      }
    } catch {
      // Silently fail, comments will be empty
    } finally {
      setIsLoading(false)
    }
  }, [post])

  // Fetch when post changes
  useEffect(() => {
    if (post) {
      fetchComments()
    } else {
      setComments([])
      setNewComment("")
      setReplyingTo(null)
      setExpandedReplies(new Set())
    }
  }, [post, fetchComments])

  // Auto-scroll to bottom when new comment added
  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [comments.length])

  // ==================== SEND COMMENT ====================
  const handleSendComment = useCallback(async () => {
    if (!post || !newComment.trim() || isSending) return

    setIsSending(true)
    try {
      const payload: { content: string; parentId?: string } = {
        content: newComment.trim(),
      }
      if (replyingTo) {
        payload.parentId = replyingTo.id
      }

      const data = await apiClient.post<CommentMutationResponse>(
        `/api/stream/${post.id}/comments`,
        payload
      )

      if (data.success && data.data) {
        if (replyingTo) {
          // Add reply to parent comment's replies
          setComments((prev) =>
            prev.map((c) =>
              c.id === replyingTo.id
                ? {
                    ...c,
                    replyCount: c.replyCount + 1,
                    replies: [...(c.replies || []), data.data!],
                  }
                : c
            )
          )
          setExpandedReplies((prev) => new Set(prev).add(replyingTo.id))
        } else {
          // Add top-level comment
          setComments((prev) => [...prev, data.data!])
        }

        setNewComment("")
        setReplyingTo(null)
        onCommentAdded?.(post.id)
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        // Show server error
      }
    } finally {
      setIsSending(false)
    }
  }, [post, newComment, isSending, replyingTo, onCommentAdded])

  // ==================== LIKE COMMENT ====================
  const handleLikeComment = useCallback(
    async (commentId: string, isReply: boolean, parentId?: string) => {
      // Optimistic update
      const updateComment = (c: StreamComment): StreamComment => ({
        ...c,
        isLiked: !c.isLiked,
        likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1,
      })

      if (isReply && parentId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? {
                  ...c,
                  replies: c.replies?.map((r) =>
                    r.id === commentId ? updateComment(r) : r
                  ),
                }
              : c
          )
        )
      } else {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? updateComment(c) : c))
        )
      }

      try {
        const data = await apiClient.post<LikeCommentResponse>(
          `/api/stream/${post?.id}/comments/${commentId}/like`
        )
        // Sync with server
        const syncComment = (c: StreamComment): StreamComment => ({
          ...c,
          isLiked: data.isLiked,
          likeCount: data.likeCount,
        })

        if (isReply && parentId) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === parentId
                ? {
                    ...c,
                    replies: c.replies?.map((r) =>
                      r.id === commentId ? syncComment(r) : r
                    ),
                  }
                : c
            )
          )
        } else {
          setComments((prev) =>
            prev.map((c) => (c.id === commentId ? syncComment(c) : c))
          )
        }
      } catch {
        // Revert on error
        const revertComment = (c: StreamComment): StreamComment => ({
          ...c,
          isLiked: !c.isLiked,
          likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1,
        })

        if (isReply && parentId) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === parentId
                ? {
                    ...c,
                    replies: c.replies?.map((r) =>
                      r.id === commentId ? revertComment(r) : r
                    ),
                  }
                : c
            )
          )
        } else {
          setComments((prev) =>
            prev.map((c) => (c.id === commentId ? revertComment(c) : c))
          )
        }
      }
    },
    [post]
  )

  // ==================== LOAD REPLIES ====================
  const handleLoadReplies = useCallback(
    async (commentId: string) => {
      if (expandedReplies.has(commentId)) {
        setExpandedReplies((prev) => {
          const next = new Set(prev)
          next.delete(commentId)
          return next
        })
        return
      }

      setIsLoadingReplies((prev) => new Set(prev).add(commentId))
      try {
        const data = await apiClient.get<CommentsResponse>(
          `/api/stream/${post?.id}/comments`,
          { parentId: commentId, limit: "50" }
        )
        if (data.success && data.data) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === commentId ? { ...c, replies: data.data } : c
            )
          )
          setExpandedReplies((prev) => new Set(prev).add(commentId))
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoadingReplies((prev) => {
          const next = new Set(prev)
          next.delete(commentId)
          return next
        })
      }
    },
    [expandedReplies, post]
  )

  // ==================== REPLY HANDLER ====================
  const handleReply = useCallback((comment: StreamComment) => {
    if (comment.parentId) {
      // This is a reply — find the top-level parent comment
      const parent = comments.find((c) => c.id === comment.parentId)
      setReplyingTo(parent || comment)
    } else {
      setReplyingTo(comment)
    }
    inputRef.current?.focus()
  }, [comments])

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null)
  }, [])

  // ==================== KEYBOARD SUBMIT ====================
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSendComment()
      }
    },
    [handleSendComment]
  )

  // ==================== RENDER ====================
  return (
    <AnimatePresence>
      {post && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl"
            style={{ maxHeight: "85vh" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-border/50">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Post user avatar */}
                <div className="relative flex-shrink-0">
                  {post.userAvatar ? (
                    <img
                      src={post.userAvatar}
                      alt={post.userName}
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement
                        img.style.display = "none"
                        const fallback = img.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = "flex"
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-8 h-8 rounded-full ${getAvatarColor(post.userName)} text-white font-bold items-center justify-center text-xs`}
                    style={{ display: post.userAvatar ? "none" : "flex" }}
                  >
                    {post.userName.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Post info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {post.userName}
                  </p>
                  {post.content && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {truncateText(post.content, 60)}
                    </p>
                  )}
                </div>
              </div>

              {/* Close button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4 text-foreground" />
              </motion.button>
            </div>

            {/* Comments list */}
            <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: "calc(85vh - 140px)" }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
                  />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                    <MessageCircle className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Belum Ada Komentar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Jadilah yang pertama berkomentar!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      isExpanded={expandedReplies.has(comment.id)}
                      isLoadingReplies={isLoadingReplies.has(comment.id)}
                      onLike={(id) => handleLikeComment(id, false)}
                      onReply={handleReply}
                      onLoadReplies={handleLoadReplies}
                      onLikeReply={(replyId) =>
                        handleLikeComment(replyId, true, comment.id)
                      }
                    />
                  ))}
                </div>
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Reply indicator */}
            <AnimatePresence>
              {replyingTo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-t border-border/50"
                >
                  <span className="text-xs text-muted-foreground flex-1">
                    Membalas{" "}
                    <span className="font-medium text-foreground">
                      {replyingTo.userName}
                    </span>
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleCancelReply}
                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50 bg-background">
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  replyingTo
                    ? `Balas ${replyingTo.userName}...`
                    : "Tulis komentar..."
                }
                className="flex-1 h-10 px-4 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSendComment}
                disabled={!newComment.trim() || isSending}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  newComment.trim() && !isSending
                    ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ==================== COMMENT ITEM ====================
interface CommentItemProps {
  comment: StreamComment
  isExpanded: boolean
  isLoadingReplies: boolean
  onLike: (id: string) => void
  onReply: (comment: StreamComment) => void
  onLoadReplies: (id: string) => void
  onLikeReply: (id: string) => void
}

function CommentItem({
  comment,
  isExpanded,
  isLoadingReplies,
  onLike,
  onReply,
  onLoadReplies,
  onLikeReply,
}: CommentItemProps) {
  return (
    <div className="px-4 py-3">
      {/* Comment content */}
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {comment.userAvatar ? (
            <img
              src={comment.userAvatar}
              alt={comment.userName}
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement
                img.style.display = "none"
                const fallback = img.nextElementSibling as HTMLElement
                if (fallback) fallback.style.display = "flex"
              }}
            />
          ) : null}
          <div
            className={`w-8 h-8 rounded-full ${getAvatarColor(comment.userName)} text-white font-bold items-center justify-center text-[10px]`}
            style={{ display: comment.userAvatar ? "none" : "flex" }}
          >
            {comment.userName.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-foreground">
              {comment.userName}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatRelativeTime(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-1.5">
            {/* Like */}
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={() => onLike(comment.id)}
              className="flex items-center gap-1"
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  comment.isLiked
                    ? "text-red-500 fill-red-500"
                    : "text-muted-foreground"
                }`}
              />
              {comment.likeCount > 0 && (
                <span
                  className={`text-[10px] font-medium ${
                    comment.isLiked ? "text-red-500" : "text-muted-foreground"
                  }`}
                >
                  {comment.likeCount}
                </span>
              )}
            </motion.button>

            {/* Reply */}
            <button
              onClick={() => onReply(comment)}
              className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Balas
            </button>
          </div>

          {/* View replies toggle */}
          {comment.replyCount > 0 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => onLoadReplies(comment.id)}
              className="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              {isLoadingReplies ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              )}
              <span>
                {isExpanded
                  ? "Sembunyikan balasan"
                  : `Lihat ${comment.replyCount} balasan`}
              </span>
            </motion.button>
          )}

          {/* Replies */}
          <AnimatePresence>
            {isExpanded && comment.replies && comment.replies.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-3 pl-0"
              >
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="flex gap-2.5">
                    {/* Reply avatar */}
                    <div className="relative flex-shrink-0">
                      {reply.userAvatar ? (
                        <img
                          src={reply.userAvatar}
                          alt={reply.userName}
                          className="w-6 h-6 rounded-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement
                            img.style.display = "none"
                            const fallback = img.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = "flex"
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-6 h-6 rounded-full ${getAvatarColor(reply.userName)} text-white font-bold items-center justify-center text-[8px]`}
                        style={{ display: reply.userAvatar ? "none" : "flex" }}
                      >
                        {reply.userName.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    {/* Reply content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-semibold text-foreground">
                          {reply.userName}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {formatRelativeTime(reply.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">
                        {reply.content}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <motion.button
                          whileTap={{ scale: 0.8 }}
                          onClick={() => onLikeReply(reply.id)}
                          className="flex items-center gap-1"
                        >
                          <Heart
                            className={`w-3 h-3 ${
                              reply.isLiked
                                ? "text-red-500 fill-red-500"
                                : "text-muted-foreground"
                            }`}
                          />
                          {reply.likeCount > 0 && (
                            <span
                              className={`text-[9px] font-medium ${
                                reply.isLiked
                                  ? "text-red-500"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {reply.likeCount}
                            </span>
                          )}
                        </motion.button>
                        <button
                          onClick={() => onReply(reply)}
                          className="text-[9px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Balas
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
