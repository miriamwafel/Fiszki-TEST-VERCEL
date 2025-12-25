import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { translateWord } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { word, language } = await request.json()

    if (!word || !language) {
      return NextResponse.json(
        { error: 'Słowo i język są wymagane' },
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
      ja: 'japońskiego',
      ko: 'koreańskiego',
      zh: 'chińskiego',
      nl: 'holenderskiego',
      sv: 'szwedzkiego',
      no: 'norweskiego',
      da: 'duńskiego',
      fi: 'fińskiego',
      cs: 'czeskiego',
      uk: 'ukraińskiego',
    }

    const languageName = languageNames[language] || language

    const result = await translateWord(word, languageName)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Translate error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas tłumaczenia' },
      { status: 500 }
    )
  }
}
