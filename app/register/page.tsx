'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne')
      return
    }

    if (password.length < 6) {
      setError('Hasło musi mieć minimum 6 znaków')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Wystąpił błąd podczas rejestracji')
        return
      }

      router.push('/login?registered=true')
    } catch {
      setError('Wystąpił błąd podczas rejestracji')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-primary-600">
            Fiszki
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            Zarejestruj się
          </h1>
          <p className="mt-2 text-gray-600">
            Masz już konto?{' '}
            <Link href="/login" className="text-primary-600 hover:underline">
              Zaloguj się
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
              id="name"
              type="text"
              label="Imię (opcjonalnie)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jan"
            />

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
              placeholder="Minimum 6 znaków"
            />

            <Input
              id="confirmPassword"
              type="password"
              label="Potwierdź hasło"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Powtórz hasło"
            />

            <Button type="submit" className="w-full" loading={loading}>
              Zarejestruj się
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
