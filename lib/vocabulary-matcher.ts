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
  matchType: 'exact' | 'base_form' | 'partial'
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
 */
function getBaseForms(word: string, language: string): string[] {
  const normalized = normalizeWord(word)
  const forms = [normalized]

  // Reguły dla różnych języków
  if (language === 'es') {
    // Hiszpański - czasowniki
    if (normalized.endsWith('ando') || normalized.endsWith('iendo')) {
      // gerund → infinitive
      forms.push(normalized.replace(/ando$/, 'ar'))
      forms.push(normalized.replace(/iendo$/, 'er'))
      forms.push(normalized.replace(/iendo$/, 'ir'))
    }
    if (normalized.endsWith('ado') || normalized.endsWith('ido')) {
      // past participle → infinitive
      forms.push(normalized.replace(/ado$/, 'ar'))
      forms.push(normalized.replace(/ido$/, 'er'))
      forms.push(normalized.replace(/ido$/, 'ir'))
    }
    // Rzeczowniki - liczba mnoga
    if (normalized.endsWith('es')) {
      forms.push(normalized.slice(0, -2))
      forms.push(normalized.slice(0, -2) + 'a') // niñes → niño
    }
    if (normalized.endsWith('s') && !normalized.endsWith('es')) {
      forms.push(normalized.slice(0, -1))
    }
  }

  if (language === 'en') {
    // Angielski - czasowniki
    if (normalized.endsWith('ing')) {
      forms.push(normalized.slice(0, -3))
      forms.push(normalized.slice(0, -3) + 'e') // making → make
    }
    if (normalized.endsWith('ed')) {
      forms.push(normalized.slice(0, -2))
      forms.push(normalized.slice(0, -1)) // liked → like
    }
    if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
      forms.push(normalized.slice(0, -1))
    }
    if (normalized.endsWith('ies')) {
      forms.push(normalized.slice(0, -3) + 'y') // cities → city
    }
  }

  if (language === 'de') {
    // Niemiecki
    if (normalized.endsWith('en')) {
      forms.push(normalized.slice(0, -1)) // machen → mache
    }
    if (normalized.endsWith('t')) {
      forms.push(normalized.slice(0, -1) + 'en') // macht → machen
    }
  }

  if (language === 'fr') {
    // Francuski
    if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
      forms.push(normalized.slice(0, -1))
    }
    if (normalized.endsWith('ant') || normalized.endsWith('ent')) {
      forms.push(normalized.slice(0, -3) + 'er')
      forms.push(normalized.slice(0, -3) + 'ir')
      forms.push(normalized.slice(0, -3) + 're')
    }
  }

  if (language === 'it') {
    // Włoski
    if (normalized.endsWith('ando') || normalized.endsWith('endo')) {
      forms.push(normalized.replace(/ando$/, 'are'))
      forms.push(normalized.replace(/endo$/, 'ere'))
      forms.push(normalized.replace(/endo$/, 'ire'))
    }
    if (normalized.endsWith('i') && normalized.length > 2) {
      forms.push(normalized.slice(0, -1) + 'o') // libri → libro
      forms.push(normalized.slice(0, -1) + 'e') // cani → cane
    }
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

  // 1. Szukaj dokładnego dopasowania
  const exactMatch = await prisma.vocabularyBase.findFirst({
    where: {
      language,
      word: normalized,
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

  // 3. Szukaj częściowego dopasowania (słowo zawiera się w bazie lub odwrotnie)
  const partialMatches = await prisma.vocabularyBase.findMany({
    where: {
      language,
      OR: [
        { word: { contains: normalized } },
        { word: { startsWith: normalized.slice(0, Math.max(3, normalized.length - 2)) } },
      ],
    },
    take: 5,
    orderBy: { frequencyRank: 'asc' },
  })

  if (partialMatches.length > 0) {
    // Wybierz najlepsze dopasowanie (najkrótsze słowo lub najwyższa częstotliwość)
    const best = partialMatches[0]
    return {
      vocabularyId: best.id,
      word: best.word,
      translation: best.translation,
      matchType: 'partial',
      confidence: 0.5,
    }
  }

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
