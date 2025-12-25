import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { setId, word, translation, context, partOfSpeech, infinitive, verbForm, verbTense, verbPerson, grammaticalInfo } = await request.json()

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
        verbForm,
        verbTense,
        verbPerson,
        grammaticalInfo,
        setId,
      },
    })

    return NextResponse.json(flashcard)
  } catch (error) {
    console.error('Create flashcard error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas tworzenia fiszki' },
      { status: 500 }
    )
  }
}
