import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from './_utils.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { blockTitel, blockInhalt, kernaussage } = req.body
  if (!blockTitel || !blockInhalt) {
    return res.status(400).json({ error: 'blockTitel und blockInhalt sind erforderlich' })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Du bist ein Lernbegleiter für Studierende mit ADHS. Generiere eine Active-Recall-Frage für diesen Lernblock.

Block: "${blockTitel}"
Inhalt: "${blockInhalt}"
Kernaussage: "${kernaussage}"

Antworte NUR mit validem JSON:
{
  "frage": "Eine offene Frage die echtes Verstehen prüft — nicht auswendig lernen",
  "hinweis": "Ein sanfter Hinweis wenn der Nutzer nicht weiter kommt",
  "musterantwort": "Was eine gute Antwort beinhalten sollte — als Orientierung"
}

Die Frage soll:
- Offen sein (kein Ja/Nein)
- Das Konzept wirklich prüfen, nicht nur Fakten
- Für ADHS-Gehirne verständlich formuliert sein — kurz und direkt`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const parsed = parseClaudeJson(message.content[0].text)
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('Vollständiger Fehler:', err)
    return res.status(500).json({ error: err.message, stack: err.stack })
  }
}
