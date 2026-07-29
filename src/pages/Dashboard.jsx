import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { buildTodaysPlan } from '../utils/buildTodaysPlan'
import EnergyCheckScreen from '../components/EnergyCheckScreen'
import BottomTabBar from '../components/BottomTabBar'
import WochenAnsicht from '../components/WochenAnsicht'
import FaecherUebersicht from '../components/FaecherUebersicht'

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

// Wählt den zeitlich nächsten Block über alle Fächer hinweg (überfällig/neu zuerst).
function findeNaechstenBlock(allBlocks) {
  if (allBlocks.length === 0) return null
  const sortiert = [...allBlocks].sort((a, b) => {
    const da = a.naechste_wiederholung ? new Date(a.naechste_wiederholung).getTime() : -Infinity
    const db = b.naechste_wiederholung ? new Date(b.naechste_wiederholung).getTime() : -Infinity
    return da - db
  })
  return sortiert[0]
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
  const navigate = useNavigate()
  const [energyLevel, setEnergyLevel] = useState(() => leseGespeicherteEnergie())
  const [faecher, setFaecher] = useState([])
  const [bloecke, setBloecke] = useState([])
  const [fortschritt, setFortschritt] = useState([])
  const [loading, setLoading] = useState(true)
  const [avatarMenuOffen, setAvatarMenuOffen] = useState(false)
  const [activeTab, setActiveTab] = useState('heute')
  const [lernenFallbackAktiv, setLernenFallbackAktiv] = useState(false)

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
              .select('*, fach:faecher(id, name, pruefungsdatum, farbe)')
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
  const initiale = user?.email?.[0]?.toUpperCase() ?? '?'
  const naechsterBlock = findeNaechstenBlock(allBlocksMitFortschritt)

  function handleLernenClick() {
    if (heutigeItems.length > 0) {
      navigate(`/lernen/${heutigeItems[0].id}`)
      return
    }
    setLernenFallbackAktiv(true)
  }

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

  const zeigeLeerenZustand = faecher.length === 0 && activeTab === 'heute'

  return (
    <div className="min-h-screen bg-perceive-bg dark:bg-perceive-darkbg md:pl-16">
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

      <main className="mx-auto max-w-[760px] px-4 pb-24 pt-8 sm:px-8 md:pb-8">
        {zeigeLeerenZustand ? (
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
            {activeTab === 'heute' && (
              <section>
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
                    <p className="text-[var(--heading)]">
                      Für heute bist du durch. Genieß die Pause.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Hero-Karte: der erste, wichtigste Block — Streifen bleibt grün (Signal, kein Fachbezug) */}
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
                      <p
                        className="mt-1 text-[12px]"
                        style={{ color: heroItem.fach?.farbe || 'var(--muted-2)' }}
                      >
                        {heroItem.fach?.name}
                      </p>
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

                    {/* Weitere Blöcke: kompakter, mit Ghost-Button + Fachfarben-Streifen */}
                    {restItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col items-start justify-between gap-3 rounded-xl bg-perceive-card p-4 sm:flex-row sm:items-center dark:bg-perceive-darkcard"
                        style={{
                          border: '1px solid var(--card-border)',
                          borderLeft: `3px solid ${item.fach?.farbe || '#3D6B8E'}`,
                        }}
                      >
                        <div>
                          <p
                            className="text-[12px]"
                            style={{ color: item.fach?.farbe || 'var(--muted-2)' }}
                          >
                            {item.fach?.name}
                          </p>
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
            )}

            {activeTab === 'woche' && (
              <section>
                <h2 className="mb-4 font-serif text-[22px] font-semibold text-[var(--heading)]">
                  Diese Woche
                </h2>
                <WochenAnsicht
                  allBlocks={allBlocksMitFortschritt}
                  faecher={faecher}
                  fortschrittMap={fortschrittMap}
                />
              </section>
            )}

            {activeTab === 'faecher' && (
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
                <FaecherUebersicht
                  faecher={faecher}
                  bloecke={bloecke}
                  fortschrittMap={fortschrittMap}
                  beherrschteBlockIds={beherrschteBlockIds}
                />
              </section>
            )}
          </>
        )}
      </main>

      <BottomTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLernenClick={handleLernenClick}
      />

      {lernenFallbackAktiv && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-perceive-bg px-6 text-center dark:bg-perceive-darkbg">
          <img
            src="/per.png"
            alt="Per"
            style={{ width: 120, height: 120, objectFit: 'contain', mixBlendMode: 'multiply' }}
          />
          <p className="font-serif text-xl font-semibold text-[var(--heading)]">
            Für heute bist du durch.
          </p>
          {naechsterBlock && (
            <button
              type="button"
              onClick={() => navigate(`/lernen/${naechsterBlock.id}`)}
              className="rounded-lg bg-perceive-primary px-5 py-2.5 text-white transition hover:opacity-90"
            >
              Trotzdem lernen → {naechsterBlock.titel}
            </button>
          )}
          <button
            type="button"
            onClick={() => setLernenFallbackAktiv(false)}
            className="text-sm text-[var(--muted-2)] hover:underline"
          >
            Zurück
          </button>
        </div>
      )}
    </div>
  )
}
