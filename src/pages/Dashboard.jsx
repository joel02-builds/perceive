import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { istFaellig } from '../lib/spacedRepetition'
import { buildTodaysPlan } from '../utils/buildTodaysPlan'
import EnergyCheckScreen from '../components/EnergyCheckScreen'

const ENERGIE_STORAGE_KEY = 'perceive_energie_check'

const ENERGIE_PILL = {
  fit: { emoji: '🔥', label: 'Fit' },
  okay: { emoji: '😐', label: 'Geht so' },
  muede: { emoji: '😴', label: 'Müde' },
}

const WOCHENTAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

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

function pruefungsdatumFarbe(tage) {
  if (tage === null) return 'text-[var(--muted-2)]'
  if (tage < 6) return 'text-[var(--danger)]'
  if (tage <= 10) return 'text-perceive-amber'
  return 'text-[var(--muted-2)]'
}

// Gruppiert alle Blöcke nach naechste_wiederholung für die nächsten 6 Tage.
// Überfällige und neue (naechste_wiederholung = null) Blöcke zählen zu "heute".
function berechneWochenVorschau(allBlocks) {
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)

  const tage = Array.from({ length: 6 }, (_, i) => {
    const datum = new Date(heute)
    datum.setDate(datum.getDate() + i)
    return datum
  })
  const zaehler = tage.map(() => 0)

  for (const block of allBlocks) {
    const datum = block.naechste_wiederholung ? new Date(block.naechste_wiederholung) : heute
    datum.setHours(0, 0, 0, 0)

    if (datum <= heute) {
      zaehler[0] += 1
      continue
    }
    const diffTage = Math.round((datum - heute) / (1000 * 60 * 60 * 24))
    if (diffTage < 6) zaehler[diffTage] += 1
  }

  return tage.map((datum, i) => ({ datum, anzahl: zaehler[i] }))
}

