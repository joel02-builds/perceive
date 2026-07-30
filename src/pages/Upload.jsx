import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { extractTextFromPDF } from '../lib/pdfExtract'
import { extractTextFromDocument } from '../lib/docxExtract'
import { toBase64, compressImage } from '../lib/imageUtils'

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WOCHENTAG_INDEX = { So: 0, Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6 }
const WIEDERHOLUNGS_ABSTAENDE = [2, 5, 9]

const TAGESZEITEN = [
  { value: 'morgens', label: 'Morgens' },
  { value: 'mittags', label: 'Mittags' },
  { value: 'abends', label: 'Abends' },
  { value: 'nachts', label: 'Nachts' },
]

const INPUT_TYPEN = [
  { key: 'pdf', icon: '📄', titel: 'PDF', untertitel: 'Lernzettel, Skripte, Abiturthemen' },
  { key: 'foto', icon: '📷', titel: 'Foto / Bild', untertitel: 'Tafelnotizen, Handschrift, Screenshots' },
  { key: 'text', icon: '📝', titel: 'Text eingeben', untertitel: 'Copy-paste aus Word, Notion, ChatGPT' },
  { key: 'dokument', icon: '📋', titel: 'Dokument', untertitel: 'DOCX- oder TXT-Dateien' },
  { key: 'manuell', icon: '✍️', titel: 'Manuell', untertitel: 'Block direkt schreiben, ohne Dokument' },
]

const ERLAUBTE_BILDTYPEN = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_FOTOS = 3
const MAX_FOTO_GROESSE = 10 * 1024 * 1024

