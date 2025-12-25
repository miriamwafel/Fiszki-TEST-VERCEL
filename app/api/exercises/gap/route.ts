import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateGapExercise } from '@/lib/gemini'

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

    const exercise = await generateGapExercise(word, translation, languageName)

    return NextResponse.json(exercise)
  } catch (error) {
    console.error('Generate gap exercise error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas generowania ćwiczenia' },
      { status: 500 }
    )
  }
}
