import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  // Check the user's role from the database
  const user = await db.user.findUnique({
    where: { email: session.user.email ?? '' },
  })
  if (!user || user.role !== 'admin') return null

  return user
}
