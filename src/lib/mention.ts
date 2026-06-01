import { PrismaClient } from '@prisma/client'

/**
 * Extract all unique @mention usernames from a content string.
 * A mention starts with @ followed by word characters (letters, digits, underscores, hyphens).
 * Returns lowercase usernames without the @ prefix.
 * 
 * Example: "Hello @Kholis and @john_doe!" → ["kholis", "john_doe"]
 */
export function extractMentions(content: string): string[] {
  const mentionRegex = /@([\w-]+)/g
  const mentions: Set<string> = new Set()
  let match: RegExpExecArray | null
  
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.add(match[1].toLowerCase())
  }
  
  return Array.from(mentions)
}

/**
 * Parse @mentions in content, resolve them to users, and create notifications.
 * Skips the author user and non-existent usernames.
 */
export async function createMentionNotifications(params: {
  content: string
  authorUserId: string
  authorName: string
  refType: 'stream_post' | 'stream_comment'
  refId: string
  db: PrismaClient
}): Promise<number> {
  const { content, authorUserId, authorName, refType, refId, db } = params
  
  const mentionNames = extractMentions(content)
  if (mentionNames.length === 0) return 0
  
  // Find users matching any of the mention names (case-insensitive)
  const mentionedUsers = await db.user.findMany({
    where: {
      isActive: true,
      id: { not: authorUserId },
      name: { in: mentionNames.map(n => n), mode: 'insensitive' },
    },
    select: { id: true, name: true },
  })
  
  if (mentionedUsers.length === 0) return 0
  
  const refLabel = refType === 'stream_post' ? 'postingan' : 'komentar'
  
  // Create notifications in parallel
  await Promise.all(
    mentionedUsers.map(user =>
      db.notification.create({
        data: {
          userId: user.id,
          title: 'Kamu Di-mention di Stream',
          content: `${authorName} menyebutkan kamu di sebuah ${refLabel}`,
          type: 'mention',
          refType,
          refId,
        },
      })
    )
  )
  
  return mentionedUsers.length
}

/**
 * Render content with @mentions highlighted.
 * Returns an array of segments: { type: 'text', value: string } | { type: 'mention', value: string }
 * This can be used by React components to render mentions with special styling.
 */
export function parseMentionSegments(content: string): Array<{ type: 'text' | 'mention'; value: string }> {
  const mentionRegex = /@([\w-]+)/g
  const segments: Array<{ type: 'text' | 'mention'; value: string }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  
  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    // Add the mention (include the @ symbol)
    segments.push({ type: 'mention', value: match[0] })
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }
  
  return segments
}
