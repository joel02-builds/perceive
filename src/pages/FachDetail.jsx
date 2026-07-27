import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_LABEL = {
  neu: 'Neu',
  gelernt: 'Gelernt',
  wiederholen: 'Wiederholen',
  beherrscht: 'Beherrscht',
}

export default function FachDetail() {
  const { id } = useParams()
  const [fach, setFach] = useState(null)
  const [bloecke, setBloecke] = useState([])
  const [fortschritt, setFortschritt] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFach() {
      const [{ data: fachData }, { data: blockData }, { data: fortschrittData }] =
        await Promise.all([
          supabase.from('faecher').select('*').eq('id', id).single(),
          supabase
            .from('bloecke')
            .select('*')
            .eq('fach_id', id)
            .order('reihenfolge', { ascending: true }),
          supabase.from('fortschritt').select('*'),
        ])

      setFach(fachData)
      setBloecke(blockData ?? [])
      setFortschritt(
        Object.fromEntries((fortschrittData ?? []).map((f) => [f.block_id, f]))
      )
      setLoading(false)
    }
    loadFach()
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-perceive-bg dark:bg-perceive-darkbg">
        <p className="text-perceive-muted">Lädt…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-perceive-bg dark:bg-perceive-darkbg">
      <header className="mx-auto max-w-5xl px-6 py-6">
        <Link to="/dashboard" className="text-sm text-perceive-muted hover:text-perceive-primary">
          ← Zurück zum Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-4">
        <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
          {fach?.name}
        </h1>
        {fach?.pruefungsdatum && (
          <p className="mt-1 text-perceive-muted">
            Prüfung am {new Date(fach.pruefungsdatum).toLocaleDateString('de-DE')}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {bloecke.map((block) => {
            const status = fortschritt[block.id]?.status ?? 'neu'
            return (
              <Link
                key={block.id}
                to={`/lernen/${block.id}`}
                className="flex items-center justify-between rounded-xl border border-perceive-border bg-perceive-card p-4 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-perceive-darkcard"
              >
                <span className="font-medium text-perceive-text dark:text-perceive-bg">
                  {block.titel}
                </span>
                <span className="rounded-full bg-perceive-bg px-3 py-1 text-xs text-perceive-muted dark:bg-perceive-darkbg">
                  {STATUS_LABEL[status]}
                </span>
              </Link>
            )
          })}

          {bloecke.length === 0 && (
            <p className="text-perceive-muted">
              Für dieses Fach wurden noch keine Lernblöcke erstellt.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
