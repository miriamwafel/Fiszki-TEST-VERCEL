import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getGrammarByLanguage, languagesWithGrammar, getModulesForLanguageAndLevel } from '@/lib/grammar-modules'

// GET - pobierz moduły gramatyczne dla języka i poziomu
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language')
    const level = searchParams.get('level')

    // Jeśli brak parametrów, zwróć listę języków z gramatyką
    if (!language) {
      return NextResponse.json({
        languages: languagesWithGrammar,
      })
    }

    const grammar = getGrammarByLanguage(language)
    if (!grammar) {
      return NextResponse.json({ error: 'Język nie obsługiwany' }, { status: 404 })
    }

    // Jeśli brak poziomu, zwróć dostępne poziomy
    if (!level) {
      return NextResponse.json({
        language: grammar.language,
        languageName: grammar.languageName,
        levels: grammar.levels.map(l => ({
          level: l.level,
          modulesCount: l.modules.length,
        })),
      })
    }

    // Pobierz moduły dla poziomu
    const modules = getModulesForLanguageAndLevel(language, level)

    // Pobierz postępy użytkownika dla tych modułów
    const moduleIds = modules.map(m => m.id)
    const userProgress = await prisma.userGrammarProgress.findMany({
      where: {
        userId: session.user.id,
        moduleId: { in: moduleIds },
      },
    })

    const progressMap = new Map(userProgress.map((p: { moduleId: string; started: boolean; completed: boolean }) => [p.moduleId, p]))

    // Połącz moduły z postępami
    const modulesWithProgress = modules.map(module => {
      const progress = progressMap.get(module.id) as { started: boolean; completed: boolean } | undefined
      return {
        ...module,
        progress: progress || null,
        started: progress?.started || false,
        completed: progress?.completed || false,
      }
    })

    return NextResponse.json({
      language,
      level,
      modules: modulesWithProgress,
    })
  } catch (error) {
    console.error('Get grammar modules error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
