import prisma from '@/lib/db'

/**
 * System dopasowywania słów z fiszek do bazy słownictwa.
 *
 * Obsługuje:
 * - Dokładne dopasowanie (casa = casa)
 * - Formy pochodne (casas → casa, hablando → hablar)
 * - Różne wielkości liter
 */

interface MatchResult {
  vocabularyId: string
  word: string
  translation: string
  matchType: 'exact' | 'base_form'
  confidence: number
}

/**
 * Normalizuje słowo do porównania
 */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Usuń akcenty dla porównania
}

/**
 * Próbuje znaleźć formę podstawową słowa (prosty algorytm)
 * Zwraca formy zarówno z akcentami jak i bez
 */
function getBaseForms(word: string, language: string): string[] {
  const normalized = normalizeWord(word)
  const originalLower = word.toLowerCase().trim()
  const forms: string[] = []

  // Dodaj obie wersje słowa
  if (originalLower !== normalized) {
    forms.push(originalLower)
  }
  forms.push(normalized)

  // Pomocnicza funkcja do dodawania form z i bez akcentów
  const addForm = (form: string) => {
    forms.push(form)
    const normalizedForm = normalizeWord(form)
    if (normalizedForm !== form) {
      forms.push(normalizedForm)
    }
  }

  // Reguły dla różnych języków - aplikuj do OBU wersji (z akcentami i bez)
  const applyRules = (baseWord: string) => {
    if (language === 'es') {
      // Hiszpański - czasowniki
      if (baseWord.endsWith('ando') || baseWord.endsWith('iendo')) {
        addForm(baseWord.replace(/ando$/, 'ar'))
        addForm(baseWord.replace(/iendo$/, 'er'))
        addForm(baseWord.replace(/iendo$/, 'ir'))
      }
      if (baseWord.endsWith('ado') || baseWord.endsWith('ido')) {
        addForm(baseWord.replace(/ado$/, 'ar'))
        addForm(baseWord.replace(/ido$/, 'er'))
        addForm(baseWord.replace(/ido$/, 'ir'))
      }
      // Rzeczowniki/przymiotniki - liczba mnoga
      if (baseWord.endsWith('es') && baseWord.length > 3) {
        addForm(baseWord.slice(0, -2))
        addForm(baseWord.slice(0, -2) + 'a')
        addForm(baseWord.slice(0, -2) + 'o')
      }
      if (baseWord.endsWith('s') && !baseWord.endsWith('es') && baseWord.length > 2) {
        addForm(baseWord.slice(0, -1)) // pequeños → pequeño
      }
      // Przymiotniki - rodzaj żeński → męski
      if (baseWord.endsWith('a') && baseWord.length > 2) {
        addForm(baseWord.slice(0, -1) + 'o') // pequeña → pequeño
      }
      if (baseWord.endsWith('as') && baseWord.length > 3) {
        addForm(baseWord.slice(0, -2) + 'o') // pequeñas → pequeño
      }
      if (baseWord.endsWith('os') && baseWord.length > 3) {
        addForm(baseWord.slice(0, -2) + 'o') // pequeños → pequeño
      }
    }

    if (language === 'en') {
      if (baseWord.endsWith('ing')) {
        addForm(baseWord.slice(0, -3))
        addForm(baseWord.slice(0, -3) + 'e')
      }
      if (baseWord.endsWith('ed')) {
        addForm(baseWord.slice(0, -2))
        addForm(baseWord.slice(0, -1))
      }
      if (baseWord.endsWith('s') && !baseWord.endsWith('ss') && baseWord.length > 2) {
        addForm(baseWord.slice(0, -1))
      }
      if (baseWord.endsWith('ies')) {
        addForm(baseWord.slice(0, -3) + 'y')
      }
    }

    if (language === 'de') {
      if (baseWord.endsWith('en')) {
        addForm(baseWord.slice(0, -1))
      }
      if (baseWord.endsWith('t')) {
        addForm(baseWord.slice(0, -1) + 'en')
      }
    }

    if (language === 'fr') {
      if (baseWord.endsWith('s') && !baseWord.endsWith('ss') && baseWord.length > 2) {
        addForm(baseWord.slice(0, -1))
      }
      if (baseWord.endsWith('ant') || baseWord.endsWith('ent')) {
        addForm(baseWord.slice(0, -3) + 'er')
        addForm(baseWord.slice(0, -3) + 'ir')
        addForm(baseWord.slice(0, -3) + 're')
      }
    }

    if (language === 'it') {
      if (baseWord.endsWith('ando') || baseWord.endsWith('endo')) {
        addForm(baseWord.replace(/ando$/, 'are'))
        addForm(baseWord.replace(/endo$/, 'ere'))
        addForm(baseWord.replace(/endo$/, 'ire'))
      }
      if (baseWord.endsWith('i') && baseWord.length > 2) {
        addForm(baseWord.slice(0, -1) + 'o')
        addForm(baseWord.slice(0, -1) + 'e')
      }
    }
  }

  // Aplikuj reguły do obu wersji słowa
  applyRules(originalLower)
  if (originalLower !== normalized) {
    applyRules(normalized)
  }

  return [...new Set(forms)] // Usuń duplikaty
}

