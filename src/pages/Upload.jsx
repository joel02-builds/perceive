import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { extractTextFromPDF } from '../lib/pdfExtract'

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WOCHENTAG_INDEX = { So: 0, Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6 }
const WIEDERHOLUNGS_ABSTAENDE = [2, 5, 9]

const TAGESZEITEN = [
  { value: 'morgens', label: 'Morgens' },
  { value: 'mittags', label: 'Mittags' },
  { value: 'abends', label: 'Abends' },
  { value: 'nachts', label: 'Nachts' },
]

const LADE_TEXTE = [
  'Per liest deine Unterlagen…',
  'Ich erkenne die wichtigsten Themen…',
  'Ich teile alles in klare Blöcke auf…',
  'Fast fertig — ich prüfe was prüfungsrelevant ist…',
]

function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

// Verteilt die Blöcke gleichmäßig auf die gewählten Lerntage bis zur Prüfung
// und ergänzt Wiederholungstermine nach dem Spaced-Repetition-Prinzip (+2/+5/+9 Tage).
function generateLernplan(bloecke, { pruefungsdatum, lerntage }) {
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const pruefung = new Date(pruefungsdatum)
  pruefung.setHours(0, 0, 0, 0)

  const ausgewaehlteIndizes = new Set(lerntage.map((tag) => WOCHENTAG_INDEX[tag]))

  const lerntageBisPruefung = []
  const cursor = new Date(heute)
  while (cursor < pruefung) {
    if (ausgewaehlteIndizes.has(cursor.getDay())) {
      lerntageBisPruefung.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  // Fallback, falls die gewählten Wochentage nicht mehr vor der Prüfung vorkommen
  if (lerntageBisPruefung.length === 0) {
    const fallbackCursor = new Date(heute)
    while (fallbackCursor < pruefung) {
      lerntageBisPruefung.push(new Date(fallbackCursor))
      fallbackCursor.setDate(fallbackCursor.getDate() + 1)
    }
  }
  if (lerntageBisPruefung.length === 0) {
    lerntageBisPruefung.push(new Date(heute))
  }

  const sortierteBloecke = [...bloecke].sort((a, b) => a.reihenfolge - b.reihenfolge)
  const eintraege = []
  const blockZuLerntag = new Map()

  sortierteBloecke.forEach((block, i) => {
    const datumIndex = Math.floor((i / sortierteBloecke.length) * lerntageBisPruefung.length)
    const datum = lerntageBisPruefung[Math.min(datumIndex, lerntageBisPruefung.length - 1)]
    blockZuLerntag.set(block.id, datum)
    eintraege.push({ datum: toDateStr(datum), block_id: block.id })
  })

  for (const block of sortierteBloecke) {
    const lernDatum = blockZuLerntag.get(block.id)
    for (const abstand of WIEDERHOLUNGS_ABSTAENDE) {
      const ziel = new Date(lernDatum)
      ziel.setDate(ziel.getDate() + abstand)
      if (ziel >= pruefung) continue
      const naechsterLerntag = lerntageBisPruefung.find((d) => d >= ziel)
      if (!naechsterLerntag) continue
      eintraege.push({ datum: toDateStr(naechsterLerntag), block_id: block.id })
    }
  }

  return eintraege
}

export default function Upload() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [fachName, setFachName] = useState('')
  const [pruefungsdatum, setPruefungsdatum] = useState('')
  const [lerntage, setLerntage] = useState([])
  const [tageszeit, setTageszeit] = useState('')
  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const [phase, setPhase] = useState('form') // 'form' | 'loading' | 'error'
  const [ladeTextIndex, setLadeTextIndex] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (phase !== 'loading') return
    const interval = setInterval(() => {
      setLadeTextIndex((i) => (i + 1) % LADE_TEXTE.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [phase])

  function toggleLerntag(tag) {
    setLerntage((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function handleFile(selected) {
    if (selected && selected.type === 'application/pdf') {
      setFile(selected)
      setError(null)
    } else {
      setError('Bitte lade eine PDF-Datei hoch.')
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    handleFile(e.dataTransfer.files?.[0] ?? null)
  }

  async function handleStart() {
    if (!file) return
    setPhase('loading')
    setError(null)

    try {
      const text = await extractTextFromPDF(file)

      const { data: fach, error: fachError } = await supabase
        .from('faecher')
        .insert({ user_id: user.id, name: fachName, pruefungsdatum })
        .select()
        .single()
      if (fachError) throw fachError

      const analyseRes = await fetch('/api/analyse-unterlagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, fachName, pruefungsdatum, lerntage, tageszeit }),
      })
      const analyse = await analyseRes.json()
      if (!analyseRes.ok) throw new Error(analyse.error || 'Analyse fehlgeschlagen')

      const bloeckeZumSpeichern = (analyse.bloecke ?? []).map((block) => ({
        fach_id: fach.id,
        titel: block.titel,
        inhalt: block.inhalt,
        kernaussage: block.kernaussage ?? null,
        schwierigkeit: block.schwierigkeit ?? 3,
        reihenfolge: block.reihenfolge,
      }))

      const { data: gespeicherteBloecke, error: bloeckeError } = await supabase
        .from('bloecke')
        .insert(bloeckeZumSpeichern)
        .select()
      if (bloeckeError) throw bloeckeError

      if (pruefungsdatum && gespeicherteBloecke.length > 0) {
        const lernplanEintraege = generateLernplan(gespeicherteBloecke, {
          pruefungsdatum,
          lerntage,
        }).map((eintrag) => ({ ...eintrag, user_id: user.id }))

        const { error: lernplanError } = await supabase
          .from('lernplan')
          .insert(lernplanEintraege)
        if (lernplanError) throw lernplanError
      }

      navigate(`/fach/${fach.id}`)
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-perceive-bg px-6 dark:bg-perceive-darkbg">
        <img
          src="/per.png"
          alt="Per"
          style={{ width: 80, height: 80, objectFit: 'contain', mixBlendMode: 'multiply' }}
        />
        <p className="text-center text-lg text-perceive-text dark:text-perceive-bg">
          {LADE_TEXTE[ladeTextIndex]}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-perceive-bg px-6 py-12 dark:bg-perceive-darkbg">
      <div className="w-full max-w-lg rounded-xl border border-perceive-border bg-perceive-card p-8 shadow-sm dark:border-gray-700 dark:bg-perceive-darkcard">
        <div className="mb-8 flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full ${
                n <= step ? 'bg-perceive-primary' : 'bg-perceive-border dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
              Wie heißt dein Fach?
            </h1>
            <input
              type="text"
              autoFocus
              placeholder="z. B. Mikroökonomie"
              value={fachName}
              onChange={(e) => setFachName(e.target.value)}
              className="rounded-lg border border-perceive-border bg-transparent px-4 py-3 text-lg text-perceive-text outline-none focus:border-perceive-primary dark:text-perceive-bg"
            />
            <button
              type="button"
              disabled={!fachName.trim()}
              onClick={() => setStep(2)}
              className="mt-2 rounded-lg bg-perceive-primary px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Weiter
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
              Wann ist deine Prüfung?
            </h1>
            <input
              type="date"
              autoFocus
              min={toDateStr(new Date())}
              value={pruefungsdatum}
              onChange={(e) => setPruefungsdatum(e.target.value)}
              className="rounded-lg border border-perceive-border bg-transparent px-4 py-4 text-xl text-perceive-text outline-none focus:border-perceive-primary dark:text-perceive-bg"
            />
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-perceive-border px-4 py-3 text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={!pruefungsdatum}
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg bg-perceive-primary px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
                An welchen Tagen lernst du?
              </h1>
              <div className="mt-4 flex flex-wrap gap-2">
                {WOCHENTAGE.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleLerntag(tag)}
                    className={`h-12 w-12 rounded-full border font-medium transition ${
                      lerntage.includes(tag)
                        ? 'border-perceive-primary bg-perceive-primary text-white'
                        : 'border-perceive-border text-perceive-text hover:border-perceive-primary dark:text-perceive-bg'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-serif text-lg font-semibold text-perceive-text dark:text-perceive-bg">
                Wann passt es dir am besten?
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {TAGESZEITEN.map((tz) => (
                  <button
                    key={tz.value}
                    type="button"
                    onClick={() => setTageszeit(tz.value)}
                    className={`rounded-lg border px-4 py-3 transition ${
                      tageszeit === tz.value
                        ? 'border-perceive-accent bg-perceive-accent text-white'
                        : 'border-perceive-border text-perceive-text hover:border-perceive-accent dark:text-perceive-bg'
                    }`}
                  >
                    {tz.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-perceive-border px-4 py-3 text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={lerntage.length === 0 || !tageszeit}
                onClick={() => setStep(4)}
                className="flex-1 rounded-lg bg-perceive-primary px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
              Lade deine Unterlagen hoch
            </h1>

            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
                dragActive
                  ? 'border-perceive-primary bg-perceive-primary/5'
                  : 'border-perceive-border'
              }`}
            >
              <span className="text-perceive-text dark:text-perceive-bg">
                {file ? file.name : 'PDF hierher ziehen oder klicken'}
              </span>
              <span className="text-sm text-perceive-muted">Nur PDF-Dateien</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-lg border border-perceive-border px-4 py-3 text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={!file}
                onClick={handleStart}
                className="flex-1 rounded-lg bg-perceive-accent px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Los geht's
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && error && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={() => setPhase('form')}
              className="rounded-lg border border-perceive-border px-4 py-2 text-perceive-text transition hover:bg-perceive-bg dark:text-perceive-bg dark:hover:bg-perceive-darkbg"
            >
              Nochmal versuchen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
