import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { findVocabularyMatch } from '@/lib/vocabulary-matcher'

export const dynamic = 'force-dynamic'

// POST - Zsynchronizuj istniejące fiszki z bazą słownictwa
export async function POST(
  request: Request,
  { params }: { params: Promise<{ language: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { language } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Pobierz wszystkie fiszki użytkownika dla tego języka
    const flashcards = await prisma.flashcard.findMany({
      where: {
        set: {
          userId: session.user.id,
          language,
        },
      },
      select: {
        id: true,
        word: true,
        infinitive: true,
      },
    })

    if (flashcards.length === 0) {
      return NextResponse.json({
        message: 'Brak fiszek do synchronizacji',
        synced: 0,
        notFound: 0,
      })
    }

    let synced = 0
    let notFound = 0
    const syncedWords: string[] = []

    for (const flashcard of flashcards) {
      // Szukaj słowa głównego
      const match = await findVocabularyMatch(flashcard.word, language)

      if (match) {
        // Sprawdź czy już nie jest oznaczone jako "known"
        const existing = await prisma.userVocabularyProgress.findUnique({
          where: {
            userId_vocabularyId: {
              userId: session.user.id,
              vocabularyId: match.vocabularyId,
            },
          },
        })

        if (!existing || existing.status === 'unknown') {
          await prisma.userVocabularyProgress.upsert({
            where: {
              userId_vocabularyId: {
                userId: session.user.id,
                vocabularyId: match.vocabularyId,
              },
            },
            update: {
              status: 'learning',
              source: 'flashcard',
              sourceId: flashcard.id,
            },
            create: {
              userId: session.user.id,
              vocabularyId: match.vocabularyId,
              status: 'learning',
              source: 'flashcard',
              sourceId: flashcard.id,
            },
          })
          synced++
          syncedWords.push(flashcard.word)
        }
      } else {
        notFound++
      }

      // Jeśli fiszka ma bezokolicznik, też go oznacz
      if (flashcard.infinitive && flashcard.infinitive !== flashcard.word) {
        const infMatch = await findVocabularyMatch(flashcard.infinitive, language)

        if (infMatch) {
          const existing = await prisma.userVocabularyProgress.findUnique({
            where: {
              userId_vocabularyId: {
                userId: session.user.id,
                vocabularyId: infMatch.vocabularyId,
              },
            },
          })

          if (!existing || existing.status === 'unknown') {
            await prisma.userVocabularyProgress.upsert({
              where: {
                userId_vocabularyId: {
                  userId: session.user.id,
                  vocabularyId: infMatch.vocabularyId,
                },
              },
              update: {
                status: 'learning',
                source: 'flashcard',
                sourceId: flashcard.id,
              },
              create: {
                userId: session.user.id,
                vocabularyId: infMatch.vocabularyId,
                status: 'learning',
                source: 'flashcard',
                sourceId: flashcard.id,
              },
            })
            synced++
            syncedWords.push(flashcard.infinitive)
          }
        }
      }
    }

    return NextResponse.json({
      message: `Zsynchronizowano ${synced} słów z bazą`,
      synced,
      notFound,
      syncedWords: syncedWords.slice(0, 20), // Pokaż max 20 przykładów
    })
  } catch (error) {
    console.error('Sync flashcards error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
