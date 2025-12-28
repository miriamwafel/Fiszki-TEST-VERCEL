import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getModuleById } from '@/lib/grammar-modules'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// POST - wygeneruj ćwiczenia gramatyczne
export async function POST(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { moduleId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const moduleData = getModuleById(moduleId)
    if (!moduleData) {
      return NextResponse.json({ error: 'Moduł nie znaleziony' }, { status: 404 })
    }

    // Pobierz słówka użytkownika w tym języku
    const userFlashcards = await prisma.flashcard.findMany({
      where: {
        set: {
          userId: session.user.id,
          language: moduleData.grammar.language,
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    })

    const userWords = userFlashcards.map((f: { word: string; translation: string }) => `${f.word} (${f.translation})`).join(', ')

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const languageNames: Record<string, string> = {
      en: 'angielskim',
      de: 'niemieckim',
      es: 'hiszpańskim',
      fr: 'francuskim',
      it: 'włoskim',
    }

    const langName = languageNames[moduleData.grammar.language] || moduleData.grammar.language

    const prompt = `Stwórz 8 ćwiczeń gramatycznych w języku ${langName} na temat:

Temat: ${moduleData.module.title}
Poziom: ${moduleData.level.level}

${userWords ? `Użyj tych słów jeśli pasują do ćwiczeń: ${userWords}` : ''}

Stwórz DOKŁADNIE 8 ćwiczeń w formacie JSON:

{
  "exercises": [
    {
      "type": "fill_gap",
      "instruction": "Uzupełnij lukę właściwą formą czasownika",
      "sentence": "She _____ (go) to school every day.",
      "answer": "goes",
      "hint": "trzecia osoba liczby pojedynczej",
      "explanation": "W Present Simple dla he/she/it dodajemy -s lub -es do czasownika."
    },
    {
      "type": "transform",
      "instruction": "Przekształć zdanie na przeczenie",
      "sentence": "He likes coffee.",
      "answer": "He doesn't like coffee.",
      "hint": "użyj doesn't",
      "explanation": "W przeczeniu używamy doesn't + bezokolicznik (bez -s)."
    },
    {
      "type": "choose",
      "instruction": "Wybierz poprawną odpowiedź",
      "sentence": "They _____ TV every evening.",
      "options": ["watch", "watches", "watching", "watched"],
      "answer": "watch",
      "explanation": "Dla they używamy podstawowej formy czasownika."
    },
    {
      "type": "correct",
      "instruction": "Popraw błąd w zdaniu",
      "sentence": "She don't like pizza.",
      "answer": "She doesn't like pizza.",
      "hint": "zwróć uwagę na trzecią osobę",
      "explanation": "Dla he/she/it używamy doesn't, nie don't."
    }
  ]
}

Typy ćwiczeń do użycia:
- fill_gap: uzupełnianie luk
- transform: przekształcanie zdań (na pytanie, przeczenie, inną formę)
- choose: wybór z opcji
- correct: poprawianie błędów
- translate: tłumaczenie zdania (z polskiego na ${langName})

WAŻNE:
- Stwórz dokładnie 8 różnorodnych ćwiczeń
- Różne typy ćwiczeń
- Progresja trudności (od łatwiejszych do trudniejszych)
- Zwróć TYLKO poprawny JSON, bez dodatkowego tekstu`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Wyodrębnij JSON z odpowiedzi
    let exercises
    try {
      // Znajdź JSON w odpowiedzi
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        exercises = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Nie znaleziono JSON w odpowiedzi')
      }
    } catch {
      console.error('Failed to parse exercises:', responseText)
      return NextResponse.json({ error: 'Błąd parsowania ćwiczeń' }, { status: 500 })
    }

    return NextResponse.json(exercises)
  } catch (error) {
    console.error('Generate grammar exercises error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
