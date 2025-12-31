import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { gemini } from '@/lib/gemini'

interface PageContext {
  pathname: string
  pageTitle: string
  selectedText?: string
  exerciseContext?: {
    word?: string
    translation?: string
    sentence?: string
  }
}

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

// POST /api/ai-chat - Chat z asystentem AI
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, context, conversationHistory } = body as {
      message: string
      context: PageContext
      conversationHistory: ConversationMessage[]
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Build context description
    let contextInfo = ''
    if (context) {
      contextInfo = `\n\n--- KONTEKST STRONY ---\n`
      contextInfo += `Lokalizacja: ${context.pathname}\n`
      contextInfo += `${context.pageTitle}\n`

      if (context.selectedText) {
        contextInfo += `\nUżytkownik zaznaczył tekst: "${context.selectedText}"\n`
      }

      if (context.exerciseContext) {
        contextInfo += `\nKontekst ćwiczenia:\n`
        if (context.exerciseContext.word) {
          contextInfo += `- Słówko: ${context.exerciseContext.word}\n`
        }
        if (context.exerciseContext.translation) {
          contextInfo += `- Tłumaczenie: ${context.exerciseContext.translation}\n`
        }
        if (context.exerciseContext.sentence) {
          contextInfo += `- Zdanie: ${context.exerciseContext.sentence}\n`
        }
      }
    }

    // Build conversation history for prompt
    let historyText = ''
    if (conversationHistory && conversationHistory.length > 0) {
      historyText = '\n\n--- HISTORIA ROZMOWY ---\n'
      // Limit to last 10 messages for context
      const recentHistory = conversationHistory.slice(-10)
      for (const msg of recentHistory) {
        historyText += msg.role === 'user' ? `Użytkownik: ${msg.content}\n` : `Asystent: ${msg.content}\n`
      }
    }

    const systemPrompt = `Jesteś pomocnym asystentem AI w aplikacji do nauki języków obcych "Fiszki".

Twoja rola:
1. Pomagasz użytkownikom zrozumieć słówka, frazy i gramatykę
2. Wyjaśniasz kontekst użycia słów i różnice w znaczeniach
3. Podajesz przykłady zdań i zastosowań
4. Odpowiadasz na pytania dotyczące nauki języków
5. Jeśli użytkownik zaznaczył tekst na stronie, pomagasz go zrozumieć
6. Znasz kontekst strony na której jest użytkownik i dostosujesz odpowiedzi

Styl odpowiedzi:
- Odpowiadaj po polsku, ale słowa/frazy w języku obcym podawaj w oryginale
- Bądź zwięzły ale pomocny (2-4 zdania dla prostych pytań, więcej dla złożonych)
- Używaj formatowania markdown gdy to pomaga (np. listy, **pogrubienia**)
- Przy tłumaczeniach podawaj też kontekst użycia
- Dla czasowników wskaż formę podstawową (bezokolicznik)
- Bądź przyjazny i zachęcający do nauki
${contextInfo}
${historyText}

Użytkownik napisał: "${message}"

Odpowiedz pomocnie i zwięźle.`

    const result = await gemini.generateContent(systemPrompt)
    const response = result.response.text()

    return NextResponse.json({ response })
  } catch (error) {
    console.error('AI Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process AI chat request' },
      { status: 500 }
    )
  }
}
