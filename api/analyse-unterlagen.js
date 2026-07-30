import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from './_utils.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, images, fachName, pruefungsdatum, lerntage, modus } = req.body
  if (!text && (!images || images.length === 0)) {
    return res.status(400).json({ error: 'Kein Text oder Bild übergeben' })
  }

  const themenvorgabeHinweis =
    modus === 'themenvorgabe'
      ? '\n\nWICHTIG: Dieses Dokument ist eine offizielle Themenvorgabe oder ein Lehrplan, keine Lernunterlage. Extrahiere alle genannten Themen und Inhalte und erstelle daraus optimale Lernblöcke. Jeder Block soll ein abgrenzbares Thema abdecken. Formuliere für jeden Block eine prägnante Kernaussage die erklärt worum es geht. Der Inhalt-Text soll die wichtigsten Unterthemen und Konzepte auflisten die ein Schüler/Student zu diesem Block verstehen muss.'
      : ''

  const basisPrompt = `Du bist ein Lernexperte für Studierende mit ADHS der Prüfungsunterlagen analysiert.

Deine Aufgabe: Strukturiere den Lernstoff in PRÜFUNGSRELEVANTE Blöcke die wirklich beim Bestehen helfen.

WICHTIG: Antworte NUR mit validem JSON, kein Markdown, keine Erklärungen.

Prüfungsdatum: ${pruefungsdatum}
Fach: ${fachName}

Analyse-Regeln:
- Maximal 8 Blöcke — lieber 5 sehr gute als 8 mittelmäßige
- Jeder Block = GENAU EIN Konzept/Thema das man verstehen muss
- Priorisiere was wirklich prüfungsrelevant ist — lass Hintergrundwissen weg
- Inhaltsfelder/Themen die explizit im Lehrplan stehen: höchste Priorität
- Jeder Block muss in 8-12 Minuten lernbar sein — wenn nicht: aufteilen
- Einfache direkte Sprache — kein Fachjargon ohne sofortige Erklärung
- Die Kernaussage muss der eine Satz sein den man in der Prüfung braucht

Format:
{
  "bloecke": [
    {
      "titel": "Kurzer prägnanter Titel — max 6 Wörter",
      "inhalt": "Klar erklärter Lerninhalt — nur was prüfungsrelevant ist. Max 150 Wörter. Einfache Sprache. Konkrete Beispiele wo möglich.",
      "kernaussage": "Der EINE Satz den man für die Prüfung wissen muss",
      "schwierigkeit": 3,
      "reihenfolge": 1,
      "pruefungsrelevanz": "hoch" | "mittel"
    }
  ]
}`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let messageContent
  if (images && images.length > 0) {
    messageContent = [
      ...images.map((bild) => ({
        type: 'image',
        source: { type: 'base64', media_type: bild.mediaType, data: bild.data },
      })),
      {
        type: 'text',
        text: `${basisPrompt}\n\nDer Lernstoff steht in den angehängten Bildern (Fotos von Unterlagen, Tafelbildern oder Handschrift). Lies sie sorgfältig.${themenvorgabeHinweis}`,
      },
    ]
  } else {
    messageContent = `${basisPrompt}\n\nLernstoff:\n${text.substring(0, 10000)}${themenvorgabeHinweis}`
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: messageContent }],
    })

    const responseText = message.content[0].text
    const parsed = parseClaudeJson(responseText)
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('Vollständiger Fehler:', err)
    return res.status(500).json({ error: err.message, stack: err.stack })
  }
}
