'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return // Zapobiegaj wielokrotnemu kliknięciu

    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
        setLoading(false)
      } else {
        // Użyj window.location dla pewnego przekierowania
        window.location.href = '/dashboard'
      }
    } catch {
      setError('Wystąpił błąd podczas logowania')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-primary-600">
            Fiszki
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            Zaloguj się
          </h1>
          <p className="mt-2 text-gray-600">
            Nie masz konta?{' '}
            <Link href="/register" className="text-primary-600 hover:underline">
              Zarejestruj się
            </Link>
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <Input
              id="email"
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="twoj@email.pl"
            />

            <Input
              id="password"
              type="password"
              label="Hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />

            <Button type="submit" className="w-full" loading={loading}>
              Zaloguj się
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
