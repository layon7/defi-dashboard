// /api/zerion.js — Vercel Serverless Function (proxy)
// Coloca en: /api/zerion.js (raíz del proyecto, carpeta api/)
// Resuelve CORS: Browser → este proxy → Zerion API

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { path, ...params } = req.query
  if (!path) return res.status(400).json({ error: 'Missing path' })

  const KEY = process.env.VITE_ZERION_API_KEY
  if (!KEY)  return res.status(500).json({ error: 'VITE_ZERION_API_KEY not set' })

  const qs  = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
  const url = `https://api.zerion.io/v1/${path}${qs}`

  try {
    const r = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'authorization': `Basic ${Buffer.from(KEY + ':').toString('base64')}`,
      },
    })
    if (!r.ok) {
      const txt = await r.text()
      return res.status(r.status).json({ error: `Zerion ${r.status}: ${txt.slice(0,200)}` })
    }
    return res.status(200).json(await r.json())
  } catch (e) {
    return res.status(500).json({ error: `Proxy error: ${e.message}` })
  }
}