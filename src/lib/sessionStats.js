const BLOCK_ZAEHLER_PREFIX = 'perceive_blocks_heute_'
const LETZTER_LOGIN_KEY = 'perceive_letzter_login'

// Lokales Kalenderdatum — NICHT toISOString() verwenden, das rechnet in UTC
// um und verschiebt das Datum in Zeitzonen östlich von UTC (z. B. CEST).
function heutigesDatumLokal() {
  const jetzt = new Date()
  const jahr = jetzt.getFullYear()
  const monat = String(jetzt.getMonth() + 1).padStart(2, '0')
  const tag = String(jetzt.getDate()).padStart(2, '0')
  return `${jahr}-${monat}-${tag}`
}

function blockZaehlerSchluessel() {
  return `${BLOCK_ZAEHLER_PREFIX}${heutigesDatumLokal()}`
}

export function inkrementiereBlockZaehler() {
  try {
    const schluessel = blockZaehlerSchluessel()
    const neu = (Number(localStorage.getItem(schluessel)) || 0) + 1
    localStorage.setItem(schluessel, String(neu))
    return neu
  } catch {
    return 0
  }
}

export function leseBlockZaehlerHeute() {
  try {
    return Number(localStorage.getItem(blockZaehlerSchluessel())) || 0
  } catch {
    return 0
  }
}

// Liest den letzten Login, bevor er auf jetzt aktualisiert wird.
// Gibt die Anzahl Tage seit dem letzten Login zurück (null wenn es keinen gab).
export function pruefeUndAktualisiereLetztenLogin() {
  try {
    const vorheriger = localStorage.getItem(LETZTER_LOGIN_KEY)
    localStorage.setItem(LETZTER_LOGIN_KEY, new Date().toISOString())
    if (!vorheriger) return null
    const diffMs = Date.now() - new Date(vorheriger).getTime()
    return diffMs / (1000 * 60 * 60 * 24)
  } catch {
    return null
  }
}
