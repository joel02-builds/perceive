import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from './_utils.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, fachName, pruefungsdatum, lerntage } = req.body
  if (!text) return res.status(400).json({ error: 'Kein Text übergeben' })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Du bist ein Lernexperte für Studierende mit ADHS. Analysiere den folgenden Lernstoff für das Fach "${fachName}" und strukturiere ihn in klar abgegrenzte Lernblöcke.

WICHTIG: Antworte NUR mit validem JSON, keine Erklärungen, kein Markdown.

Format:
{
  "bloecke": [
    {
      "titel": "Kurzer, klarer Titel des Blocks",
      "inhalt": "Der Lerninhalt dieses Blocks — klar, verständlich, in einfacher Sprache erklärt. Maximal 200 Wörter pro Block.",
      "kernaussage": "Die eine wichtigste Aussage dieses Blocks in einem Satz",
      "schwierigkeit": 3,
      "reihenfolge": 1
    }
  ]
}

Regeln:
- Maximal 8-10 Blöcke — lieber weniger, dafür klar
- Jeder Block hat genau EINE Kernaussage
- Inhalt in einfacher, direkter Sprache — keine Fachsprache ohne Erklärung
- Schwierigkeit 1-5 (1=sehr einfach, 5=sehr schwer)
- Reihenfolge logisch aufbauend

Lernstoff:
${text.substring(0, 8000)}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].text
    const parsed = parseClaudeJson(responseText)
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('Analyse-Fehler:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
