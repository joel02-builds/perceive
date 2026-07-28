// Reine JS-Funktion — kein React, keine Supabase-Imports. Bekommt die Daten übergeben.
//
// Erwartete Form pro Block in `allBlocks`:
//   {
//     id, titel, fach_id, schwierigkeit,
//     naechste_wiederholung,        // ISO-String oder null (= neu, noch nie gelernt)
//     fach: { id, name, pruefungsdatum }  // pruefungsdatum als Date-String oder null
//   }

const SCHWIERIGKEITS_REIHENFOLGE = {
  fit: ['schwer', 'mittel', 'leicht'],
  okay: ['mittel', 'leicht', 'schwer'],
  muede: ['leicht', 'mittel'],
}

const MAX_BLOECKE = {
  fit: 8,
  okay: 6,
  muede: 4,
}

function kategorisiereSchwierigkeit(schwierigkeit) {
  const wert = schwierigkeit ?? 3
  if (wert <= 2) return 'leicht'
  if (wert >= 4) return 'schwer'
  return 'mittel'
}

function istFaelligOderNeu(naechsteWiederholung, heute) {
  if (!naechsteWiederholung) return true
  return new Date(naechsteWiederholung) <= heute
}

function berechneTageBisPruefung(pruefungsdatum, heute) {
  if (!pruefungsdatum) return null
  return Math.ceil((new Date(pruefungsdatum) - heute) / 86400000)
}

function interleaveNachFach(blocks) {
  const gruppenNachFach = new Map()
  for (const block of blocks) {
    const key = block.fach_id ?? 'unbekannt'
    if (!gruppenNachFach.has(key)) gruppenNachFach.set(key, [])
    gruppenNachFach.get(key).push(block)
  }

  // Meiste Blöcke zuerst
  const gruppen = [...gruppenNachFach.values()].sort((a, b) => b.length - a.length)

  const ergebnis = []
  let letztesFach = null

  while (gruppen.some((gruppe) => gruppe.length > 0)) {
    const verfuegbar = gruppen.filter((gruppe) => gruppe.length > 0)
    // Bevorzuge eine Gruppe mit anderem Fach als zuletzt gezogen.
    // Ist nur noch ein Fach übrig, landet dessen Gruppe hier zwangsläufig direkt in Reihe.
    const gewaehlteGruppe =
      verfuegbar.find((gruppe) => (gruppe[0].fach_id ?? 'unbekannt') !== letztesFach) ??
      verfuegbar[0]

    const block = gewaehlteGruppe.shift()
    ergebnis.push(block)
    letztesFach = block.fach_id ?? 'unbekannt'
  }

  return ergebnis
}

export function buildTodaysPlan(allBlocks, energyLevel) {
  const heute = new Date()
  const reihenfolge = SCHWIERIGKEITS_REIHENFOLGE[energyLevel] ?? SCHWIERIGKEITS_REIHENFOLGE.okay
  const maxBloecke = MAX_BLOECKE[energyLevel] ?? MAX_BLOECKE.okay

  // Schritt 5 — Prüfungsannäherung: Flags setzen, bevor gefiltert/sortiert wird
  const angereichert = allBlocks.map((block) => {
    const tageBisPruefung = berechneTageBisPruefung(block.fach?.pruefungsdatum, heute)
    const examUrgent = tageBisPruefung !== null && tageBisPruefung <= 7
    const examCritical = tageBisPruefung !== null && tageBisPruefung <= 3

    return {
      ...block,
      tageBisPruefung,
      ...(examUrgent ? { examUrgent: true } : {}),
      ...(examCritical ? { examCritical: true } : {}),
    }
  })

  // Schritt 1 — fällig heute oder überfällig (examUrgent-Blöcke gelten immer als fällig)
  const faellig = angereichert.filter(
    (block) => block.examUrgent || istFaelligOderNeu(block.naechste_wiederholung, heute)
  )

  // Schritt 2 + 3 — nach Schwierigkeitskategorie filtern, dann sortieren und begrenzen
  const passendeSchwierigkeit = faellig.filter((block) =>
    reihenfolge.includes(kategorisiereSchwierigkeit(block.schwierigkeit))
  )

  const sortiert = [...passendeSchwierigkeit].sort((a, b) => {
    // Prüfungskritische Blöcke gehen vor — zuerst critical, dann urgent, dann normal
    const prioA = a.examCritical ? 0 : a.examUrgent ? 1 : 2
    const prioB = b.examCritical ? 0 : b.examUrgent ? 1 : 2
    if (prioA !== prioB) return prioA - prioB

    const kategorieA = kategorisiereSchwierigkeit(a.schwierigkeit)
    const kategorieB = kategorisiereSchwierigkeit(b.schwierigkeit)
    return reihenfolge.indexOf(kategorieA) - reihenfolge.indexOf(kategorieB)
  })

  const begrenzt = sortiert.slice(0, maxBloecke)

  // Schritt 4 — Interleaving: Blöcke desselben Fachs nie direkt hintereinander
  return interleaveNachFach(begrenzt)
}
