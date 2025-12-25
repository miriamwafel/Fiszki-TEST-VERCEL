import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export const gemini = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
})

export interface TranslationResult {
  word: string
  translation: string
  partOfSpeech: string
  context?: string
  infinitive?: string
  hasMultipleMeanings: boolean
  alternativeMeanings?: string[]
  suggestInfinitive?: boolean
}

export async function translateWord(
  word: string,
  fromLanguage: string
): Promise<TranslationResult> {
  const prompt = `Przetłumacz słowo "${word}" z języka ${fromLanguage} na polski.

Odpowiedz w formacie JSON:
{
  "word": "${word}",
  "translation": "tłumaczenie po polsku",
  "partOfSpeech": "część mowy (np. verb, noun, adjective, adverb)",
  "context": "dodatkowy kontekst lub przykład użycia",
  "infinitive": "jeśli to czasownik w formie odmienionej, podaj bezokolicznik, w przeciwnym razie null",
  "hasMultipleMeanings": true/false,
  "alternativeMeanings": ["alternatywne znaczenie 1", "alternatywne znaczenie 2"],
  "suggestInfinitive": true jeśli słowo to odmieniony czasownik i warto dodać bezokolicznik jako osobną fiszkę
}

Odpowiedz TYLKO JSON, bez dodatkowego tekstu.`

  const result = await gemini.generateContent(prompt)
  const response = result.response.text()

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Invalid response format from Gemini')
  }

  return JSON.parse(jsonMatch[0])
}

export interface StoryResult {
  title: string
  content: string
  vocabulary: { word: string; translation: string }[]
}

export async function generateStory(
  language: string,
  wordCount: number,
  difficulty: string
): Promise<StoryResult> {
  const difficultyDescriptions: Record<string, string> = {
    'A1': 'bardzo prosty, podstawowe słownictwo, proste zdania',
    'A2': 'prosty, częste słowa, krótkie zdania',
    'B1': 'średnio zaawansowany, różnorodne słownictwo',
    'B2': 'zaawansowany, złożone struktury gramatyczne',
    'C1': 'wysoko zaawansowany, idiomy i wyrażenia potoczne',
    'C2': 'poziom native, skomplikowane słownictwo i styl',
  }

  const prompt = `Napisz krótką historię/opowiadanie w języku ${language}.

Wymagania:
- Około ${wordCount} słów
- Poziom trudności: ${difficulty} (${difficultyDescriptions[difficulty] || difficulty})
- Historia powinna być interesująca i angażująca
- Używaj różnorodnego słownictwa odpowiedniego do poziomu

Odpowiedz w formacie JSON:
{
  "title": "Tytuł historii w ${language}",
  "content": "Treść historii...",
  "vocabulary": [
    {"word": "słowo1", "translation": "tłumaczenie1"},
    {"word": "słowo2", "translation": "tłumaczenie2"}
  ]
}

Vocabulary powinno zawierać 10-15 najważniejszych/najtrudniejszych słów z historii z tłumaczeniami na polski.

Odpowiedz TYLKO JSON, bez dodatkowego tekstu.`

  const result = await gemini.generateContent(prompt)
  const response = result.response.text()

  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Invalid response format from Gemini')
  }

  return JSON.parse(jsonMatch[0])
}

export interface GapExercise {
  sentence: string
  word: string
  hint: string
}

export async function generateGapExercise(
  word: string,
  translation: string,
  language: string
): Promise<GapExercise> {
  const prompt = `Stwórz ćwiczenie z luką dla słowa "${word}" (${translation}) w języku ${language}.

Odpowiedz w formacie JSON:
{
  "sentence": "Zdanie z _____ zamiast słowa do uzupełnienia",
  "word": "${word}",
  "hint": "podpowiedź po polsku"
}

Zdanie powinno być naturalne i pomagać zrozumieć kontekst użycia słowa.

Odpowiedz TYLKO JSON, bez dodatkowego tekstu.`

  const result = await gemini.generateContent(prompt)
  const response = result.response.text()

  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Invalid response format from Gemini')
  }

  return JSON.parse(jsonMatch[0])
}

export interface SentenceExercise {
  targetWord: string
  contextWords: string[]
  exampleSentence: string
  hint: string
}

export async function generateSentenceExercise(
  word: string,
  translation: string,
  language: string
): Promise<SentenceExercise> {
  const prompt = `Stwórz ćwiczenie na układanie zdań dla słowa "${word}" (${translation}) w języku ${language}.

Zadanie: Daj 3 słowa kontekstowe, które pasują tematycznie do słowa "${word}", a użytkownik ma ułożyć z nimi wszystkimi zdanie.

Odpowiedz w formacie JSON:
{
  "targetWord": "${word}",
  "contextWords": ["słowo1", "słowo2", "słowo3"],
  "exampleSentence": "Przykładowe poprawne zdanie używające wszystkich słów",
  "hint": "podpowiedź po polsku co zdanie mogłoby opisywać"
}

Słowa kontekstowe powinny być powiązane tematycznie i ułatwiać stworzenie sensownego zdania.

Odpowiedz TYLKO JSON, bez dodatkowego tekstu.`

  const result = await gemini.generateContent(prompt)
  const response = result.response.text()

  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Invalid response format from Gemini')
  }

  return JSON.parse(jsonMatch[0])
}

