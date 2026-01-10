import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { gemini } from '@/lib/gemini'

const CEFR_DISTRIBUTION: Record<string, number> = {
  A1: 300,
  A2: 500,
  B1: 600,
  B2: 400,
  C1: 150,
  C2: 50,
}

const BATCH_SIZE = 50 // Mniejsze batche dla szybszego feedbacku

const languageNames: Record<string, string> = {
  en: 'angielski',
  de: 'niemiecki',
  es: 'hiszpański',
  fr: 'francuski',
  it: 'włoski',
}

function getLevelGuidelines(level: string, batchNum: number): string {
  // Różne kategorie dla różnych batchy - żeby AI generował różnorodne słowa
  const categoryRotation: Record<string, string[]> = {
    A1: [
      'powitania, pożegnania, uprzejmości',
      'liczby, dni tygodnia, miesiące',
      'kolory, kształty, rozmiary',
      'rodzina, relacje, ludzie',
      'jedzenie, napoje, posiłki',
      'dom, pokoje, meble',
      'ciało, ubrania, wygląd',
      'podstawowe czasowniki (być, mieć, iść, jeść, pić)',
    ],
    A2: [
      'zakupy, sklepy, pieniądze',
      'transport, podróże, kierunki',
      'praca, zawody, obowiązki',
      'hobby, sport, rozrywka',
      'pogoda, pory roku, natura',
      'zdrowie, lekarz, ciało',
      'uczucia, emocje, charaktery',
      'czasowniki codzienne (kupować, sprzedawać, rezerwować)',
    ],
    B1: [
      'opinie, argumenty, dyskusje',
      'doświadczenia, wspomnienia',
      'plany, marzenia, cele',
      'edukacja, szkoła, studia',
      'media, internet, technologia',
      'środowisko, ekologia',
      'kultura, sztuka, muzyka',
      'czasowniki wyrażania opinii (uważać, sądzić, wierzyć)',
    ],
    B2: [
      'idiomy i wyrażenia idiomatyczne',
      'słowa abstrakcyjne (wolność, sprawiedliwość)',
      'polityka, społeczeństwo',
      'ekonomia, biznes, finanse',
      'nauka, badania, odkrycia',
      'prawo, przestępczość',
      'psychologia, zachowania',
      'zaawansowane łączniki i spójniki',
    ],
    C1: [
      'terminologia akademicka',
      'język formalny, oficjalny',
      'terminy prawnicze',
      'słownictwo biznesowe zaawansowane',
      'medycyna, nauki ścisłe',
      'filozofia, etyka',
      'retoryka, perswazja',
      'rzadsze synonimy popularnych słów',
    ],
    C2: [
      'słowa archaiczne, literackie',
      'regionalizmy, dialekty',
      'żargon specjalistyczny',
      'subtelne różnice znaczeniowe',
      'eufemizmy, metafory',
      'słowa z konotacjami kulturowymi',
      'rzadkie idiomy',
      'język poetycki',
    ],
  }

  const categories = categoryRotation[level] || categoryRotation['A2']
  // Losowa kategoria - żeby nie było przewagi żadnej kategorii
  const categoryIndex = Math.floor(Math.random() * categories.length)
  const currentCategory = categories[categoryIndex]

  const levelDescriptions: Record<string, string> = {
    A1: 'Poziom A1 - PODSTAWOWE PRZETRWANIE',
    A2: 'Poziom A2 - CODZIENNE SYTUACJE',
    B1: 'Poziom B1 - WYRAŻANIE OPINII',
    B2: 'Poziom B2 - ABSTRAKCJA',
    C1: 'Poziom C1 - SPECJALISTYCZNE',
    C2: 'Poziom C2 - BIEGŁOŚĆ',
  }

  return `${levelDescriptions[level] || level}

KATEGORIA DLA TEGO BATCHA: ${currentCategory}
Skup się na słowach z tej kategorii!`
}

