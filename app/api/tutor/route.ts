import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tutorChat, startTutorConversation, TutorMessage } from '@/lib/gemini'
import prisma from '@/lib/db'

// POST /api/tutor - Rozpocznij rozmowę lub wyślij wiadomość
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { setId, message, conversationHistory } = body

    if (!setId) {
      return NextResponse.json({ error: 'Set ID is required' }, { status: 400 })
    }

    // Pobierz zestaw fiszek
    const set = await prisma.flashcardSet.findFirst({
      where: {
        id: setId,
        userId: session.user.id,
      },
      include: {
        flashcards: {
          select: {
            word: true,
            translation: true,
          },
        },
      },
    })

    if (!set) {
      return NextResponse.json({ error: 'Set not found' }, { status: 404 })
    }

    // Jeśli brak wiadomości - rozpocznij rozmowę
    if (!message) {
      const response = await startTutorConversation(set.language, set.flashcards)
      return NextResponse.json(response)
    }

    // Kontynuuj rozmowę
    const history: TutorMessage[] = conversationHistory || []
    const response = await tutorChat(message, set.language, set.flashcards, history)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Tutor API error:', error)
    return NextResponse.json(
      { error: 'Failed to process tutor request' },
      { status: 500 }
    )
  }
}
