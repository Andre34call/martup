# Task: Stream Feature Frontend Screens

## Task ID: stream-frontend

## Work Log

- Read worklog.md and all referenced files to understand existing patterns (navigation.tsx, types.ts, store/index.ts, home-screen.tsx, shared components, api-client.ts, upload.ts, animations.ts)
- Created `/home/z/my-project/src/components/ecommerce/stream/` directory
- Created 4 files:

### 1. `stream-feed-screen.tsx` (~400 lines)
- Main Stream feed screen with vertical scrollable feed (Instagram-style, not full-screen video)
- Each post card shows: user avatar + name + relative timestamp, text content, media (image or video with play/pause), action bar (like with count, comment with count, share), optional product link card
- Pull-to-refresh via RefreshCw button in header
- Infinite scroll with IntersectionObserver sentinel
- Empty state when no posts with "Buat Postingan" CTA
- Floating "+" button (bottom right, above nav) to create new post
- Optimistic like toggle with server sync
- Video player with play/pause overlay
- Share via Web Share API with clipboard fallback
- Loading skeleton state
- Uses: useAppStore, apiClient, PageHeader, StreamCommentSheet, formatRelativeTime, formatPrice, truncateText, fadeIn

### 2. `stream-create-screen.tsx` (~400 lines)
- Create new Stream post screen
- Toggle between Text / Video / Image post type (tabs)
- Text area for content/caption with max 2000 char counter (color changes near limit)
- For video/image: upload button with drag-style area, file type + size validation
- Media preview with remove button
- Optional product link with expandable search panel (searches /api/search)
- Selected product shown as chip with remove button
- "Post" button with loading state and upload progress text
- Back button with unsaved content confirmation dialog
- Uses: useAppStore, apiClient, ApiClientError, uploadFile, PageHeader, formatPrice, fadeIn

### 3. `stream-comment-sheet.tsx` (~430 lines)
- Bottom sheet for comments on a post (AnimatePresence + framer-motion slide-up)
- Backdrop overlay with click-to-close
- Sheet header: post user avatar + name + truncated content + close (X) button
- List of top-level comments with: avatar, name, content, timestamp, like count, "Balas" button
- "Lihat X balasan" toggle to expand/collapse replies (with ChevronDown rotation)
- Reply list: smaller avatars, content, like, reply buttons
- Reply-to indicator above input (shows who you're replying to, with cancel)
- Input at bottom: text input + send button (emerald when has content)
- Optimistic like toggle with server sync
- Auto-scroll to bottom on new comment
- Empty comments state with illustration
- Keyboard submit (Enter)
- Max-height with overflow scroll for long comment lists
- Uses: apiClient, ApiClientError, formatRelativeTime, truncateText

### 4. `index.ts`
- Barrel export for StreamFeedScreen, StreamCreateScreen, StreamCommentSheet

## Technical Notes

- All files use `"use client"` directive
- Local types defined (StreamPost, StreamComment, etc.) since they don't exist in global types.ts yet
- Navigation uses `navigate("stream" as any)` and `navigate("stream-create" as any)` — ScreenName type needs to be updated to include "stream" | "stream-create"
- No indigo/blue colors used — emerald, orange, amber, violet palette
- Dark mode compatible (bg-background, text-foreground, bg-card, etc.)
- Custom scrollbar styling referenced (custom-scrollbar class)
- Avatar fallback follows existing pattern from AvatarWithName component
- All API calls use apiClient from @/lib/api-client
- Upload uses uploadFile from @/lib/upload

## Stage Summary

- 4 files created in `src/components/ecommerce/stream/`
- Lint passes ✅ (0 errors, 0 warnings)
- Dev server compiles and renders ✅
- Follows all existing project patterns (store, api-client, shared components, animations)
