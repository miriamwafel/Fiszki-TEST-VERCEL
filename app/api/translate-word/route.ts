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

    const { word, fromLanguage, sentenceContext } = await request.json()

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

    // Use advanced prompt with sentence context for verb detection
    const prompt = sentenceContext
      ? `Przetłumacz słowo "${word}" z języka ${languageName} na polski.
Słowo występuje w kontekście zdania: "${sentenceContext}"

Odpowiedz w formacie JSON:
{
  "word": "${word}",
  "translation": "tłumaczenie po polsku",
  "partOfSpeech": "część mowy (verb, noun, adjective, adverb, etc.)",
  "context": "krótki przykład użycia lub dodatkowe wyjaśnienie",
  "infinitive": "jeśli to czasownik w formie odmienionej, podaj bezokolicznik w języku ${languageName}, w przeciwnym razie null",
  "tenseInfo": "jeśli to odmieniony czasownik, opisz po polsku jaki to czas i forma (np. 'czas przeszły, 3 osoba liczby pojedynczej'), w przeciwnym razie null",
  "suggestInfinitive": true/false - ustaw true jeśli słowo to odmieniony czasownik i warto dodać bezokolicznik jako osobną fiszkę
}

Biorąc pod uwagę kontekst zdania, określ czy słowo jest odmienioną formą czasownika.
Jeśli tak, podaj informacje o czasie i formie oraz bezokolicznik.

Odpowiedz TYLKO JSON, bez dodatkowego tekstu.`
      : `Przetłumacz słowo "${word}" z języka ${languageName} na polski.
Odpowiedz w formacie JSON:
{
  "word": "${word}",
  "translation": "tłumaczenie po polsku",
  "partOfSpeech": "część mowy (verb, noun, adjective, adverb, etc.)",
  "context": null,
  "infinitive": null,
  "tenseInfo": null,
  "suggestInfinitive": false
}

Odpowiedz TYLKO JSON, bez dodatkowego tekstu.`

    const result = await gemini.generateContent(prompt)
    const response = result.response.text()

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // Fallback to simple translation
      return NextResponse.json({
        word,
        translation: response.trim(),
        partOfSpeech: null,
        context: null,
        infinitive: null,
        tenseInfo: null,
        suggestInfinitive: false
      })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Translate word error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas tłumaczenia' },
      { status: 500 }
    )
  }
}