const LADE_TEXTE = [
  'Ich lese deine Unterlagen…',
  'Ich erkenne die wichtigsten Themen…',
  'Ich teile alles in klare Blöcke auf…',
  'Fast fertig…',
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
  const [inputTyp, setInputTyp] = useState(null)
  const [fachName, setFachName] = useState('')
  const [pruefungsdatum, setPruefungsdatum] = useState('')
  const [lerntage, setLerntage] = useState([])
  const [tageszeit, setTageszeit] = useState('')
  const [modus, setModus] = useState('unterlagen') // 'unterlagen' | 'themenvorgabe'

  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [fotos, setFotos] = useState([])
  const [textInput, setTextInput] = useState('')
  const [dokumentFile, setDokumentFile] = useState(null)
  const [manuellTitel, setManuellTitel] = useState('')
  const [manuellKernaussage, setManuellKernaussage] = useState('')
  const [manuellInhalt, setManuellInhalt] = useState('')
  const [speichernAktiv, setSpeichernAktiv] = useState(false)

  const [phase, setPhase] = useState('form') // 'form' | 'loading' | 'error'
  const [ladeTextIndex, setLadeTextIndex] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (phase !== 'loading') return
    const interval = setInterval(() => {
      setLadeTextIndex((i) => (i + 1) % LADE_TEXTE.length)
    }, 3000)
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

  function handleFotos(fileList) {
    const dateien = Array.from(fileList || [])
    const gueltig = []
    for (const datei of dateien) {
      const istBild =
        ERLAUBTE_BILDTYPEN.includes(datei.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(datei.name)
      if (!istBild) {
        setError('Nur JPG, PNG, WEBP oder HEIC erlaubt.')
        continue
      }
      if (datei.size > MAX_FOTO_GROESSE) {
        setError('Jedes Bild darf maximal 10MB groß sein.')
        continue
      }
      gueltig.push(datei)
    }
    if (gueltig.length > 0) {
      setError(null)
      setFotos((prev) => [...prev, ...gueltig].slice(0, MAX_FOTOS))
    }
  }

  function entferneFoto(index) {
    setFotos((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDokument(selected) {
    const gueltig =
      selected &&
      (selected.type === 'text/plain' ||
        selected.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        /\.(docx|txt)$/i.test(selected.name))
    if (gueltig) {
      setDokumentFile(selected)
      setError(null)
    } else {
      setError('Bitte lade eine DOCX- oder TXT-Datei hoch.')
    }
  }

  // Speichert von der KI erstellte oder manuell erfasste Blöcke und plant sie ein.
  async function bloeckeSpeichernUndLernplan(fach, bloeckeRoh) {
    const bloeckeZumSpeichern = bloeckeRoh.map((block) => ({
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

      const { error: lernplanError } = await supabase.from('lernplan').insert(lernplanEintraege)
      if (lernplanError) throw lernplanError
    }
  }

  async function handleStart() {
    setPhase('loading')
    setError(null)

    try {
      let text = null
      let images = null

      if (inputTyp === 'pdf') {
        text = await extractTextFromPDF(file)
      } else if (inputTyp === 'foto') {
        images = []
        for (const foto of fotos) {
          const { blob, mediaType } = await compressImage(foto)
          const data = await toBase64(blob)
          images.push({ data, mediaType })
        }
      } else if (inputTyp === 'text') {
        text = textInput
      } else if (inputTyp === 'dokument') {
        try {
          text = await extractTextFromDocument(dokumentFile)
        } catch {
          throw new Error(
            'Datei konnte nicht gelesen werden. Versuche es als PDF oder kopiere den Text direkt.'
          )
        }
      }

      const { data: fach, error: fachError } = await supabase
        .from('faecher')
        .insert({ user_id: user.id, name: fachName, pruefungsdatum })
        .select()
        .single()
      if (fachError) throw fachError

      const analyseRes = await fetch('/api/analyse-unterlagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, images, fachName, pruefungsdatum, lerntage, tageszeit, modus }),
      })
      const analyse = await analyseRes.json()
      if (!analyseRes.ok) throw new Error(analyse.error || 'Analyse fehlgeschlagen')

      await bloeckeSpeichernUndLernplan(fach, analyse.bloecke ?? [])

      navigate(`/fach/${fach.id}`)
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  async function handleManuellSpeichern() {
    setError(null)
    setSpeichernAktiv(true)

    try {
      const { data: fach, error: fachError } = await supabase
        .from('faecher')
        .insert({ user_id: user.id, name: fachName, pruefungsdatum })
        .select()
        .single()
      if (fachError) throw fachError

      await bloeckeSpeichernUndLernplan(fach, [
        {
          titel: manuellTitel.trim(),
          kernaussage: manuellKernaussage.trim(),
          inhalt: manuellInhalt.trim(),
          schwierigkeit: 3,
          reihenfolge: 1,
        },
      ])

      navigate(`/fach/${fach.id}`)
    } catch (err) {
      setError(err.message)
      setSpeichernAktiv(false)
    }
  }

  function ModusAuswahl() {
    return (
      <div>
        <p className="mb-2 text-[12px] text-[var(--muted-2)]">Was lädst du hoch?</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModus('unterlagen')}
            className="flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center transition"
            style={{
              borderColor: modus === 'unterlagen' ? 'var(--color-primary)' : 'var(--card-border)',
              backgroundColor: modus === 'unterlagen' ? 'var(--hero-bg)' : 'var(--color-card)',
            }}
          >
            <span className="text-2xl">📄</span>
            <span className="text-sm font-medium text-perceive-text dark:text-perceive-bg">
              Eigene Unterlagen
            </span>
            <span className="text-xs text-[var(--muted-2)]">
              Zusammenfassungen, Skripte, Mitschriften
            </span>
          </button>
          <button
            type="button"
            onClick={() => setModus('themenvorgabe')}
            className="flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center transition"
            style={{
              borderColor: modus === 'themenvorgabe' ? 'var(--color-primary)' : 'var(--card-border)',
              backgroundColor: modus === 'themenvorgabe' ? 'var(--hero-bg)' : 'var(--color-card)',
            }}
          >
            <span className="text-2xl">📋</span>
            <span className="text-sm font-medium text-perceive-text dark:text-perceive-bg">
              Offizielle Themenvorgabe
            </span>
            <span className="text-xs text-[var(--muted-2)]">
              Lehrplan, Abiturthemen, Inhaltsverzeichnis
            </span>
          </button>
        </div>
      </div>
    )
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
          {[1, 2, 3, 4, 5].map((n) => (
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
              Wie möchtest du Inhalte hinzufügen?
            </h1>
            <div className="grid grid-cols-2 gap-3">
              {INPUT_TYPEN.map((typ, i) => {
                const aktiv = inputTyp === typ.key
                return (
                  <button
                    key={typ.key}
                    type="button"
                    onClick={() => {
                      setInputTyp(typ.key)
                      setError(null)
                      setStep(2)
                    }}
                    className={`relative flex flex-col items-center gap-1 rounded-xl border-[1.5px] p-5 text-center transition ${
                      i === 4 ? 'col-span-2' : ''
                    } ${
                      aktiv
                        ? ''
                        : 'border-[var(--card-border)] bg-perceive-card hover:border-perceive-primary hover:bg-[var(--hero-bg)] dark:bg-perceive-darkcard'
                    }`}
                    style={
                      aktiv
                        ? { borderColor: 'var(--color-primary)', backgroundColor: 'var(--hero-bg)' }
                        : undefined
                    }
                  >
                    {aktiv && (
                      <span
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-xs text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        ✓
                      </span>
                    )}
                    <span className="text-[28px]">{typ.icon}</span>
                    <span className="text-sm font-bold text-[var(--heading)]">{typ.titel}</span>
                    <span className="text-xs text-[var(--muted-2)]">{typ.untertitel}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 2 && (
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
                disabled={!fachName.trim()}
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg bg-perceive-primary px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
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
                onClick={() => setStep(2)}
                className="rounded-lg border border-perceive-border px-4 py-3 text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={!pruefungsdatum}
                onClick={() => setStep(4)}
                className="flex-1 rounded-lg bg-perceive-primary px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
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
                onClick={() => setStep(3)}
                className="rounded-lg border border-perceive-border px-4 py-3 text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={lerntage.length === 0 || !tageszeit}
                onClick={() => setStep(5)}
                className="flex-1 rounded-lg bg-perceive-primary px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {step === 5 && inputTyp === 'pdf' && (
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
              Lade deine Unterlagen hoch
            </h1>

            <ModusAuswahl />

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
                onClick={() => setStep(4)}
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

        {step === 5 && inputTyp === 'foto' && (
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
              Fotos hochladen
            </h1>

            <ModusAuswahl />

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-perceive-border px-6 py-10 text-center transition">
              <span className="text-perceive-text dark:text-perceive-bg">
                {fotos.length === 0
                  ? 'Fotos hierher ziehen oder klicken'
                  : `${fotos.length} von ${MAX_FOTOS} Fotos ausgewählt`}
              </span>
              <span className="text-sm text-perceive-muted">
                JPG, PNG, WEBP, HEIC — je max. 10MB, bis zu {MAX_FOTOS} Bilder
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                className="hidden"
                onChange={(e) => handleFotos(e.target.files)}
              />
            </label>

            {fotos.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {fotos.map((foto, i) => (
                  <div key={i} className="relative">
                    <img
                      src={URL.createObjectURL(foto)}
                      alt=""
                      style={{
                        width: 80,
                        height: 80,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--card-border)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => entferneFoto(i)}
                      aria-label="Foto entfernen"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs shadow"
                      style={{ border: '1px solid var(--card-border)' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-lg border border-perceive-border px-4 py-3 text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={fotos.length === 0}
                onClick={handleStart}
                className="flex-1 rounded-lg bg-perceive-accent px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Analysieren
              </button>
            </div>
          </div>
        )}

        {step === 5 && inputTyp === 'text' && (
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
              Text eingeben
            </h1>

            <ModusAuswahl />

            <div>
              <textarea
                autoFocus
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Füge hier deinen Text ein — Zusammenfassungen, Stichpunkte, Themen…"
                className="min-h-[240px] w-full rounded-lg border-[1.5px] border-[var(--card-border)] bg-transparent p-4 text-[14px] leading-[1.6] text-perceive-text outline-none transition focus:border-perceive-primary dark:text-perceive-bg"
              />
              <p className="mt-1 text-right text-xs text-[var(--muted-2)]">
                {textInput.length} Zeichen
              </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-lg border border-perceive-border px-4 py-3 text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={textInput.trim().length <= 50}
                onClick={handleStart}
                className="flex-1 rounded-lg bg-perceive-accent px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Analysieren
              </button>
            </div>
          </div>
        )}

        {step === 5 && inputTyp === 'dokument' && (
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
              Dokument hochladen
            </h1>

            <ModusAuswahl />

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-perceive-border px-6 py-12 text-center transition">
              <span className="text-perceive-text dark:text-perceive-bg">
                {dokumentFile ? dokumentFile.name : 'DOCX oder TXT hierher ziehen oder klicken'}
              </span>
              <span className="text-sm text-perceive-muted">Nur .docx oder .txt</span>
              <input
                type="file"
                accept=".docx,.txt,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => handleDokument(e.target.files?.[0] ?? null)}
              />
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-lg border border-perceive-border px-4 py-3 text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={!dokumentFile}
                onClick={handleStart}
                className="flex-1 rounded-lg bg-perceive-accent px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Analysieren
              </button>
            </div>
          </div>
        )}

        {step === 5 && inputTyp === 'manuell' && (
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-2xl font-semibold text-perceive-text dark:text-perceive-bg">
              Block manuell erstellen
            </h1>

            <input
              type="text"
              autoFocus
              placeholder="z. B. Nervenzelle: Potenziale"
              value={manuellTitel}
              onChange={(e) => setManuellTitel(e.target.value)}
              className="rounded-lg border border-perceive-border bg-transparent px-4 py-3 text-perceive-text outline-none focus:border-perceive-primary dark:text-perceive-bg"
            />
            <input
              type="text"
              placeholder="Das Wichtigste in 1-2 Sätzen"
              value={manuellKernaussage}
              onChange={(e) => setManuellKernaussage(e.target.value)}
              className="rounded-lg border border-perceive-border bg-transparent px-4 py-3 text-perceive-text outline-none focus:border-perceive-primary dark:text-perceive-bg"
            />
            <textarea
              placeholder="Weitere Details, Stichpunkte, Beispiele…"
              value={manuellInhalt}
              onChange={(e) => setManuellInhalt(e.target.value)}
              className="min-h-[160px] rounded-lg border border-perceive-border bg-transparent p-4 text-perceive-text outline-none focus:border-perceive-primary dark:text-perceive-bg"
            />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-lg border border-perceive-border px-4 py-3 text-perceive-muted transition hover:bg-perceive-bg dark:hover:bg-perceive-darkbg"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={!manuellTitel.trim() || !manuellKernaussage.trim() || speichernAktiv}
                onClick={handleManuellSpeichern}
                className="flex-1 rounded-lg bg-perceive-accent px-4 py-3 text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {speichernAktiv ? 'Wird gespeichert…' : 'Block hinzufügen'}
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
