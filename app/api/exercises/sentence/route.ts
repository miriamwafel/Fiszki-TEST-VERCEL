import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateSentenceExercise, checkSentence } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { word, translation, language } = await request.json()

    if (!word || !translation || !language) {
      return NextResponse.json(
        { error: 'Słowo, tłumaczenie i język są wymagane' },
        { status: 400 }
      )
    }

    const languageNames: Record<string, string> = {
      en: 'angielskim',
      de: 'niemieckim',
      es: 'hiszpańskim',
      fr: 'francuskim',
      it: 'włoskim',
    }

    const languageName = languageNames[language] || language

    const exercise = await generateSentenceExercise(word, translation, languageName)

    return NextResponse.json(exercise)
  } catch (error) {
    console.error('Generate sentence exercise error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas generowania ćwiczenia' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sentence, targetWord, contextWords, language } = await request.json()

    if (!sentence || !targetWord || !contextWords || !language) {
      return NextResponse.json(
        { error: 'Wszystkie pola są wymagane' },
        { status: 400 }
      )
    }

    const languageNames: Record<string, string> = {
      en: 'angielskim',
      de: 'niemieckim',
      es: 'hiszpańskim',
      fr: 'francuskim',
      it: 'włoskim',
    }

    const languageName = languageNames[language] || language

    const result = await checkSentence(sentence, targetWord, contextWords, languageName)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Check sentence error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas sprawdzania zdania' },
      { status: 500 }
    )
  }
}
