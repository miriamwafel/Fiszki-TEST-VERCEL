import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { markWordAsLearning } from '@/lib/vocabulary-matcher'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { setId, word, translation, context, partOfSpeech, infinitive } = await request.json()

    if (!setId || !word || !translation) {
      return NextResponse.json(
        { error: 'Zestaw, słowo i tłumaczenie są wymagane' },
        { status: 400 }
      )
    }

    // Verify user owns the set
    const set = await prisma.flashcardSet.findFirst({
      where: {
        id: setId,
        userId: session.user.id,
      },
    })

    if (!set) {
      return NextResponse.json({ error: 'Nie znaleziono zestawu' }, { status: 404 })
    }

    const flashcard = await prisma.flashcard.create({
      data: {
        word,
        translation,
        context,
        partOfSpeech,
        infinitive,
        setId,
      },
    })

    // Automatycznie oznacz słowo w bazie słownictwa jako "w nauce"
    // Robimy to asynchronicznie żeby nie blokować odpowiedzi
    markWordAsLearning(session.user.id, word, set.language, flashcard.id).catch((err) => {
      console.error('Failed to mark word in vocabulary base:', err)
    })

    // Jeśli jest bezokolicznik, oznacz też jego
    if (infinitive && infinitive !== word) {
      markWordAsLearning(session.user.id, infinitive, set.language, flashcard.id).catch((err) => {
        console.error('Failed to mark infinitive in vocabulary base:', err)
      })
    }

    return NextResponse.json(flashcard)
  } catch (error) {
    console.error('Create flashcard error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas tworzenia fiszki' },
      { status: 500 }
    )
  }
}
