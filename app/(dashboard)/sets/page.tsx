import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'

const languageNames: Record<string, string> = {
  en: 'Angielski',
  de: 'Niemiecki',
  es: 'Hiszpański',
  fr: 'Francuski',
  it: 'Włoski',
  pt: 'Portugalski',
  ru: 'Rosyjski',
  ja: 'Japoński',
  ko: 'Koreański',
  zh: 'Chiński',
  nl: 'Holenderski',
  sv: 'Szwedzki',
  no: 'Norweski',
  da: 'Duński',
  fi: 'Fiński',
  cs: 'Czeski',
  uk: 'Ukraiński',
}

const languageFlags: Record<string, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
  it: '🇮🇹',
  pt: '🇵🇹',
  ru: '🇷🇺',
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇨🇳',
  nl: '🇳🇱',
  sv: '🇸🇪',
  no: '🇳🇴',
  da: '🇩🇰',
  fi: '🇫🇮',
  cs: '🇨🇿',
  uk: '🇺🇦',
}

export default async function SetsPage() {
  const session = await getServerSession(authOptions)

  const sets = await prisma.flashcardSet.findMany({
    where: { userId: session!.user.id },
    include: {
      _count: {
        select: { flashcards: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Grupuj zestawy po językach
  const setsByLanguage: Record<string, typeof sets> = {}
  for (const set of sets) {
    if (!setsByLanguage[set.language]) {
      setsByLanguage[set.language] = []
    }
    setsByLanguage[set.language].push(set)
  }

  // Sortuj języki - najpierw te z największą liczbą zestawów
  const sortedLanguages = Object.keys(setsByLanguage).sort(
    (a, b) => setsByLanguage[b].length - setsByLanguage[a].length
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Moje zestawy</h1>
        <Link href="/sets/new">
          <Button>
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nowy zestaw
          </Button>
        </Link>
      </div>

      {sets.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Brak zestawów
          </h2>
          <p className="text-gray-500 mb-6">
            Utwórz swój pierwszy zestaw fiszek, aby zacząć naukę!
          </p>
          <Link href="/sets/new">
            <Button>Utwórz pierwszy zestaw</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedLanguages.map((language) => (
            <div key={language}>
              {/* Nagłówek języka */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{languageFlags[language] || '🌍'}</span>
                <h2 className="text-lg font-semibold text-gray-900">
                  {languageNames[language] || language}
                </h2>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {setsByLanguage[language].length} {setsByLanguage[language].length === 1 ? 'zestaw' :
                    setsByLanguage[language].length < 5 ? 'zestawy' : 'zestawów'}
                </span>
              </div>

              {/* Zestawy dla tego języka */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {setsByLanguage[language].map((set) => (
                  <Link key={set.id} href={`/sets/${set.id}`}>
                    <Card variant="interactive" className="p-5 h-full">
                      <div className="mb-3">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {set.name}
                        </h3>
                        {set.description && (
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {set.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          {set._count.flashcards} fiszek
                        </span>
                        <span className="text-gray-400">
                          {new Date(set.updatedAt).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
