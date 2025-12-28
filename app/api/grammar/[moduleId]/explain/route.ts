import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getModuleById } from '@/lib/grammar-modules'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// POST - poproś AI o wyjaśnienie konkretnego przypadku
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

    const { sentence, answer, userAnswer, exerciseType, question } = await request.json()

    const moduleData = getModuleById(moduleId)
    if (!moduleData) {
      return NextResponse.json({ error: 'Moduł nie znaleziony' }, { status: 404 })
    }

    const languageNames: Record<string, string> = {
      en: 'angielskim',
      de: 'niemieckim',
      es: 'hiszpańskim',
      fr: 'francuskim',
      it: 'włoskim',
    }

    const langName = languageNames[moduleData.grammar.language] || moduleData.grammar.language

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const prompt = `Jesteś nauczycielem języka ${langName}. Użytkownik robi ćwiczenie gramatyczne i potrzebuje wyjaśnienia.

**KONTEKST:**
- Temat gramatyczny: ${moduleData.module.titlePl}
- Poziom: ${moduleData.level.level}
- Typ ćwiczenia: ${exerciseType}

**ĆWICZENIE:**
- Zdanie/pytanie: ${sentence}
- Poprawna odpowiedź: ${answer}
${userAnswer ? `- Odpowiedź użytkownika: ${userAnswer}` : ''}

${question ? `**PYTANIE UŻYTKOWNIKA:** ${question}` : '**ZADANIE:** Wyjaśnij dlaczego poprawna odpowiedź jest taka, a nie inna.'}

**WYMAGANIA ODPOWIEDZI:**
1. Wyjaśnij KONKRETNIE ten przypadek (nie ogólnie)
2. Jeśli użytkownik popełnił błąd, wyjaśnij dlaczego jego odpowiedź jest niepoprawna
3. Podaj regułę gramatyczną, która tu obowiązuje
4. Daj 2-3 podobne przykłady dla utrwalenia
5. Użyj emoji dla czytelności (✓, ✗, 💡, ⚠️)
6. Pisz zwięźle ale wyczerpująco
7. Format: Markdown z tabelkami jeśli potrzeba

**ODPOWIEDŹ:**`

    const result = await model.generateContent(prompt)
    const explanation = result.response.text()

    return NextResponse.json({
      explanation,
      moduleTitle: moduleData.module.titlePl,
    })
  } catch (error) {
    console.error('Generate explanation error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd podczas generowania wyjaśnienia' }, { status: 500 })
  }
}

// PUT - dodaj wyjaśnienie do teorii
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

    const { explanation, context } = await request.json()

    // Pobierz aktualny postęp
    const progress = await prisma.userGrammarProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: session.user.id,
          moduleId,
        },
      },
    })

    if (!progress || !progress.generatedContent) {
      return NextResponse.json({ error: 'Najpierw wygeneruj teorię' }, { status: 400 })
    }

    // Dodaj wyjaśnienie na końcu teorii
    const additionalContent = `

---

## 📝 Dodatkowe wyjaśnienie

${context ? `**Kontekst:** ${context}\n\n` : ''}${explanation}
`

    const updatedContent = progress.generatedContent + additionalContent

    await prisma.userGrammarProgress.update({
      where: { id: progress.id },
      data: {
        generatedContent: updatedContent,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Wyjaśnienie dodane do teorii',
    })
  } catch (error) {
    console.error('Add explanation to theory error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
