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

    const prompt = `Jesteś ekspertem od języka ${langName}. Wyjaśnij KRÓTKO i KONKRETNIE.

📌 **Ćwiczenie:** ${sentence}
✅ **Odpowiedź:** ${answer}
${userAnswer && userAnswer !== answer ? `❌ **Twoja odpowiedź:** ${userAnswer}` : ''}

${question ? `❓ **Pytanie:** ${question}` : ''}

**FORMAT ODPOWIEDZI (ŚCIŚLE PRZESTRZEGAJ):**

${userAnswer && userAnswer !== answer ? `**Twój błąd:** [1 zdanie - co było źle]

` : ''}**Dlaczego "${answer}":** [1-2 zdania - konkretne wyjaśnienie]

**Reguła:** [1 zdanie - zasada gramatyczna]

**Przykłady:**
- ✅ [przykład poprawny]
- ✅ [przykład poprawny]
${userAnswer && userAnswer !== answer ? `- ❌ [przykład błędny - podobny do błędu użytkownika]` : ''}

**ZASADY:**
- MAX 100 słów całość
- ZERO wstępów typu "Jasne!", "Rozumiem"
- Konkret, nie teoria
- Proste zdania`

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
