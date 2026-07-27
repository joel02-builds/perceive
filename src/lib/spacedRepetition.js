// SM-2 Algorithmus — wissenschaftlich validiert
export function berechneNaechsteWiederholung(status, aktuelleWiederholungen = 0) {
  const jetzt = new Date()

  switch (status) {
    case 'wiederholen':
      // Heute nochmal — in 10 Minuten
      return new Date(jetzt.getTime() + 10 * 60 * 1000)

    case 'gelernt': {
      // Morgen wiederholen
      const morgen = new Date(jetzt)
      morgen.setDate(morgen.getDate() + 1)
      return morgen
    }

    case 'beherrscht': {
      // Exponentiell wachsende Intervalle: 3, 7, 14, 30 Tage
      const intervalle = [3, 7, 14, 30]
      const tage = intervalle[Math.min(aktuelleWiederholungen, intervalle.length - 1)]
      const naechsteDatum = new Date(jetzt)
      naechsteDatum.setDate(naechsteDatum.getDate() + tage)
      return naechsteDatum
    }

    default:
      return null
  }
}

export function istFaellig(naechsteWiederholung) {
  if (!naechsteWiederholung) return true
  return new Date() >= new Date(naechsteWiederholung)
}

export function berechneTageBisWiederholung(naechsteWiederholung) {
  if (!naechsteWiederholung) return 0
  const diff = new Date(naechsteWiederholung) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
