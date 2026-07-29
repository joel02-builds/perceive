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
  neu: 'border-[var(--badge-neu-border)] bg-[var(--badge-neu-bg)] text-perceive-primary',
  gelernt: 'border-perceive-primary/30 bg-perceive-primary/10 text-perceive-primary',
  wiederholen: 'border-perceive-amber/30 bg-perceive-amber/10 text-perceive-amber',
  beherrscht: 'border-[var(--badge-wiederholen-border)] bg-[var(--badge-wiederholen-bg)] text-perceive-accent',
}

const FACH_FARBEN = [
  '#3D6B8E', // Blau (Standard)
  '#5BA08A', // Grün
  '#8B5E3C', // Braun
  '#7B5EA7', // Lila
  '#C0392B', // Rot
  '#E8A838', // Amber
  '#2C7A7B', // Teal
  '#4A5568', // Dunkelgrau
]

function tageBisPruefung(pruefungsdatum) {
  if (!pruefungsdatum) return null
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const pruefung = new Date(pruefungsdatum)
  pruefung.setHours(0, 0, 0, 0)
  return Math.ceil((pruefung - heute) / (1000 * 60 * 60 * 24))
}

// Dringlichkeit (< 6 Tage rot, 6-10 Tage amber) überschreibt die Fachfarbe
function pruefungsdatumFarbe(tage, fachFarbe) {
  if (tage === null) return 'var(--muted-2)'
  if (tage < 6) return 'var(--danger)'
  if (tage <= 10) return '#E8A838'
  return fachFarbe || '#3D6B8E'
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

  async function handleFarbeChange(farbe) {
    setFach((prev) => ({ ...prev, farbe }))
    await supabase.from('faecher').update({ farbe }).eq('id', id)
  }

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

  const fachFarbe = fach?.farbe || '#3D6B8E'
  const tage = tageBisPruefung(fach?.pruefungsdatum)

  return (
    <div className="min-h-screen bg-perceive-bg dark:bg-perceive-darkbg">
      <header className="mx-auto max-w-[760px] px-4 py-6 sm:px-8">
        <Link to="/dashboard" className="text-sm text-[var(--muted-2)] hover:text-perceive-primary">
          ← Zurück zum Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-4 sm:px-8">
        <h1 className="font-serif text-[22px] font-semibold text-[var(--heading)]">
          {fach?.name}
        </h1>
        {fach?.pruefungsdatum && (
          <>
            <p className="mt-1 text-[var(--muted-2)]">
              Prüfung am {new Date(fach.pruefungsdatum).toLocaleDateString('de-DE')}
            </p>
            <p
              className="mt-1 text-[13px] font-medium"
              style={{ color: pruefungsdatumFarbe(tage, fachFarbe) }}
            >
              {tage > 0
                ? `noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'}`
                : tage === 0
                  ? 'Prüfung ist heute'
                  : 'Prüfung ist vorbei'}
            </p>
          </>
        )}

        <div className="mt-4">
          <div
            style={{ background: 'var(--card-border)', borderRadius: 8, height: 6, overflow: 'hidden' }}
          >
            <div
              style={{
                background: fachFarbe,
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

        <div className="mt-6">
          <p className="mb-2 text-[12px] text-[var(--muted-2)]">Fachfarbe</p>
          <div className="flex flex-wrap gap-2">
            {FACH_FARBEN.map((farbe) => (
              <button
                key={farbe}
                type="button"
                onClick={() => handleFarbeChange(farbe)}
                aria-label={`Fachfarbe ${farbe} wählen`}
                className="h-7 w-7 rounded-full transition"
                style={{
                  backgroundColor: farbe,
                  boxShadow:
                    fachFarbe === farbe
                      ? `inset 0 0 0 2px white, 0 0 0 3px ${farbe}`
                      : 'none',
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {sortierteBloecke.map((block) => {
            const status = fortschritt[block.id]?.status ?? 'neu'
            const versuche = fortschritt[block.id]?.versuche ?? 0
            const istBeherrscht = status === 'beherrscht' || versuche >= 3
            const streifenFarbe = istBeherrscht
              ? '#5BA08A'
              : status === 'wiederholen'
                ? '#E8A838'
                : fachFarbe

            return (
              <div
                key={block.id}
                className="rounded-xl bg-perceive-card p-5 transition-colors duration-150 dark:bg-perceive-darkcard"
                style={{
                  border: '1px solid var(--card-border)',
                  borderLeft: `3px solid ${streifenFarbe}`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2
                    className="text-[15px] font-semibold"
                    style={{
                      color: istBeherrscht ? '#9CA3AF' : 'var(--heading)',
                      textDecoration: istBeherrscht ? 'line-through' : 'none',
                    }}
                  >
                    {block.titel}
                  </h2>
                  {istBeherrscht ? (
                    <span
                      className="shrink-0 rounded-[4px] border px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: '#F0F7F4', color: '#5BA08A', borderColor: '#B5D9CE' }}
                    >
                      ✓ Beherrscht
                    </span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-[4px] border px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[status]}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  )}
                </div>

                {block.kernaussage && (
                  <div
                    style={{
                      background: 'var(--kernaussage-bg)',
                      borderLeft: `3px solid ${fachFarbe}`,
                      borderRadius: 8,
                      padding: '16px 20px',
                      marginTop: '0.75rem',
                    }}
                  >
                    <p style={{ color: fachFarbe, fontWeight: 600 }}>
                      Das Wichtigste: {block.kernaussage}
                    </p>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <SchwierigkeitDots level={block.schwierigkeit ?? 3} />
                  {istBeherrscht ? (
                    <Link
                      to={`/lernen/${block.id}`}
                      className="rounded-lg border px-4 py-2 text-sm transition"
                      style={{ borderColor: '#9CA3AF', color: '#9CA3AF' }}
                    >
                      Nochmal lernen
                    </Link>
                  ) : (
                    <Link
                      to={`/lernen/${block.id}`}
                      className="rounded-lg bg-perceive-primary px-4 py-2 text-sm text-white transition hover:opacity-90"
                    >
                      Jetzt lernen →
                    </Link>
                  )}
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
