import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { buildTodaysPlan } from '../utils/buildTodaysPlan'
import EnergyCheckScreen from '../components/EnergyCheckScreen'

const ENERGIE_STORAGE_KEY = 'perceive_energie_check'

const ENERGIE_PILL = {
  fit: { emoji: '🔥', label: 'Fit' },
  okay: { emoji: '😐', label: 'Geht so' },
  muede: { emoji: '😴', label: 'Müde' },
}

function heutigesDatum() {
  return new Date().toISOString().slice(0, 10)
}

function leseGespeicherteEnergie() {
  try {
    const raw = localStorage.getItem(ENERGIE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.date !== heutigesDatum()) return null
    return parsed.level ?? null
  } catch {
    return null
  }
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
  const [energyLevel, setEnergyLevel] = useState(() => leseGespeicherteEnergie())
  const [faecher, setFaecher] = useState([])
  const [bloecke, setBloecke] = useState([])
  const [fortschritt, setFortschritt] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: faecherData } = await supabase
        .from('faecher')
        .select('*')
        .order('pruefungsdatum', { ascending: true })

      const fachIds = (faecherData ?? []).map((f) => f.id)

      const [{ data: bloeckeData }, { data: fortschrittData }] = await Promise.all([
        fachIds.length
          ? supabase
              .from('bloecke')
              .select('*, fach:faecher(id, name, pruefungsdatum)')
              .in('fach_id', fachIds)
          : Promise.resolve({ data: [] }),
        supabase.from('fortschritt').select('*'),
      ])

      setFaecher(faecherData ?? [])
      setBloecke(bloeckeData ?? [])
      setFortschritt(fortschrittData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function handleEnergySelect(level) {
    localStorage.setItem(ENERGIE_STORAGE_KEY, JSON.stringify({ date: heutigesDatum(), level }))
    setEnergyLevel(level)
  }

  function handleEnergyReset() {
    localStorage.removeItem(ENERGIE_STORAGE_KEY)
    setEnergyLevel(null)
  }

  if (!energyLevel) {
    return <EnergyCheckScreen onSelect={handleEnergySelect} />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-perceive-bg dark:bg-perceive-darkbg">
        <p className="text-perceive-muted">Lädt…</p>
      </div>
    )
  }

  const fortschrittMap = new Map(fortschritt.map((f) => [f.block_id, f]))
  const beherrschteBlockIds = new Set(
    fortschritt.filter((f) => f.status === 'beherrscht').map((f) => f.block_id)
  )

  const allBlocksMitFortschritt = bloecke.map((block) => ({
    ...block,
    naechste_wiederholung: fortschrittMap.get(block.id)?.naechste_wiederholung ?? null,
  }))

  const heutigeItems = buildTodaysPlan(allBlocksMitFortschritt, energyLevel)
  const energiePill = ENERGIE_PILL[energyLevel]

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
        {faecher.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <img
              src="/per.png"
              alt="Per"
              style={{ width: 120, height: 120, objectFit: 'contain', mixBlendMode: 'multiply' }}
            />
            <p className="font-serif text-xl font-semibold text-perceive-text dark:text-perceive-bg">
              Hallo! Ich bin Per.
            </p>
            <p className="max-w-sm text-perceive-muted">
              Lade deine ersten Unterlagen hoch und ich begleite dich durch die
              Prüfungsvorbereitung.
            </p>
            <Link
              to="/upload"
              className="mt-2 rounded-lg bg-perceive-accent px-5 py-2.5 text-white transition hover:opacity-90"
            >
              + Neues Fach
            </Link>
          </div>
        ) : (
          <>
            <section className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="font-serif text-xl font-semibold text-perceive-text dark:text-perceive-bg">
                  Heute
                </h2>
                <button
                  type="button"
                  onClick={handleEnergyReset}
                  title="Energie-Check erneut öffnen"
                  className="inline-flex items-center gap-1.5 rounded-full border border-perceive-border bg-perceive-card px-3 py-1 text-sm text-perceive-text transition hover:border-perceive-primary dark:border-gray-700 dark:bg-perceive-darkcard dark:text-perceive-bg"
                >
                  <span>{energiePill.emoji}</span>
                  <span>{energiePill.label}</span>
                </button>
              </div>

              {heutigeItems.length === 0 ? (
                <div className="flex items-center gap-4 rounded-xl border border-perceive-border bg-perceive-card p-5 shadow-sm dark:border-gray-700 dark:bg-perceive-darkcard">
                  <img
                    src="/per.png"
                    alt="Per"
                    style={{ width: 60, height: 60, objectFit: 'contain', mixBlendMode: 'multiply' }}
                  />
                  <p className="text-perceive-text dark:text-perceive-bg">
                    Für heute bist du durch. Genieß die Pause.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {heutigeItems.map((item) => {
                    const badge = fortschrittMap.has(item.id) ? 'Wiederholen' : 'Neu'
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col items-start justify-between gap-3 rounded-xl border border-perceive-border bg-perceive-card p-4 shadow-sm sm:flex-row sm:items-center dark:border-gray-700 dark:bg-perceive-darkcard"
                      >
                        <div>
                          <p className="text-sm text-perceive-muted">{item.fach?.name}</p>
                          <p className="font-serif font-bold text-perceive-text dark:text-perceive-bg">
                            {item.titel}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                badge === 'Neu'
                                  ? 'bg-perceive-accent/10 text-perceive-accent'
                                  : 'bg-perceive-amber/10 text-perceive-amber'
                              }`}
                            >
                              {badge}
                            </span>
                            {item.examCritical ? (
                              <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                Prüfung in {item.tageBisPruefung}{' '}
                                {item.tageBisPruefung === 1 ? 'Tag' : 'Tagen'}!
                              </span>
                            ) : item.examUrgent ? (
                              <span className="inline-block rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                Prüfung bald
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <Link
                          to={`/lernen/${item.id}`}
                          className="rounded-lg bg-perceive-primary px-5 py-2.5 text-white transition hover:opacity-90"
                        >
                          Jetzt lernen →
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-perceive-text dark:text-perceive-bg">
                  Deine Fächer
                </h2>
                <Link
                  to="/upload"
                  className="rounded-lg bg-perceive-accent px-4 py-2 text-white transition hover:opacity-90"
                >
                  + Neues Fach
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {faecher.map((fach) => {
                  const blockIds = bloecke.filter((b) => b.fach_id === fach.id).map((b) => b.id)
                  const total = blockIds.length
                  const beherrscht = blockIds.filter((id) => beherrschteBlockIds.has(id)).length
                  const prozent = total > 0 ? Math.round((beherrscht / total) * 100) : 0
                  const tage = tageBisPruefung(fach.pruefungsdatum)

                  return (
                    <div
                      key={fach.id}
                      className="rounded-xl border border-perceive-border bg-perceive-card p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-perceive-darkcard"
                    >
                      <h3 className="font-serif text-lg font-semibold text-perceive-text dark:text-perceive-bg">
                        {fach.name}
                      </h3>
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
                        <div
                          style={{
                            background: '#E5E0D8',
                            borderRadius: 8,
                            height: 8,
                            overflow: 'hidden',
                          }}
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
                        <p className="mt-1 text-xs text-perceive-muted">
                          {beherrscht} von {total} Blöcken beherrscht
                        </p>
                      </div>

                      <Link
                        to={`/fach/${fach.id}`}
                        className="mt-4 inline-block text-sm font-medium text-perceive-primary hover:underline"
                      >
                        Zum Fach →
                      </Link>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
