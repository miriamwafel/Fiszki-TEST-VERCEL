import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { SetView } from './SetView'

export default async function SetPage({
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
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!set) {
    notFound()
  }

  return <SetView initialSet={set} />
}
