import { useEffect, useState } from 'react'
import { berechneTageBisWiederholung } from '../lib/spacedRepetition'

// Die KI/SM-2-Logik liefert 'beherrscht' | 'gelernt' | 'wiederholen' (siehe
// api/bewerte-antwort.js) — 'gelernt' entspricht der "gut"-Variante,
// 'wiederholen' der "weiter_ueben"-Variante aus der Design-Vorgabe.
const VARIANTEN = {
  beherrscht: {
    perGroesse: 80,
    titel: 'Beherrscht! 🎉',
    text: (blockTitel) => `Du hast ${blockTitel} verstanden.`,
  },
  gelernt: {
    perGroesse: 64,
    titel: 'Gut gemacht!',
    text: () => 'Fast da. Noch einmal kurz drüber — dann sitzt es.',
  },
  wiederholen: {
    perGroesse: 64,
    titel: 'Noch nicht ganz.',
    text: () => 'Das ist okay — genau dafür ist Perceive da. Beim nächsten Mal klappt es.',
  },
}

function formatWiederholungsText(bewertung, naechsteWiederholung) {
  if (bewertung === 'beherrscht') {
    const tage = berechneTageBisWiederholung(naechsteWiederholung)
    if (tage <= 0) return 'Nächste Wiederholung: heute'
    return `Nächste Wiederholung: in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`
  }
  if (bewertung === 'gelernt') return 'Wiederholung: morgen'
  return 'Wiederholung: bald'
}

export default function BlockAbschluss({
  bewertung,
  blockTitel,
  fachName,
  naechsteWiederholung,
  onWeiter,
  onNaechsterBlock,
}) {
  const [sichtbar, setSichtbar] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSichtbar(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const variante = VARIANTEN[bewertung] ?? VARIANTEN.gelernt

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-perceive-bg px-6 dark:bg-perceive-darkbg">
      <div
        className={`flex w-full max-w-[400px] flex-col items-center gap-3 text-center transition-all duration-300 ease-out motion-reduce:transition-none ${
          sichtbar ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <img
          src="/per.png"
          alt="Per"
          style={{
            width: variante.perGroesse,
            height: variante.perGroesse,
            objectFit: 'contain',
            mixBlendMode: 'multiply',
          }}
        />
        {fachName && <p className="text-[12px] text-[var(--muted-2)]">{fachName}</p>}
        <h2 className="font-serif text-2xl font-semibold text-[var(--heading)]">
          {variante.titel}
        </h2>
        <p className="text-perceive-text dark:text-perceive-bg">{variante.text(blockTitel)}</p>
        <p className="text-sm text-[var(--muted-2)]">
          {formatWiederholungsText(bewertung, naechsteWiederholung)}
        </p>

        <div className="mt-4 flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onNaechsterBlock}
            className="w-full rounded-lg bg-perceive-primary px-5 py-3 text-white transition hover:opacity-90"
          >
            Nächsten Block lernen
          </button>
          <button
            type="button"
            onClick={onWeiter}
            className="w-full rounded-lg border border-[var(--card-border)] px-5 py-3 text-perceive-text transition hover:bg-perceive-bg dark:text-perceive-bg dark:hover:bg-perceive-darkbg"
          >
            Zurück zum Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
