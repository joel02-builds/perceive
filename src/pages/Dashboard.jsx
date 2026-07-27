import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

function tageBisPruefung(pruefungsdatum) {
  if (!pruefungsdatum) return null
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const pruefung = new Date(pruefungsdatum)
  pruefung.setHours(0, 0, 0, 0)
  return Math.ceil((pruefung - heute) / (1000 * 60 * 60 * 24))
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [faecher, setFaecher] = useState([])
  const [bloecke, setBloecke] = useState([])
  const [beherrschteBlockIds, setBeherrschteBlockIds] = useState(new Set())
  const [lernplanHeute, setLernplanHeute] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: faecherData } = await supabase
        .from('faecher')
        .select('*')
        .order('pruefungsdatum', { ascending: true })

      const fachIds = (faecherData ?? []).map((f) => f.id)
      const heuteStr = toDateStr(new Date())

      const [{ data: bloeckeData }, { data: fortschrittData }, { data: lernplanData }] =
        await Promise.all([
          fachIds.length
            ? supabase.from('bloecke').select('id, fach_id').in('fach_id', fachIds)
            : Promise.resolve({ data: [] }),
          supabase.from('fortschritt').select('block_id').eq('status', 'beherrscht'),
          supabase
            .from('lernplan')
            .select('block_id')
            .eq('datum', heuteStr)
            .eq('erledigt', false),
        ])

      setFaecher(faecherData ?? [])
      setBloecke(bloeckeData ?? [])
      setBeherrschteBlockIds(new Set((fortschrittData ?? []).map((f) => f.block_id)))
      setLernplanHeute(lernplanData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-perceive-bg dark:bg-perceive-darkbg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-serif text-xl font-semibold text-perceive-text dark:text-perceive-bg">
          Perceive
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-perceive-muted">{user?.email}</span>
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-perceive-muted hover:text-perceive-primary"
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
            Deine Fächer
          </h1>
          <Link
            to="/upload"
            className="rounded-lg bg-perceive-accent px-4 py-2 text-white transition hover:opacity-90"
          >
            + Neues Fach
          </Link>
        </div>

        {loading && <p className="text-perceive-muted">Lädt…</p>}

        {!loading && faecher.length === 0 && (
          <p className="text-perceive-muted">
            Noch keine Fächer angelegt. Lade deine ersten Unterlagen hoch, um loszulegen.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {faecher.map((fach) => {
            const blockIds = bloecke.filter((b) => b.fach_id === fach.id).map((b) => b.id)
            const total = blockIds.length
            const beherrscht = blockIds.filter((id) => beherrschteBlockIds.has(id)).length
            const fortschrittProzent = total > 0 ? Math.round((beherrscht / total) * 100) : 0
            const heutigerEintrag = lernplanHeute.find((l) => blockIds.includes(l.block_id))
            const tage = tageBisPruefung(fach.pruefungsdatum)

            return (
              <div
                key={fach.id}
                className="relative rounded-xl border border-perceive-border bg-perceive-card p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-perceive-darkcard"
              >
                {!heutigerEintrag && (
                  <img
                    src="/per.png"
                    alt=""
                    style={{
                      width: 32,
                      height: 32,
                      objectFit: 'contain',
                      mixBlendMode: 'multiply',
                    }}
                    className="absolute right-4 top-4 opacity-70"
                  />
                )}

                <Link to={`/fach/${fach.id}`} className="block">
                  <h2 className="font-serif text-lg font-semibold text-perceive-text dark:text-perceive-bg">
                    {fach.name}
                  </h2>
                  {tage !== null && (
                    <p className="mt-1 text-sm text-perceive-muted">
                      {tage > 0
                        ? `noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'}`
                        : tage === 0
                          ? 'Prüfung ist heute'
                          : 'Prüfung ist vorbei'}
                    </p>
                  )}

                  <div className="mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-perceive-bg dark:bg-perceive-darkbg">
                      <div
                        className="h-full rounded-full bg-perceive-accent transition-all"
                        style={{ width: `${fortschrittProzent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-perceive-muted">
                      {beherrscht} von {total} Blöcken beherrscht
                    </p>
                  </div>
                </Link>

                {heutigerEintrag && (
                  <Link
                    to={`/lernen/${heutigerEintrag.block_id}`}
                    className="mt-4 block rounded-lg bg-perceive-primary px-4 py-2 text-center text-sm text-white transition hover:opacity-90"
                  >
                    Heute lernen
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