export async function checkSentence(
  sentence: string,
  targetWord: string,
  contextWords: string[],
  language: string
): Promise<{ correct: boolean; feedback: string; correctedSentence?: string }> {
  const prompt = `Sprawdź zdanie w języku ${language}:
"${sentence}"

Wymagania:
- Zdanie musi zawierać słowo: "${targetWord}"
- Zdanie musi zawierać słowa: ${contextWords.join(', ')}
- Zdanie musi być poprawne gramatycznie
- Zdanie musi mieć sens

Odpowiedz w formacie JSON:
{
  "correct": true/false,
  "feedback": "informacja zwrotna po polsku - co jest dobrze/źle",
  "correctedSentence": "poprawiona wersja zdania jeśli było błędne, lub null jeśli poprawne"
}

Odpowiedz TYLKO JSON, bez dodatkowego tekstu.`

  const result = await gemini.generateContent(prompt)
  const response = result.response.text()

  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Invalid response format from Gemini')
  }

  return JSON.parse(jsonMatch[0])
}

// AI Tutor - rozmowa głosowa z nauczycielem języka
export interface TutorMessage {
  role: 'user' | 'tutor'
  content: string
}

export interface TutorResponse {
  response: string
  correction?: string
  vocabulary?: { word: string; translation: string }[]
}

const languageNames: Record<string, string> = {
  en: 'angielski',
  de: 'niemiecki',
  es: 'hiszpański',
  fr: 'francuski',
  it: 'włoski',
  pt: 'portugalski',
  ru: 'rosyjski',
  ja: 'japoński',
  ko: 'koreański',
  zh: 'chiński',
  nl: 'holenderski',
  sv: 'szwedzki',
  no: 'norweski',
  da: 'duński',
  fi: 'fiński',
  cs: 'czeski',
  uk: 'ukraiński',
}

export async function tutorChat(
  userMessage: string,
  language: string,
  flashcards: { word: string; translation: string }[],
  conversationHistory: TutorMessage[]
): Promise<TutorResponse> {
  const langName = languageNames[language] || language

  const flashcardsContext = flashcards.length > 0
    ? `\n\nFiszki ucznia (słownictwo do ćwiczenia):\n${flashcards.map(f => `- ${f.word} = ${f.translation}`).join('\n')}`
    : ''

  const historyContext = conversationHistory.length > 0
    ? `\n\nDotychczasowa rozmowa:\n${conversationHistory.map(m =>
        m.role === 'user' ? `Uczeń: ${m.content}` : `Nauczyciel: ${m.content}`
      ).join('\n')}`
    : ''

  const prompt = `Jesteś przyjaznym nauczycielem języka ${langName} dla polskiego ucznia.

Twoja rola:
1. Prowadzisz naturalną rozmowę w języku ${langName}, ale możesz mieszać z polskim gdy tłumaczysz
2. Poprawiasz błędy ucznia - wyjaśniaj po polsku co było źle i jak powinno być
3. Używasz słownictwa z fiszek ucznia w rozmowie
4. Zadajesz pytania zachęcające do używania nowych słów
5. Chwal postępy, ale bądź szczery gdy coś wymaga poprawy
6. Mów prostym językiem odpowiednim dla ucznia
7. Odpowiadaj zwięźle (2-4 zdania), jak w naturalnej rozmowie

WAŻNE: Odpowiadaj naturalnie, mieszając język ${langName} z polskimi wyjaśnieniami. Na przykład:
- "Das ist sehr gut! Bardzo dobrze! A teraz spróbuj powiedzieć..."
- "Hmm, powiedziałeś 'ich gehe', ale tutaj lepiej pasuje 'ich bin gegangen' - bo to przeszłość."
${flashcardsContext}
${historyContext}

Uczeń właśnie powiedział: "${userMessage}"

Odpowiedz w formacie JSON:
{
  "response": "Twoja odpowiedź jako nauczyciela (naturalny mix ${langName} i polskiego)",
  "correction": "Jeśli uczeń zrobił błąd językowy - opisz go po polsku i podaj poprawną formę. Jeśli nie było błędów - null",
  "vocabulary": [
    {"word": "nowe słowo", "translation": "tłumaczenie"}
  ]
}

Pole vocabulary to lista nowych słów które użyłeś w odpowiedzi i warto by uczeń je zapamiętał (max 2-3 słowa, lub pusta lista).

Odpowiedz TYLKO JSON, bez dodatkowego tekstu.`

  const result = await gemini.generateContent(prompt)
  const response = result.response.text()

  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Invalid response format from Gemini')
  }

  return JSON.parse(jsonMatch[0])
}

// Rozpoczęcie rozmowy z tutorem
export async function startTutorConversation(
  language: string,
  flashcards: { word: string; translation: string }[]
): Promise<TutorResponse> {
  const langName = languageNames[language] || language

  const flashcardsContext = flashcards.length > 0
    ? `Fiszki ucznia do ćwiczenia:\n${flashcards.slice(0, 10).map(f => `- ${f.word} = ${f.translation}`).join('\n')}`
    : 'Uczeń nie ma jeszcze fiszek.'

  const prompt = `Jesteś przyjaznym nauczycielem języka ${langName} dla polskiego ucznia.

Rozpocznij rozmowę z uczniem. Przywitaj się, przedstaw się krótko i zachęć do rozmowy.
Użyj prostego języka, mieszając ${langName} z polskim.

${flashcardsContext}

Odpowiedz w formacie JSON:
{
  "response": "Twoje powitanie jako nauczyciela (naturalny mix ${langName} i polskiego)",
  "correction": null,
  "vocabulary": [
    {"word": "słowo które użyłeś", "translation": "tłumaczenie"}
  ]
}

Odpowiedz TYLKO JSON, bez dodatkowego tekstu.`

  const result = await gemini.generateContent(prompt)
  const response = result.response.text()

  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Invalid response format from Gemini')
  }

  return JSON.parse(jsonMatch[0])
}
