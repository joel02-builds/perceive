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
  const [zeigeInhalt, setZeigeInhalt] = useState(false)
  const [ergebnis, setErgebnis] = useState(null)
  const [phase, setPhase] = useState('lade-block')
  const [error, setError] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: blockData, error: blockError } = await supabase
        .from('bloecke')
        .select('*')
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

      setPhase('lade-frage')

      try {
        const res = await fetch('/api/generate-frage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockTitel: blockData.titel,
            blockInhalt: blockData.inhalt,
            kernaussage: blockData.kernaussage,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Frage konnte nicht erstellt werden')
        setFrageData(data)
        setPhase('frage')
      } catch (err) {
        setError(err.message)
        setPhase('error')
      }
    }
    init()
  }, [blockId, user])

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

      setPhase('ergebnis')
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  if (phase === 'lade-block' || phase === 'lade-frage') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-perceive-bg dark:bg-perceive-darkbg">
        <p className="text-perceive-muted">
          {phase === 'lade-block' ? 'Lädt…' : 'Per bereitet deine Frage vor…'}
        </p>
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
      <header className="mx-auto max-w-3xl px-6 py-6">
        <Link
          to={`/fach/${block?.fach_id}`}
          className="text-sm text-perceive-muted hover:text-perceive-primary"
        >
          ← Zurück zum Fach
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-4">
        <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
          {block?.titel}
        </h1>

        {phase !== 'ergebnis' && (
          <div className="mt-6 rounded-xl border border-perceive-border bg-perceive-card p-6 shadow-sm dark:border-gray-700 dark:bg-perceive-darkcard">
            <p className="font-medium text-perceive-text dark:text-perceive-bg">
              {frageData?.frage}
            </p>

            {zeigeHinweis && (
              <p className="mt-3 text-sm text-perceive-amber">{frageData?.hinweis}</p>
            )}

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <textarea
                autoFocus
                rows={5}
                placeholder="Schreib in eigenen Worten, was du verstanden hast…"
                value={antwort}
                onChange={(e) => setAntwort(e.target.value)}
                disabled={phase === 'bewertet'}
                className="rounded-lg border border-perceive-border bg-transparent px-4 py-3 text-perceive-text outline-none focus:border-perceive-primary disabled:opacity-50 dark:text-perceive-bg"
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setZeigeHinweis(true)}
                  className="rounded-lg border border-perceive-border px-4 py-2 text-sm text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
                >
                  Ich komme nicht weiter
                </button>
                <button
                  type="button"
                  onClick={() => setZeigeInhalt((v) => !v)}
                  className="rounded-lg border border-perceive-border px-4 py-2 text-sm text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
                >
                  {zeigeInhalt ? 'Inhalt verbergen' : 'Blockinhalt anzeigen'}
                </button>
                <button
                  type="submit"
                  disabled={!antwort.trim() || phase === 'bewertet'}
                  className="ml-auto rounded-lg bg-perceive-primary px-5 py-2 text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {phase === 'bewertet' ? 'Per denkt nach…' : 'Antwort abschicken'}
                </button>
              </div>
            </form>

            {zeigeInhalt && (
              <div className="mt-4 rounded-lg bg-perceive-bg p-4 text-sm text-perceive-text dark:bg-perceive-darkbg dark:text-perceive-bg">
                <p className="whitespace-pre-wrap">{block?.inhalt}</p>
              </div>
            )}
          </div>
        )}

        {phase === 'ergebnis' && ergebnis && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="rounded-xl border border-perceive-border bg-perceive-card p-6 shadow-sm dark:border-gray-700 dark:bg-perceive-darkcard">
              {ergebnis.status === 'beherrscht' && (
                <div className="mb-4 flex items-center gap-3">
                  <img
                    src="/per.png"
                    alt="Per"
                    style={{ width: 60, height: 60, objectFit: 'contain', mixBlendMode: 'multiply' }}
                  />
                  <p className="font-serif text-lg text-perceive-text dark:text-perceive-bg">
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
