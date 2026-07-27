import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from './_utils.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { frage, antwort, musterantwort, blockInhalt } = req.body
  if (!frage || !antwort) {
    return res.status(400).json({ error: 'frage und antwort sind erforderlich' })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Du bist ein geduldiger, wohlwollender Lernbegleiter für Studierende mit ADHS. Bewerte diese Antwort.

Frage: "${frage}"
Antwort des Nutzers: "${antwort}"
Musterantwort: "${musterantwort}"
Blockinhalt zur Orientierung: "${blockInhalt}"

Antworte NUR mit validem JSON:
{
  "status": "beherrscht" | "gelernt" | "wiederholen",
  "feedback": "Kurzes, warmes, direktes Feedback — max 2 Sätze. Bei Fehlern: was war gut, was fehlt noch.",
  "naechster_schritt": "Eine konkrete kleine Empfehlung"
}

Status-Regeln:
- "beherrscht": Kernaussage klar verstanden, auch wenn nicht perfekt formuliert
- "gelernt": Grundverständnis da, aber Lücken
- "wiederholen": Wesentliches fehlt oder falsch verstanden

Wichtig: Sei ermutigend. Kein "Falsch" oder "Leider". Fokus auf was der Nutzer verstanden hat.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const parsed = parseClaudeJson(message.content[0].text)
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('Bewertungs-Fehler:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
