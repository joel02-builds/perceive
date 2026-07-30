import { Link } from 'react-router-dom'

const WOCHENTAGE_LANG = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
]
const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function formatiereTag(datum) {
  return `${WOCHENTAGE_LANG[datum.getDay()]}, ${datum.getDate()}. ${MONATE[datum.getMonth()]}`
}

// Lokales Kalenderdatum als String — NICHT toISOString() verwenden, das rechnet
// in UTC um und verschiebt das Datum in Zeitzonen östlich von UTC (z. B. CEST) um einen Tag.
function toDateStr(datum) {
  const jahr = datum.getFullYear()
  const monat = String(datum.getMonth() + 1).padStart(2, '0')
  const tag = String(datum.getDate()).padStart(2, '0')
  return `${jahr}-${monat}-${tag}`
}

// Blöcke, deren naechste_wiederholung heute/überfällig/neu ist, zählen zu "heute".
// Für die restlichen 6 Tage wird exakt auf das Datum gematcht.
function berechneWoche(allBlocks, faecher) {
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)

  const tage = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(heute)
    d.setDate(d.getDate() + i)
    return d
  })

  return tage.map((datum, i) => {
    const istHeute = i === 0
    const datumStr = toDateStr(datum)

    const bloeckeAmTag = allBlocks.filter((block) => {
      if (!block.naechste_wiederholung) return istHeute
      const nw = new Date(block.naechste_wiederholung)
      nw.setHours(0, 0, 0, 0)
      if (istHeute) return nw <= heute
      return nw.getTime() === datum.getTime()
    })

    const pruefungen = faecher.filter((f) => f.pruefungsdatum === datumStr)

    return { datum, istHeute, bloecke: bloeckeAmTag, pruefungen }
  })
}

function StatusBadge({ istNeu }) {
  return (
    <span
      className={`shrink-0 rounded-[4px] border px-2 py-0.5 text-[11px] font-medium ${
        istNeu
          ? 'border-[var(--badge-neu-border)] bg-[var(--badge-neu-bg)] text-perceive-primary'
          : 'border-[var(--badge-wiederholen-border)] bg-[var(--badge-wiederholen-bg)] text-perceive-accent'
      }`}
    >
      {istNeu ? 'Neu' : 'Wiederholen'}
    </span>
  )
}

function BlockKarteKompakt({ block, istNeu }) {
  const farbe = block.fach?.farbe || '#3D6B8E'
  return (
    <Link
      to={`/lernen/${block.id}`}
      className="flex items-center justify-between gap-3 rounded-lg bg-perceive-card px-3 py-2 dark:bg-perceive-darkcard"
      style={{
        minHeight: 56,
        border: '1px solid var(--card-border)',
        borderLeft: `3px solid ${farbe}`,
      }}
    >
      <div className="min-w-0">
        <p className="truncate text-[12px]" style={{ color: farbe }}>
          {block.fach?.name}
        </p>
        <p className="truncate text-[14px] font-bold text-[var(--heading)]">{block.titel}</p>
      </div>
      <StatusBadge istNeu={istNeu} />
    </Link>
  )
}

export default function WochenAnsicht({ allBlocks, faecher, fortschrittMap }) {
  const woche = berechneWoche(allBlocks, faecher)
  const wocheKomplettLeer = woche.every(
    ({ bloecke, pruefungen }) => bloecke.length === 0 && pruefungen.length === 0
  )

  if (wocheKomplettLeer) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <img
          src="/per.png"
          alt="Per"
          style={{ width: 64, height: 64, objectFit: 'contain', mixBlendMode: 'multiply' }}
        />
        <p className="max-w-xs text-[var(--heading)]">
          Diese Woche hast du alles im Griff. Genieß die freie Zeit.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {woche.map(({ datum, istHeute, bloecke, pruefungen }) => {
        const fachNamen = [...new Set(bloecke.map((b) => b.fach?.name).filter(Boolean))]
        return (
          <section key={datum.toISOString()}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="font-serif text-[16px] text-[var(--heading)]">
                {formatiereTag(datum)}
              </h3>
              {istHeute && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Heute
                </span>
              )}
            </div>

            {bloecke.length > 0 ? (
              <p className="mb-2 text-[12px] text-[var(--muted-2)]">
                {bloecke.length} {bloecke.length === 1 ? 'Block' : 'Blöcke'}
                {fachNamen.length > 0 ? ` · ${fachNamen.join(', ')}` : ''}
              </p>
            ) : (
              pruefungen.length === 0 && (
                <p className="mb-2 text-[13px] font-medium text-perceive-accent">Freier Tag ✓</p>
              )
            )}

            {pruefungen.map((f) => (
              <div
                key={f.id}
                className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-[var(--danger)] dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400"
              >
                🎯 Prüfung: {f.name}
              </div>
            ))}

            {bloecke.length > 0 && (
              <div className="flex flex-col gap-2">
                {bloecke.map((block) => (
                  <BlockKarteKompakt
                    key={block.id}
                    block={block}
                    istNeu={!fortschrittMap.has(block.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
