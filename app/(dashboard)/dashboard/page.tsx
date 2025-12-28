import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { Card } from '@/components/Card'
import { ReviewCalendar } from '@/components/ReviewCalendar'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const [setsCount, flashcardsCount, storiesCount] = await Promise.all([
    prisma.flashcardSet.count({
      where: { userId: session!.user.id },
    }),
    prisma.flashcard.count({
      where: { set: { userId: session!.user.id } },
    }),
    prisma.story.count({
      where: { userId: session!.user.id },
    }),
  ])

  const recentSets = await prisma.flashcardSet.findMany({
    where: { userId: session!.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 3,
    include: {
      _count: {
        select: { flashcards: true },
      },
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Witaj{session?.user.name ? `, ${session.user.name}` : ''}!
      </h1>

      {/* Instrukcja korzystania z aplikacji */}
      <Card className="p-6 mb-8 bg-gradient-to-r from-primary-50 to-purple-50 border-primary-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Jak korzystać z Fiszek?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-purple-600 font-bold">
              1
            </div>
            <div>
              <p className="font-medium text-gray-900">Twórz historyjki</p>
              <p className="text-sm text-gray-600">
                Generuj historyjki w wybranym języku. Klikaj na słowa aby poznać tłumaczenie i dodaj je do zestawu fiszek.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 text-primary-600 font-bold">
              2
            </div>
            <div>
              <p className="font-medium text-gray-900">Buduj zestawy fiszek</p>
              <p className="text-sm text-gray-600">
                Dodawaj słówka z historyjek lub twórz własne fiszki bezpośrednio w zestawach.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 text-green-600 font-bold">
              3
            </div>
            <div>
              <p className="font-medium text-gray-900">Ćwicz i powtarzaj</p>
              <p className="text-sm text-gray-600">
                Powtarzaj fiszki w zestawach lub twórz ćwiczenia (luki, zdania) dopasowane do Twoich słówek.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 text-yellow-600 font-bold">
              4
            </div>
            <div>
              <p className="font-medium text-gray-900">Rozmawiaj z AI</p>
              <p className="text-sm text-gray-600">
                Ćwicz konwersację z AI Tutorem - prowadź rozmowy głosowe na wybranym poziomie zaawansowania.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Przycisk CTA do rozpoczęcia */}
      <div className="mb-8 text-center">
        <Link href="/stories">
          <button className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-purple-600 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-xl hover:from-primary-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold text-base sm:text-lg w-full sm:w-auto">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-center">Rozpocznij od wygenerowania historii</span>
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
              <svg
                className="w-6 h-6 text-primary-600"
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
            <div>
              <p className="text-sm text-gray-500">Zestawy</p>
              <p className="text-2xl font-bold text-gray-900">{setsCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fiszki</p>
              <p className="text-2xl font-bold text-gray-900">{flashcardsCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Historyjki</p>
              <p className="text-2xl font-bold text-gray-900">{storiesCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Kalendarz powtórek */}
      <div className="mb-8">
        <ReviewCalendar />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Ostatnie zestawy
            </h2>
            <Link
              href="/sets"
              className="text-sm text-primary-600 hover:underline"
            >
              Zobacz wszystkie
            </Link>
          </div>

          {recentSets.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-gray-500 mb-4">
                Nie masz jeszcze żadnych zestawów
              </p>
              <Link
                href="/sets/new"
                className="inline-block bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
              >
                Utwórz pierwszy zestaw
              </Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentSets.map((set) => (
                <Link key={set.id} href={`/sets/${set.id}`}>
                  <Card variant="interactive" className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{set.name}</h3>
                        <p className="text-sm text-gray-500">
                          {set._count.flashcards} fiszek
                        </p>
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {set.language.toUpperCase()}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Szybkie akcje
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/sets/new">
              <Card variant="interactive" className="p-4 text-center">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="w-5 h-5 text-primary-600"
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
                </div>
                <p className="text-sm font-medium text-gray-900">
                  Nowy zestaw
                </p>
              </Card>
            </Link>

            <Link href="/stories">
              <Card variant="interactive" className="p-4 text-center">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="w-5 h-5 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  Generuj historię
                </p>
              </Card>
            </Link>

            <Link href="/exercises">
              <Card variant="interactive" className="p-4 text-center">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  Ćwiczenia
                </p>
              </Card>
            </Link>

            <Link href="/sets">
              <Card variant="interactive" className="p-4 text-center">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="w-5 h-5 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  Powtórki
                </p>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
