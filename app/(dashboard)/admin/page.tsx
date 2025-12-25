'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'

interface User {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  createdAt: string
  _count: {
    sets: number
    stories: number
    practiceStats: number
  }
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        if (response.status === 403) {
          setError('Brak uprawnień administratora')
        } else {
          setError('Błąd podczas pobierania użytkowników')
        }
        return
      }
      const data = await response.json()
      setUsers(data)
    } catch {
      setError('Błąd połączenia z serwerem')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć użytkownika ${email}? Ta operacja jest nieodwracalna!`)) {
      return
    }

    setActionLoading(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Błąd podczas usuwania')
        return
      }

      setUsers(users.filter(u => u.id !== userId))
    } catch {
      alert('Błąd połączenia')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    setActionLoading(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !currentIsAdmin }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Błąd podczas aktualizacji')
        return
      }

      setUsers(users.map(u =>
        u.id === userId ? { ...u, isAdmin: !currentIsAdmin } : u
      ))
    } catch {
      alert('Błąd połączenia')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            <span className="ml-3 text-gray-500">Ładowanie...</span>
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="p-8 bg-red-50">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-red-600 text-lg font-medium">{error}</p>
            <p className="text-red-500 text-sm mt-2">
              Tylko administratorzy mają dostęp do tej strony.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Panel Administratora</h1>
        <p className="text-gray-500">Zarządzaj użytkownikami aplikacji</p>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-3xl font-bold text-primary-600">{users.length}</div>
          <div className="text-gray-500 text-sm">Użytkowników</div>
        </Card>
        <Card className="p-4">
          <div className="text-3xl font-bold text-green-600">
            {users.filter(u => u.isAdmin).length}
          </div>
          <div className="text-gray-500 text-sm">Administratorów</div>
        </Card>
        <Card className="p-4">
          <div className="text-3xl font-bold text-blue-600">
            {users.reduce((acc, u) => acc + u._count.sets, 0)}
          </div>
          <div className="text-gray-500 text-sm">Zestawów fiszek</div>
        </Card>
      </div>

      {/* Lista użytkowników */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Użytkownik
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statystyki
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data rejestracji
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.name || 'Bez nazwy'}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {user.isAdmin ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Użytkownik
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    <div className="flex gap-3">
                      <span title="Zestawy">{user._count.sets} zestawów</span>
                      <span title="Historyjki">{user._count.stories} historyjek</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                        loading={actionLoading === user.id}
                      >
                        {user.isAdmin ? 'Odbierz admin' : 'Nadaj admin'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        loading={actionLoading === user.id}
                      >
                        Usuń
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
