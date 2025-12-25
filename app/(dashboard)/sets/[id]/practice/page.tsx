import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { PracticeView } from './PracticeView'

export default async function PracticePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  const set = await prisma.flashcardSet.findFirst({
    where: {
      id,
      userId: session!.user.id,
    },
    include: {
      flashcards: true,
    },
  })

  if (!set || set.flashcards.length === 0) {
    notFound()
  }

  const stats = await prisma.practiceStats.findMany({
    where: {
      userId: session!.user.id,
      flashcardId: { in: set.flashcards.map((f) => f.id) },
    },
  })

  const statsMap = Object.fromEntries(stats.map((s) => [s.flashcardId, s]))

  const flashcardsWithStats = set.flashcards.map((flashcard) => ({
    ...flashcard,
    stats: statsMap[flashcard.id] || null,
  }))

  return <PracticeView set={set} flashcards={flashcardsWithStats} />
}
