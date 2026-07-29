import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

const STATUS_LABEL = {
  beherrscht: 'Sicher beherrscht',
  gelernt: 'Gelernt',
  wiederholen: 'Nochmal üben',
}

export default function Lernen() {
  const { blockId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [block, setBlock] = useState(null)
  const [aktuellerFortschritt, setAktuellerFortschritt] = useState(null)
  const [frageData, setFrageData] = useState(null)
  const [antwort, setAntwort] = useState('')
  const [zeigeHinweis, setZeigeHinweis] = useState(false)
  const [ergebnis, setErgebnis] = useState(null)
  const [phase, setPhase] = useState('laedt') // 'laedt' | 'lesen' | 'recall' | 'bewertet' | 'feedback' | 'error'
  const [error, setError] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: blockData, error: blockError } = await supabase
        .from('bloecke')
        .select('*, fach:faecher(id, name, farbe)')
        .eq('id', blockId)
        .single()

      if (blockError || !blockData) {
        setError(blockError?.message ?? 'Block nicht gefunden')
        setPhase('error')
        return
      }
      setBlock(blockData)

      const { data: fortschrittData } = await supabase
        .from('fortschritt')
        .select('*')
        .eq('user_id', user.id)
        .eq('block_id', blockId)
        .maybeSingle()
      setAktuellerFortschritt(fortschrittData)

      setPhase('lesen')
    }
    init()
  }, [blockId, user])

  useEffect(() => {
    if (phase !== 'recall' || frageData || !block) return

    let cancelled = false
    async function ladeFrage() {
      try {
        const res = await fetch('/api/generate-frage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockTitel: block.titel,
            blockInhalt: block.inhalt,
            kernaussage: block.kernaussage,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Frage konnte nicht erstellt werden')
        if (!cancelled) setFrageData(data)
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setPhase('error')
        }
      }
    }
    ladeFrage()

    return () => {
      cancelled = true
    }
  }, [phase, frageData, block])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!antwort.trim()) return
    setPhase('bewertet')

    try {
      const res = await fetch('/api/bewerte-antwort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frage: frageData.frage,
          antwort,
          musterantwort: frageData.musterantwort,
          blockInhalt: block.inhalt,
          aktuelleWiederholungen: aktuellerFortschritt?.versuche || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bewertung fehlgeschlagen')
      setErgebnis(data)

      await supabase.from('fortschritt').upsert(
        {
          user_id: user.id,
          block_id: blockId,
          status: data.status,
          letzte_wiederholung: new Date().toISOString(),
          naechste_wiederholung: data.naechste_wiederholung,
          versuche: (aktuellerFortschritt?.versuche || 0) + 1,
        },
        { onConflict: 'user_id,block_id' }
      )

      await supabase
        .from('lernplan')
        .update({ erledigt: true })
        .eq('user_id', user.id)
        .eq('block_id', blockId)
        .eq('datum', toDateStr(new Date()))

      setPhase('feedback')
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  if (phase === 'laedt') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-perceive-bg dark:bg-perceive-darkbg">
        <p className="text-perceive-muted">Lädt…</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-perceive-bg px-6 text-center dark:bg-perceive-darkbg">
        <p className="text-red-500">{error}</p>
        <Link to="/dashboard" className="text-perceive-primary hover:underline">
          Zurück zum Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-perceive-bg dark:bg-perceive-darkbg">
      <header className="mx-auto max-w-[760px] px-4 py-6 sm:px-8">
        <Link
          to={`/fach/${block?.fach_id}`}
          className="text-sm text-[var(--muted-2)] hover:text-perceive-primary"
        >
          ← Zurück zum Fach
        </Link>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-4 sm:px-8">
        {phase === 'lesen' && (
          <div>
            <p
              className="mb-2 text-[11px] text-[var(--muted-2)]"
              style={{ letterSpacing: '0.1em' }}
            >
              LIES DAS DURCH — DANN ERKLÄRE ES
            </p>
            <p className="text-[12px]" style={{ color: block?.fach?.farbe || 'var(--muted-2)' }}>
              {block?.fach?.name}
            </p>
            <h1 className="font-serif text-[24px] font-semibold text-[var(--heading)] sm:text-[28px]">
              {block?.titel}
            </h1>

            {block?.kernaussage && (
              <div
                style={{
                  background: 'var(--kernaussage-bg)',
                  borderLeft: '3px solid var(--color-accent)',
                  borderRadius: 8,
                  padding: '16px 20px',
                  marginTop: '1rem',
                  marginBottom: '1rem',
                }}
              >
                <p style={{ fontWeight: 600, color: 'var(--color-accent)', marginBottom: '0.5rem' }}>
                  Das Wichtigste:
                </p>
                <p className="text-[var(--heading)]">{block?.kernaussage}</p>
              </div>
            )}

            <p
              className="whitespace-pre-wrap text-[16px] text-[var(--body-text)]"
              style={{ lineHeight: 1.7 }}
            >
              {block?.inhalt}
            </p>

            <button
              type="button"
              onClick={() => setPhase('recall')}
              className="mt-6 w-full rounded-[10px] bg-perceive-primary px-7 py-3.5 text-white transition hover:opacity-90 sm:w-auto"
            >
              Ich habe es gelesen — jetzt testen ✓
            </button>
          </div>
        )}

        {(phase === 'recall' || phase === 'bewertet') && (
          <>
            <p className="text-[12px]" style={{ color: block?.fach?.farbe || 'var(--muted-2)' }}>
              {block?.fach?.name}
            </p>
            <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
              {block?.titel}
            </h1>

            <div className="mt-6 rounded-xl border border-[var(--card-border)] bg-perceive-card p-6 dark:border-gray-700 dark:bg-perceive-darkcard">
              {!frageData ? (
                <p className="text-[var(--muted-2)]">Per bereitet deine Frage vor…</p>
              ) : (
                <>
                  <p className="font-serif text-[20px] text-[var(--heading)]">{frageData.frage}</p>

                  {zeigeHinweis && (
                    <p className="mt-3 text-sm text-perceive-amber">{block?.kernaussage}</p>
                  )}

                  <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
                    <textarea
                      autoFocus
                      rows={5}
                      placeholder="Schreib in eigenen Worten, was du verstanden hast…"
                      value={antwort}
                      onChange={(e) => setAntwort(e.target.value)}
                      disabled={phase === 'bewertet'}
                      className="rounded-[10px] border-[1.5px] border-[var(--card-border)] bg-transparent p-4 text-[15px] text-[var(--heading)] outline-none focus:border-perceive-primary disabled:opacity-50"
                    />

                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setZeigeHinweis(true)}
                        className="text-[13px] text-[var(--muted-2)] underline-offset-2 transition hover:underline"
                      >
                        Ich komme nicht weiter
                      </button>
                      <button
                        type="submit"
                        disabled={!antwort.trim() || phase === 'bewertet'}
                        className="ml-auto rounded-lg px-5 py-2 text-white transition hover:opacity-90"
                        style={{
                          backgroundColor:
                            antwort.trim() && phase !== 'bewertet'
                              ? 'var(--color-primary)'
                              : 'var(--disabled-bg)',
                        }}
                      >
                        {phase === 'bewertet' ? 'Per denkt nach…' : 'Antwort abschicken'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </>
        )}

        {phase === 'feedback' && ergebnis && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="rounded-xl border border-perceive-border bg-perceive-card p-6 shadow-sm dark:border-gray-700 dark:bg-perceive-darkcard">
              {ergebnis.status === 'beherrscht' && (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <img
                    src="/per.png"
                    alt="Per"
                    style={{ width: 60, height: 60, objectFit: 'contain', mixBlendMode: 'multiply' }}
                  />
                  <p style={{ fontFamily: 'Fraunces, serif', color: '#3D6B8E' }}>
                    Sehr gut. Dieser Block sitzt. ⚡
                  </p>
                </div>
              )}

              <span className="inline-block rounded-full bg-perceive-accent/10 px-3 py-1 text-sm font-medium text-perceive-accent">
                {STATUS_LABEL[ergebnis.status] ?? ergebnis.status}
              </span>
              <p className="mt-3 text-perceive-text dark:text-perceive-bg">
                {ergebnis.feedback}
              </p>
              <p className="mt-2 text-sm text-perceive-muted">{ergebnis.naechster_schritt}</p>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/fach/${block.fach_id}`)}
              className="rounded-lg bg-perceive-primary px-4 py-3 text-white transition hover:opacity-90"
            >
              Weiter zum nächsten Block
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
