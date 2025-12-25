import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { TutorView } from './TutorView'

export default async function TutorPage({
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
      flashcards: {
        select: {
          id: true,
          word: true,
          translation: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!set) {
    notFound()
  }

  return <TutorView set={set} />
}
