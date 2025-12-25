import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/tutor/config - Pobierz konfigurację dla Live API
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Zwróć klucz API (w produkcji powinno się używać ephemeral tokens)
    return NextResponse.json({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'models/gemini-2.0-flash-exp', // Model wspierający Live API
    })
  } catch (error) {
    console.error('Tutor config error:', error)
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    )
  }
}