function Badge({ farbe, children }) {
  const paletten = {
    neu: 'border-[var(--badge-neu-border)] bg-[var(--badge-neu-bg)] text-perceive-primary',
    wiederholen:
      'border-[var(--badge-wiederholen-border)] bg-[var(--badge-wiederholen-bg)] text-perceive-accent',
    critical:
      'border-red-200 bg-red-50 text-[var(--danger)] dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400',
    urgent:
      'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900/40 dark:bg-orange-900/20 dark:text-orange-400',
  }
  return (
    <span
      className={`inline-block rounded-[4px] border px-2 py-0.5 text-[11px] font-medium ${paletten[farbe]}`}
    >
      {children}
    </span>
  )
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [energyLevel, setEnergyLevel] = useState(() => leseGespeicherteEnergie())
  const [faecher, setFaecher] = useState([])
  const [bloecke, setBloecke] = useState([])
  const [fortschritt, setFortschritt] = useState([])
  const [loading, setLoading] = useState(true)
  const [avatarMenuOffen, setAvatarMenuOffen] = useState(false)

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
  const [heroItem, ...restItems] = heutigeItems
  const energiePill = ENERGIE_PILL[energyLevel]
  const wochenVorschau = berechneWochenVorschau(allBlocksMitFortschritt)
  const initiale = user?.email?.[0]?.toUpperCase() ?? '?'

  function renderBadges(item) {
    const istNeu = !fortschrittMap.has(item.id)
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Badge farbe={istNeu ? 'neu' : 'wiederholen'}>{istNeu ? 'Neu' : 'Wiederholen'}</Badge>
        {item.examCritical ? (
          <Badge farbe="critical">
            Prüfung in {item.tageBisPruefung} {item.tageBisPruefung === 1 ? 'Tag' : 'Tagen'}!
          </Badge>
        ) : item.examUrgent ? (
          <Badge farbe="urgent">Prüfung bald</Badge>
        ) : null}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-perceive-bg dark:bg-perceive-darkbg">
      <header className="mx-auto flex max-w-[760px] items-center justify-between border-b border-[var(--card-border)] px-4 py-6 sm:px-8">
        <span className="font-serif text-xl font-bold text-[var(--heading)]">Perceive</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAvatarMenuOffen((offen) => !offen)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-perceive-primary text-sm font-medium text-white transition hover:opacity-90"
          >
            {initiale}
          </button>

          {avatarMenuOffen && (
            <>
              <button
                type="button"
                aria-label="Menü schließen"
                onClick={() => setAvatarMenuOffen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-[var(--card-border)] bg-perceive-card p-3 shadow-md dark:border-gray-700 dark:bg-perceive-darkcard">
                <p className="truncate text-sm text-[var(--muted-2)]">{user?.email}</p>
                <button
                  type="button"
                  onClick={signOut}
                  className="mt-2 w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-left text-sm text-[var(--heading)] transition hover:bg-perceive-bg dark:border-gray-700 dark:hover:bg-perceive-darkbg"
                >
                  Abmelden
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-8 sm:px-8">
        {faecher.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <img
              src="/per.png"
              alt="Per"
              style={{ width: 120, height: 120, objectFit: 'contain', mixBlendMode: 'multiply' }}
            />
            <p className="font-serif text-xl font-semibold text-[var(--heading)]">
              Hallo! Ich bin Per.
            </p>
            <p className="max-w-sm text-[var(--muted-2)]">
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
            <section className="mb-8">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="font-serif text-[22px] font-semibold text-[var(--heading)]">
                  Heute
                </h2>
                <button
                  type="button"
                  onClick={handleEnergyReset}
                  title="Energie-Check erneut öffnen"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-perceive-card px-3 py-1 text-sm text-[var(--heading)] transition hover:border-perceive-primary dark:border-gray-700 dark:bg-perceive-darkcard"
                >
                  <span>{energiePill.emoji}</span>
                  <span>{energiePill.label}</span>
                </button>
              </div>

              {!heroItem ? (
                <div className="flex items-center gap-4 rounded-xl border border-[var(--card-border)] bg-perceive-card p-5 dark:border-gray-700 dark:bg-perceive-darkcard">
                  <img
                    src="/per.png"
                    alt="Per"
                    style={{ width: 60, height: 60, objectFit: 'contain', mixBlendMode: 'multiply' }}
                  />
                  <p className="text-[var(--heading)]">Für heute bist du durch. Genieß die Pause.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Hero-Karte: der erste, wichtigste Block */}
                  <div
                    className="rounded-xl p-6"
                    style={{
                      backgroundColor: 'var(--hero-bg)',
                      borderLeft: '3px solid var(--color-accent)',
                    }}
                  >
                    <p
                      className="text-[11px] font-medium text-perceive-accent"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      Jetzt anfangen
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--muted-2)]">{heroItem.fach?.name}</p>
                    <p className="mt-1 font-serif text-[20px] font-semibold text-[var(--heading)]">
                      {heroItem.titel}
                    </p>
                    {renderBadges(heroItem)}
                    <Link
                      to={`/lernen/${heroItem.id}`}
                      className="mt-4 inline-block rounded-lg bg-perceive-primary px-5 py-2.5 text-white transition hover:opacity-90"
                    >
                      Jetzt lernen →
                    </Link>
                  </div>

                  {/* Weitere Blöcke: kompakter, mit Ghost-Button */}
                  {restItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[var(--card-border)] bg-perceive-card p-4 sm:flex-row sm:items-center dark:border-gray-700 dark:bg-perceive-darkcard"
                    >
                      <div>
                        <p className="text-[12px] text-[var(--muted-2)]">{item.fach?.name}</p>
                        <p className="text-[15px] font-semibold text-[var(--heading)]">
                          {item.titel}
                        </p>
                        {renderBadges(item)}
                      </div>
                      <Link
                        to={`/lernen/${item.id}`}
                        className="rounded-lg border border-perceive-primary px-5 py-2.5 text-perceive-primary transition hover:bg-perceive-primary/10"
                      >
                        Jetzt lernen →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-10">
              <p
                className="mb-2 text-[12px] text-[var(--muted-2)]"
                style={{ letterSpacing: '0.06em' }}
              >
                Diese Woche
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {wochenVorschau.map(({ datum, anzahl }, i) => {
                  const istHeute = i === 0
                  return (
                    <div
                      key={datum.toISOString()}
                      className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl"
                      style={{
                        minWidth: 52,
                        height: 60,
                        backgroundColor: istHeute
                          ? 'var(--color-primary)'
                          : anzahl > 0
                            ? 'var(--hero-bg)'
                            : 'transparent',
                        color: istHeute
                          ? '#FFFFFF'
                          : anzahl > 0
                            ? 'var(--color-primary)'
                            : 'var(--pill-inactive-text)',
                      }}
                    >
                      <span
                        className="text-[11px]"
                        style={{ opacity: istHeute ? 0.7 : 1 }}
                      >
                        {WOCHENTAGE_KURZ[datum.getDay()]}
                      </span>
                      <span className="font-serif text-[20px] font-bold">
                        {anzahl > 0 ? anzahl : '–'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-[22px] font-semibold text-[var(--heading)]">
                  Deine Fächer
                </h2>
                <Link
                  to="/upload"
                  className="rounded-lg bg-perceive-accent px-4 py-2 text-white transition hover:opacity-90"
                >
                  + Neues Fach
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {faecher.map((fach) => {
                  const fachBloecke = bloecke.filter((b) => b.fach_id === fach.id)
                  const blockIds = fachBloecke.map((b) => b.id)
                  const total = blockIds.length
                  const beherrscht = blockIds.filter((id) => beherrschteBlockIds.has(id)).length
                  const prozent = total > 0 ? Math.round((beherrscht / total) * 100) : 0
                  const tage = tageBisPruefung(fach.pruefungsdatum)
                  const heuteGeplant = fachBloecke.filter((block) =>
                    istFaellig(fortschrittMap.get(block.id)?.naechste_wiederholung ?? null)
                  ).length

                  return (
                    <div
                      key={fach.id}
                      className="rounded-xl border border-[var(--card-border)] bg-perceive-card p-5 transition-colors duration-150 hover:border-perceive-accent dark:bg-perceive-darkcard"
                    >
                      <h3 className="font-serif text-[18px] font-bold text-[var(--heading)]">
                        {fach.name}
                      </h3>
                      {tage !== null && (
                        <p className={`mt-1 text-[13px] font-medium ${pruefungsdatumFarbe(tage)}`}>
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
                            background: 'var(--card-border)',
                            borderRadius: 8,
                            height: 6,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              background: 'var(--color-accent)',
                              width: `${prozent}%`,
                              borderRadius: 8,
                              height: 6,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[12px] text-[var(--muted-2)]">
                          {beherrscht} von {total} Blöcken beherrscht
                        </p>
                      </div>

                      <p className="mt-3 text-[13px] font-semibold text-perceive-primary">
                        {heuteGeplant} {heuteGeplant === 1 ? 'Block' : 'Blöcke'} heute geplant
                      </p>

                      <Link
                        to={`/fach/${fach.id}`}
                        className="mt-4 inline-block text-[13px] font-medium text-perceive-accent hover:underline"
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
