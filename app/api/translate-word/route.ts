import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { gemini } from '@/lib/gemini'
import prisma from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { word, fromLanguage, sentenceContext, storyId } = await request.json()

    if (!word || !fromLanguage) {
      return NextResponse.json(
        { error: 'Słowo i język źródłowy są wymagane' },
        { status: 400 }
      )
    }

    // Sprawdź cache w historyjce jeśli podano storyId
    if (storyId) {
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { vocabulary: true }
      })

      if (story?.vocabulary) {
        const vocab = story.vocabulary as Record<string, string>
        const wordLower = word.toLowerCase()

        // Sprawdź dopasowanie (z i bez znaków interpunkcyjnych)
        const cleanWord = wordLower.replace(/[.,!?;:'"„"«»\-–—()[\]{}]/g, '')
        const cachedTranslation = vocab[wordLower] || vocab[cleanWord] || vocab[word]

        if (cachedTranslation) {
          // Zwróć z cache - NATYCHMIASTOWA odpowiedź!
          return NextResponse.json({
            word,
            translation: cachedTranslation,
            partOfSpeech: null,
            context: null,
            infinitive: null,
            infinitiveTranslation: null,
            tenseInfo: null,
            suggestInfinitive: false,
            phrase: null,
            phraseTranslation: null,
            fromCache: true
          })
        }
      }
    }

    // Jeśli nie ma w cache - użyj AI (ale to będzie rzadko)
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

    // Use advanced prompt with sentence context for verb detection and phrase detection
    const prompt = sentenceContext
      ? `Przetłumacz słowo "${word}" z języka ${languageName} na polski.
Słowo występuje w kontekście zdania: "${sentenceContext}"

Odpowiedz w formacie JSON:
{
  "word": "${word}",
  "translation": "tłumaczenie po polsku (w formie jak w tekście)",
  "partOfSpeech": "część mowy (verb, noun, adjective, adverb, etc.)",
  "context": "krótki przykład użycia lub dodatkowe wyjaśnienie",
  "infinitive": "jeśli to czasownik w formie odmienionej, podaj bezokolicznik w języku ${languageName}, w przeciwnym razie null",
  "infinitiveTranslation": "jeśli to czasownik odmieniony, podaj tłumaczenie BEZOKOLICZNIKA po polsku (np. 'upuszczać', 'biegać'), w przeciwnym razie null",
  "tenseInfo": "jeśli to odmieniony czasownik, opisz po polsku jaki to czas i forma (np. 'czas przeszły, 3 osoba liczby pojedynczej'), w przeciwnym razie null",
  "suggestInfinitive": true/false - ustaw true jeśli słowo to odmieniony czasownik i warto dodać bezokolicznik jako osobną fiszkę,
  "phrase": "jeśli słowo jest częścią idiomatycznego wyrażenia, kolokacji lub frazy w tym zdaniu, podaj całą frazę (np. 'take care of', 'make a decision'), w przeciwnym razie null",
  "phraseTranslation": "jeśli jest fraza, podaj jej tłumaczenie na polski, w przeciwnym razie null"
}

Biorąc pod uwagę kontekst zdania:
1. Określ czy słowo jest odmienioną formą czasownika - jeśli tak, podaj bezokolicznik i jego tłumaczenie w bezokoliczniku
2. Sprawdź czy słowo jest częścią większego wyrażenia idiomatycznego lub kolokacji - jeśli tak, podaj całą frazę

Odpowiedz TYLKO JSON, bez dodatkowego tekstu.`
      : `Przetłumacz słowo "${word}" z języka ${languageName} na polski.
Odpowiedz w formacie JSON:
{
  "word": "${word}",
  "translation": "tłumaczenie po polsku",
  "partOfSpeech": "część mowy (verb, noun, adjective, adverb, etc.)",
  "context": null,
  "infinitive": null,
  "infinitiveTranslation": null,
  "tenseInfo": null,
  "suggestInfinitive": false,
  "phrase": null,
  "phraseTranslation": null
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
        infinitiveTranslation: null,
        tenseInfo: null,
        suggestInfinitive: false,
        phrase: null,
        phraseTranslation: null
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
