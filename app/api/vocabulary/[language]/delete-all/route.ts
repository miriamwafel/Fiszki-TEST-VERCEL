import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ language: string }> }
) {
  const session = await getServerSession(authOptions)
  const { language } = await params

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user?.isAdmin) {
    return Response.json({ error: 'Admin only' }, { status: 403 })
  }

  // Opcjonalnie: usuń tylko określony poziom
  let level: string | null = null
  try {
    const body = await request.json()
    level = body?.level || null
  } catch {
    // Brak body = usuń wszystko
  }

  const where = level
    ? { language, level: level.toUpperCase() }
    : { language }

  // Najpierw usuń powiązane UserVocabularyProgress
  const vocabIds = await prisma.vocabularyBase.findMany({
    where,
    select: { id: true },
  })

  const ids = vocabIds.map(v => v.id)

  if (ids.length > 0) {
    await prisma.userVocabularyProgress.deleteMany({
      where: { vocabularyId: { in: ids } },
    })
  }

  // Teraz usuń słowa
  const result = await prisma.vocabularyBase.deleteMany({ where })

  return Response.json({
    deleted: result.count,
    language,
    level: level || 'all',
  })
}
