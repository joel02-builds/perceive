import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_LABEL = {
  neu: 'Neu',
  gelernt: 'Gelernt',
  wiederholen: 'Wiederholen',
  beherrscht: 'Beherrscht',
}

const STATUS_BADGE_CLASS = {
  neu: 'bg-perceive-bg text-perceive-muted dark:bg-perceive-darkbg',
  gelernt: 'bg-perceive-primary/10 text-perceive-primary',
  wiederholen: 'bg-perceive-amber/10 text-perceive-amber',
  beherrscht: 'bg-perceive-accent/10 text-perceive-accent',
}

function SchwierigkeitDots({ level }) {
  return (
    <span className="tracking-wider text-perceive-muted" aria-label={`Schwierigkeit ${level} von 5`}>
      {'●'.repeat(level)}
      {'○'.repeat(5 - level)}
    </span>
  )
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

  const total = bloecke.length
  const beherrscht = bloecke.filter(
    (block) => (fortschritt[block.id]?.status ?? 'neu') === 'beherrscht'
  ).length
  const prozent = total > 0 ? Math.round((beherrscht / total) * 100) : 0

  const sortierteBloecke = [...bloecke].sort((a, b) => {
    const statusA = fortschritt[a.id]?.status ?? 'neu'
    const statusB = fortschritt[b.id]?.status ?? 'neu'
    const aFertig = statusA === 'beherrscht' ? 1 : 0
    const bFertig = statusB === 'beherrscht' ? 1 : 0
    if (aFertig !== bFertig) return aFertig - bFertig
    return a.reihenfolge - b.reihenfolge
  })

  return (
    <div className="min-h-screen bg-perceive-bg dark:bg-perceive-darkbg">
      <header className="mx-auto max-w-3xl px-6 py-6">
        <Link to="/dashboard" className="text-sm text-perceive-muted hover:text-perceive-primary">
          ← Zurück zum Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-4">
        <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
          {fach?.name}
        </h1>
        {fach?.pruefungsdatum && (
          <p className="mt-1 text-perceive-muted">
            Prüfung am {new Date(fach.pruefungsdatum).toLocaleDateString('de-DE')}
          </p>
        )}

        <div className="mt-4">
          <div
            style={{ background: '#E5E0D8', borderRadius: 8, height: 8, overflow: 'hidden' }}
          >
            <div
              style={{
                background: '#5BA08A',
                width: `${prozent}%`,
                borderRadius: 8,
                height: 8,
              }}
            />
          </div>
          <p className="mt-1 text-sm text-perceive-muted">
            {beherrscht} von {total} Blöcken beherrscht
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {sortierteBloecke.map((block) => {
            const status = fortschritt[block.id]?.status ?? 'neu'
            return (
              <div
                key={block.id}
                className="rounded-xl border border-perceive-border bg-perceive-card p-5 shadow-sm dark:border-gray-700 dark:bg-perceive-darkcard"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-lg font-semibold text-perceive-text dark:text-perceive-bg">
                    {block.titel}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>

                {block.kernaussage && (
                  <div
                    style={{
                      background: '#F0F7F4',
                      borderLeft: '3px solid #5BA08A',
                      borderRadius: 8,
                      padding: '1rem',
                      marginTop: '0.75rem',
                    }}
                  >
                    <p style={{ color: '#5BA08A', fontWeight: 600 }}>
                      Das Wichtigste: {block.kernaussage}
                    </p>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <SchwierigkeitDots level={block.schwierigkeit ?? 3} />
                  <Link
                    to={`/lernen/${block.id}`}
                    className="rounded-lg bg-perceive-primary px-4 py-2 text-sm text-white transition hover:opacity-90"
                  >
                    Jetzt lernen →
                  </Link>
                </div>
              </div>
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
