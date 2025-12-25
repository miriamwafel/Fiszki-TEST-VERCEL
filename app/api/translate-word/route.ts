import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { gemini } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { word, fromLanguage } = await request.json()

    if (!word || !fromLanguage) {
      return NextResponse.json(
        { error: 'Słowo i język źródłowy są wymagane' },
        { status: 400 }
      )
    }

    const languageNames: Record<string, string> = {
      en: 'angielskiego',
      de: 'niemieckiego',
      es: 'hiszpańskiego',
      fr: 'francuskiego',
      it: 'włoskiego',
      pt: 'portugalskiego',
      ru: 'rosyjskiego',
    }

    const languageName = languageNames[fromLanguage] || fromLanguage

    const prompt = `Przetłumacz słowo "${word}" z języka ${languageName} na polski.
Odpowiedz TYLKO tłumaczeniem, bez dodatkowych wyjaśnień.`

    const result = await gemini.generateContent(prompt)
    const translation = result.response.text().trim()

    return NextResponse.json({ translation })
  } catch (error) {
    console.error('Translate word error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas tłumaczenia' },
      { status: 500 }
    )
  }
}
