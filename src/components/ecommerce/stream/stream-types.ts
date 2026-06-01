// ==================== SHARED STREAM TYPES ====================
// Single source of truth for StreamPost — used by all stream components

export interface StreamPostUser {
  id: string
  name: string
  username?: string
  avatar?: string
}

export interface StreamPost {
  id: string
  userId: string
  user: StreamPostUser
  type: "text" | "image" | "video"
  content: string | null
  mediaUrl?: string | null
  thumbnailUrl?: string | null
  mediaType?: string | null
  productId?: string | null
  product?: {
    id: string
    name: string
    price: number
    discountPrice?: number
    image?: string
    slug: string
  }
  likeCount: number
  commentCount: number
  isLiked: boolean
  isPrivate: boolean
  isEdited: boolean
  viewCount: number
  createdAt: string
}

export interface StreamComment {
  id: string
  userId: string
  user: StreamPostUser
  content: string
  likeCount: number
  isLiked: boolean
  parentId?: string
  replyCount: number
  createdAt: string
  replies?: StreamComment[]
}

export interface StreamFeedResponse {
  success: boolean
  data: StreamPost[]
  pagination: {
    nextCursor?: string | null
    hasMore: boolean
    limit: number
  }
}

export interface LikeResponse {
  success: boolean
  isLiked: boolean
  likeCount: number
}

export interface EditPostResponse {
  success: boolean
  data?: StreamPost
  error?: string
}

export interface CommentsResponse {
  success: boolean
  data: StreamComment[]
  pagination?: {
    nextCursor?: string | null
    hasMore: boolean
    limit: number
  }
}

export interface CommentMutationResponse {
  success: boolean
  data?: StreamComment
  error?: string
}

export interface LikeCommentResponse {
  success: boolean
  isLiked: boolean
  likeCount: number
}
