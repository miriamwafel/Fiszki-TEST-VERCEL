import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getModuleById } from '@/lib/grammar-modules'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// GET - pobierz szczegóły modułu i wygenerowaną treść
export async function GET(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { moduleId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Znajdź moduł
    const moduleData = getModuleById(moduleId)
    if (!moduleData) {
      return NextResponse.json({ error: 'Moduł nie znaleziony' }, { status: 404 })
    }

    // Pobierz postęp użytkownika
    let progress = await prisma.userGrammarProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: session.user.id,
          moduleId,
        },
      },
      include: {
        reviews: {
          orderBy: { scheduledDate: 'asc' },
        },
      },
    })

    // Pobierz słówka użytkownika w tym języku (do ćwiczeń)
    const userFlashcards = await prisma.flashcard.findMany({
      where: {
        set: {
          userId: session.user.id,
          language: moduleData.grammar.language,
        },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      module: moduleData.module,
      level: { level: moduleData.level.level },
      grammar: {
        language: moduleData.grammar.language,
        languageName: moduleData.grammar.languageName,
      },
      progress,
      reviews: progress?.reviews || [],
      userFlashcardsCount: userFlashcards.length,
    })
  } catch (error) {
    console.error('Get grammar module error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

// POST - rozpocznij moduł i wygeneruj treść
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

    // Sprawdź czy już istnieje postęp
    let progress = await prisma.userGrammarProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: session.user.id,
          moduleId,
        },
      },
    })

    // Jeśli już ma wygenerowaną treść, zwróć ją
    if (progress?.generatedContent) {
      return NextResponse.json({
        progress,
        content: progress.generatedContent,
      })
    }

    // Pobierz słówka użytkownika w tym języku
    const userFlashcards = await prisma.flashcard.findMany({
      where: {
        set: {
          userId: session.user.id,
          language: moduleData.grammar.language,
        },
      },
      take: 30,
      orderBy: { createdAt: 'desc' },
    })

    const userWords = userFlashcards.map((f: { word: string }) => f.word).join(', ')

    // Generuj treść modułu z AI
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const languageNames: Record<string, string> = {
      en: 'angielskim',
      de: 'niemieckim',
      es: 'hiszpańskim',
      fr: 'francuskim',
      it: 'włoskim',
    }

    const langName = languageNames[moduleData.grammar.language] || moduleData.grammar.language

    const prompt = `Jesteś nauczycielem języka ${langName}. Przygotuj kompleksową lekcję gramatyczną na temat:

Temat: ${moduleData.module.title}
Poziom: ${moduleData.level.level}
Opis: ${moduleData.module.description}

${userWords ? `Użytkownik zna te słowa, użyj ich w przykładach jeśli pasują: ${userWords}` : ''}

Struktura lekcji (w formacie Markdown):

## Wprowadzenie
Krótkie wyjaśnienie czym jest ta konstrukcja gramatyczna i kiedy jej używamy.

## Zasady
Wyjaśnij dokładnie reguły gramatyczne z podziałem na:
- Tworzenie zdań twierdzących
- Tworzenie zdań przeczących
- Tworzenie pytań

## Przykłady
Podaj minimum 10 przykładowych zdań z tłumaczeniem na polski. Użyj różnorodnych przykładów.

## Typowe błędy
Wymień 3-5 typowych błędów, które popełniają Polacy i jak ich unikać.

## Wskazówki
Praktyczne wskazówki do zapamiętania.

## Podsumowanie
Krótkie podsumowanie najważniejszych punktów.

WAŻNE:
- Pisz po polsku (wyjaśnienia)
- Przykłady w języku ${langName} z tłumaczeniem polskim
- Dostosuj poziom trudności do ${moduleData.level.level}
- Bądź praktyczny i konkretny`

    const result = await model.generateContent(prompt)
    const content = result.response.text()

    // Zapisz lub utwórz postęp
    if (progress) {
      progress = await prisma.userGrammarProgress.update({
        where: { id: progress.id },
        data: {
          generatedContent: content,
          started: true,
        },
      })
    } else {
      progress = await prisma.userGrammarProgress.create({
        data: {
          userId: session.user.id,
          moduleId,
          language: moduleData.grammar.language,
          level: moduleData.level.level,
          generatedContent: content,
          started: true,
        },
      })
    }

    return NextResponse.json({
      progress,
      content,
    })
  } catch (error) {
    console.error('Generate grammar content error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd podczas generowania' }, { status: 500 })
  }
}

// PUT - oznacz jako ukończone i utwórz harmonogram powtórek
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { moduleId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { completed, exerciseResult, exercisesDone, exercisesCorrect } = await request.json()

    const moduleData = getModuleById(moduleId)
    if (!moduleData) {
      return NextResponse.json({ error: 'Moduł nie znaleziony' }, { status: 404 })
    }

    let progress = await prisma.userGrammarProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: session.user.id,
          moduleId,
        },
      },
    })

    if (!progress) {
      return NextResponse.json({ error: 'Najpierw rozpocznij moduł' }, { status: 400 })
    }

    // Aktualizuj statystyki ćwiczeń jeśli podane
    const updateData: {
      completed?: boolean
      completedAt?: Date
      exercisesDone?: number
      exercisesCorrect?: number
    } = {}

    if (exerciseResult) {
      updateData.exercisesDone = progress.exercisesDone + (exerciseResult.total || 0)
      updateData.exercisesCorrect = progress.exercisesCorrect + (exerciseResult.correct || 0)
    } else if (exercisesDone !== undefined) {
      updateData.exercisesDone = exercisesDone
      updateData.exercisesCorrect = exercisesCorrect || 0
    }

    // Oznacz jako ukończone i utwórz powtórki
    if (completed && !progress.completed) {
      updateData.completed = true
      updateData.completedAt = new Date()

      // Pobierz ustawienia użytkownika
      const settings = await prisma.userSettings.findUnique({
        where: { userId: session.user.id },
      })
      const reviewDays = (settings?.defaultReviewDays as number[]) || [1, 5, 15, 35, 90]

      // Usuń stare powtórki dla tego modułu
      await prisma.grammarReviewSchedule.deleteMany({
        where: { progressId: progress.id },
      })

      // Utwórz nowe powtórki
      const now = new Date()
      const reviews = reviewDays.map(dayOffset => ({
        userId: session.user.id,
        progressId: progress!.id,
        scheduledDate: new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000),
        dayOffset,
      }))

      await prisma.grammarReviewSchedule.createMany({
        data: reviews,
      })
    }

    const updatedProgress = await prisma.userGrammarProgress.update({
      where: { id: progress.id },
      data: updateData,
    })

    // Pobierz powtórki osobno
    const progressReviews = await prisma.grammarReviewSchedule.findMany({
      where: { progressId: progress.id },
      orderBy: { scheduledDate: 'asc' },
    })

    return NextResponse.json({
      progress: updatedProgress,
      reviews: progressReviews,
    })
  } catch (error) {
    console.error('Update grammar progress error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
