import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateBatchGapExercises, generateBatchSentenceExercises } from '@/lib/gemini'

const languageNames: Record<string, string> = {
  en: 'angielskim',
  de: 'niemieckim',
  es: 'hiszpańskim',
  fr: 'francuskim',
  it: 'włoskim',
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { flashcards, language, type } = await request.json()

    if (!flashcards || !Array.isArray(flashcards) || flashcards.length === 0) {
      return NextResponse.json(
        { error: 'Flashcards array is required' },
        { status: 400 }
      )
    }

    if (!language) {
      return NextResponse.json(
        { error: 'Language is required' },
        { status: 400 }
      )
    }

    const languageName = languageNames[language] || language

    if (type === 'sentence') {
      const exercises = await generateBatchSentenceExercises(flashcards, languageName)
      return NextResponse.json({ exercises })
    } else {
      const exercises = await generateBatchGapExercises(flashcards, languageName)
      return NextResponse.json({ exercises })
    }
  } catch (error) {
    console.error('Generate batch exercises error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas generowania ćwiczeń' },
      { status: 500 }
    )
  }
}
