import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (mode === 'signin') {
      navigate('/dashboard')
    } else {
      setError('Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-perceive-bg px-6 dark:bg-perceive-darkbg">
      <div className="w-full max-w-sm rounded-xl border border-perceive-border bg-perceive-card p-8 shadow-sm dark:border-gray-700 dark:bg-perceive-darkcard">
        <h1 className="mb-6 font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
          {mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            required
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-perceive-border bg-transparent px-4 py-2 outline-none focus:border-perceive-primary"
          />
          <input
            type="password"
            required
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-perceive-border bg-transparent px-4 py-2 outline-none focus:border-perceive-primary"
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-perceive-primary px-4 py-2 text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Bitte warten…' : mode === 'signin' ? 'Anmelden' : 'Registrieren'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="mt-4 text-sm text-perceive-muted hover:text-perceive-primary"
        >
          {mode === 'signin'
            ? 'Noch kein Konto? Jetzt registrieren'
            : 'Bereits ein Konto? Jetzt anmelden'}
        </button>
      </div>
    </div>
  )
}
