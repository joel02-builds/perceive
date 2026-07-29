import { Link } from 'react-router-dom'
import { istFaellig } from '../lib/spacedRepetition'

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

export default function FaecherUebersicht({ faecher, bloecke, fortschrittMap, beherrschteBlockIds }) {
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const inSiebenTagen = new Date(heute)
  inSiebenTagen.setDate(inSiebenTagen.getDate() + 7)

  const sortiert = [...faecher].sort((a, b) => {
    if (!a.pruefungsdatum && !b.pruefungsdatum) return 0
    if (!a.pruefungsdatum) return 1
    if (!b.pruefungsdatum) return -1
    return new Date(a.pruefungsdatum) - new Date(b.pruefungsdatum)
  })

  return (
    <div className="flex flex-col gap-3">
      {sortiert.map((fach) => {
        const fachBloecke = bloecke.filter((b) => b.fach_id === fach.id)
        const blockIds = fachBloecke.map((b) => b.id)
        const total = blockIds.length
        const beherrscht = blockIds.filter((id) => beherrschteBlockIds.has(id)).length
        const prozent = total > 0 ? Math.round((beherrscht / total) * 100) : 0
        const tage = tageBisPruefung(fach.pruefungsdatum)
        const fachFarbe = fach.farbe || '#3D6B8E'

        const heuteFaellig = fachBloecke.filter((block) =>
          istFaellig(fortschrittMap.get(block.id)?.naechste_wiederholung ?? null)
        ).length
        const dieseWoche = fachBloecke.filter((block) => {
          const nw = fortschrittMap.get(block.id)?.naechste_wiederholung ?? null
          if (!nw) return true
          const datum = new Date(nw)
          return datum <= inSiebenTagen
        }).length

        return (
          <Link
            key={fach.id}
            to={`/fach/${fach.id}`}
            className="block rounded-xl bg-perceive-card p-5 transition-colors duration-150 dark:bg-perceive-darkcard"
            style={{
              border: '1px solid var(--card-border)',
              borderLeft: `4px solid ${fachFarbe}`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = fachFarbe)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--card-border)')}
          >
            <h3 className="font-serif text-[18px] font-bold text-[var(--heading)]">{fach.name}</h3>
            {tage !== null && (
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

            <p className="mt-3 text-[13px] font-semibold text-perceive-primary">
              {heuteFaellig} heute fällig · {dieseWoche} diese Woche
            </p>
          </Link>
        )
      })}

      {faecher.length === 0 && (
        <p className="text-[var(--muted-2)]">Noch keine Fächer angelegt.</p>
      )}
    </div>
  )
}