// Streaming endpoint z Server-Sent Events
export async function POST(
  request: Request,
  { params }: { params: Promise<{ language: string }> }
) {
  const session = await getServerSession(authOptions)
  const { language } = await params

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user?.isAdmin) {
    return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 })
  }

  // Parsuj body
  let targetLevel: string | null = null
  let customTargetCount: number | null = null
  try {
    const body = await request.json()
    targetLevel = body?.level || null
    customTargetCount = body?.targetCount ? parseInt(body.targetCount) : null
  } catch {
    // Brak body = generuj wszystkie poziomy
  }

  const langName = languageNames[language] || language
  const levels = targetLevel
    ? [targetLevel.toUpperCase()]
    : ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

  // Streaming response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Inicjalna wiadomość
        send({ type: 'start', message: `Rozpoczynam generowanie dla ${langName}...`, levels })

        // Pobierz max rank
        const maxRankRecord = await prisma.vocabularyBase.findFirst({
          where: { language },
          orderBy: { frequencyRank: 'desc' },
          select: { frequencyRank: true },
        })
        let globalRank = (maxRankRecord?.frequencyRank || 0) + 1

        // Pobierz WSZYSTKIE istniejące słowa dla języka (raz)
        const existingWords = await prisma.vocabularyBase.findMany({
          where: { language },
          select: { word: true },
        })
        const existingSet = new Set(existingWords.map((w: { word: string }) => w.word.toLowerCase()))

        send({ type: 'info', message: `Znaleziono ${existingSet.size} istniejących słów w bazie` })

        let totalCreated = 0
        let totalSkipped = 0

        for (const level of levels) {
          const targetCount = (targetLevel && customTargetCount) ? customTargetCount : (CEFR_DISTRIBUTION[level] || 100)

          // Sprawdź ile już mamy
          const existingLevelCount = await prisma.vocabularyBase.count({
            where: { language, level },
          })

          const neededCount = Math.max(0, targetCount - existingLevelCount)

          send({
            type: 'level_start',
            level,
            existing: existingLevelCount,
            target: targetCount,
            needed: neededCount,
          })

          if (neededCount === 0) {
            send({ type: 'level_complete', level, created: 0, skipped: 0, message: `${level}: już mamy ${existingLevelCount}/${targetCount} słów` })
            continue
          }

          let stillNeeded = neededCount
          let batchAttempts = 0
          let levelCreated = 0
          let levelSkipped = 0
          const maxAttempts = 8

          while (stillNeeded > 0 && batchAttempts < maxAttempts) {
            batchAttempts++
            const batchSize = Math.min(BATCH_SIZE, Math.ceil(stillNeeded * 1.2))

            send({
              type: 'batch_start',
              level,
              batch: batchAttempts,
              requesting: batchSize,
              stillNeeded,
            })

            // WSZYSTKIE istniejące słowa - wysyłamy całą listę do AI
            const allExistingWords = Array.from(existingSet).join(', ')

            const prompt = `Wygeneruj listę ${batchSize} NOWYCH słów w języku ${langName} dla poziomu ${level}.

${getLevelGuidelines(level, batchAttempts)}

KRYTYCZNE - LISTA ZABRONIONYCH SŁÓW (${existingSet.size} słów już w bazie):
${allExistingWords}

NIE GENERUJ ŻADNEGO SŁOWA Z POWYŻSZEJ LISTY! Każde słowo które wygenerujesz a które jest na liście zostanie odrzucone i zmarnujesz token.

Zasady:
- Czasowniki w bezokoliczniku
- Rzeczowniki w liczbie pojedynczej
- TYLKO słowa których NIE MA na liście zabronionych
- Skup się na kategorii podanej wyżej

Zwróć TYLKO JSON array:
[{"word": "słowo", "translation": "tłumaczenie PL", "partOfSpeech": "noun/verb/adjective/adverb/other", "category": "kategoria", "example": "przykładowe zdanie"}]`

            try {
              const result = await gemini.generateContent(prompt)
              const responseText = result.response.text()

              let words: Array<{
                word: string
                translation: string
                partOfSpeech: string
                category: string
                example: string
              }>

              try {
                const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
                words = JSON.parse(jsonStr)
              } catch {
                send({ type: 'batch_error', level, batch: batchAttempts, error: 'Błąd parsowania JSON' })
                continue
              }

              // Przetwarzaj słowa
              const addedWords: string[] = []
              for (const w of words) {
                if (stillNeeded <= 0) break

                const wordLower = w.word.toLowerCase().trim()

                if (existingSet.has(wordLower)) {
                  levelSkipped++
                  totalSkipped++
                  continue
                }

                try {
                  await prisma.vocabularyBase.create({
                    data: {
                      language,
                      word: wordLower,
                      translation: w.translation,
                      frequencyRank: globalRank++,
                      level,
                      partOfSpeech: w.partOfSpeech,
                      category: w.category,
                      example: w.example,
                    },
                  })
                  existingSet.add(wordLower)
                  levelCreated++
                  totalCreated++
                  stillNeeded--
                  addedWords.push(wordLower)
                } catch {
                  levelSkipped++
                  totalSkipped++
                }
              }

              send({
                type: 'batch_complete',
                level,
                batch: batchAttempts,
                added: addedWords.length,
                skipped: levelSkipped,
                words: addedWords.slice(0, 10), // Pokaż pierwsze 10 słów
                stillNeeded,
                totalCreated,
              })

              // Krótki delay między batchami
              await new Promise(resolve => setTimeout(resolve, 800))

            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error'
              send({ type: 'batch_error', level, batch: batchAttempts, error: errorMsg })
            }
          }

          send({
            type: 'level_complete',
            level,
            created: levelCreated,
            skipped: levelSkipped,
            total: existingLevelCount + levelCreated,
            target: targetCount,
          })
        }

        // Koniec
        send({
          type: 'complete',
          totalCreated,
          totalSkipped,
          message: `Zakończono! Dodano ${totalCreated} słów, pominięto ${totalSkipped} duplikatów.`,
        })

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        send({ type: 'error', error: errorMsg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