/**
 * Znajduje dopasowanie słowa w bazie słownictwa
 */
export async function findVocabularyMatch(
  word: string,
  language: string
): Promise<MatchResult | null> {
  const normalized = normalizeWord(word)
  const originalLower = word.toLowerCase().trim()

  // 1. Szukaj dokładnego dopasowania - najpierw z oryginalnymi znakami, potem bez
  const exactMatch = await prisma.vocabularyBase.findFirst({
    where: {
      language,
      OR: [
        { word: originalLower },      // niño = niño
        { word: normalized },          // nino = nino (gdyby baza miała bez akcentów)
      ],
    },
  })

  if (exactMatch) {
    return {
      vocabularyId: exactMatch.id,
      word: exactMatch.word,
      translation: exactMatch.translation,
      matchType: 'exact',
      confidence: 1.0,
    }
  }

  // 2. Szukaj form podstawowych
  const baseForms = getBaseForms(word, language)

  for (const form of baseForms) {
    if (form === normalized) continue // Pomijamy oryginał

    const baseMatch = await prisma.vocabularyBase.findFirst({
      where: {
        language,
        word: form,
      },
    })

    if (baseMatch) {
      return {
        vocabularyId: baseMatch.id,
        word: baseMatch.word,
        translation: baseMatch.translation,
        matchType: 'base_form',
        confidence: 0.8,
      }
    }
  }

  // Brak dopasowania - nie używamy partial matching bo prowadzi do błędów
  return null
}

/**
 * Masowe dopasowanie wielu słów
 */
export async function findVocabularyMatches(
  words: string[],
  language: string
): Promise<Map<string, MatchResult | null>> {
  const results = new Map<string, MatchResult | null>()

  for (const word of words) {
    const match = await findVocabularyMatch(word, language)
    results.set(word, match)
  }

  return results
}

/**
 * Oznacza słówko jako nauczone (z fiszki)
 */
export async function markWordAsLearning(
  userId: string,
  word: string,
  language: string,
  flashcardId: string
): Promise<boolean> {
  const match = await findVocabularyMatch(word, language)

  if (!match) {
    return false // Słowo nie istnieje w bazie
  }

  // Sprawdź czy już nie jest oznaczone
  const existing = await prisma.userVocabularyProgress.findUnique({
    where: {
      userId_vocabularyId: {
        userId,
        vocabularyId: match.vocabularyId,
      },
    },
  })

  // Jeśli już jest "known", nie zmieniaj na "learning"
  if (existing?.status === 'known') {
    return true
  }

  // Upsert postępu
  await prisma.userVocabularyProgress.upsert({
    where: {
      userId_vocabularyId: {
        userId,
        vocabularyId: match.vocabularyId,
      },
    },
    update: {
      status: 'learning',
      source: 'flashcard',
      sourceId: flashcardId,
    },
    create: {
      userId,
      vocabularyId: match.vocabularyId,
      status: 'learning',
      source: 'flashcard',
      sourceId: flashcardId,
    },
  })

  return true
}

/**
 * Pobiera słowa z bazy, których użytkownik jeszcze nie zna
 * (do użycia przy generowaniu historyjek)
 */
export async function getUnknownWords(
  userId: string,
  language: string,
  count: number = 10,
  level?: string
): Promise<Array<{ word: string; translation: string; frequencyRank: number }>> {
  // Pobierz ID słówek, które użytkownik już zna
  const knownVocabIds = await prisma.userVocabularyProgress.findMany({
    where: {
      userId,
      vocabulary: { language },
      status: { in: ['learning', 'known'] },
    },
    select: { vocabularyId: true },
  })

  const knownIds = knownVocabIds.map(v => v.vocabularyId)

  // Pobierz następne nieznane słowa
  const whereClause: Record<string, unknown> = {
    language,
    id: { notIn: knownIds },
  }

  if (level) {
    whereClause.level = level
  }

  const words = await prisma.vocabularyBase.findMany({
    where: whereClause,
    orderBy: { frequencyRank: 'asc' },
    take: count,
    select: {
      word: true,
      translation: true,
      frequencyRank: true,
    },
  })

  return words
}
