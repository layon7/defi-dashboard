// /api/zerion.js — Vercel Serverless Function
// Proxy server-side para Zerion API — resuelve CORS
// Ruta: coloca este archivo en /api/zerion.js (raíz del proyecto)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { path, ...params } = req.query
  if (!path) return res.status(400).json({ error: 'Missing path' })

  const ZERION_KEY = process.env.VITE_ZERION_API_KEY
  if (!ZERION_KEY) {
    return res.status(500).json({ error: 'VITE_ZERION_API_KEY not set in environment variables' })
  }

  const qs  = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
  const url = `https://api.zerion.io/v1/${path}${qs}`

  try {
    const upstream = await fetch(url, {
      headers: {
        'accept':        'application/json',
        'authorization': `Basic ${Buffer.from(ZERION_KEY + ':').toString('base64')}`,
      },
    })

    if (!upstream.ok) {
      const txt = await upstream.text()
      return res.status(upstream.status).json({ error: `Zerion ${upstream.status}: ${txt.slice(0, 200)}` })
    }

    const data = await upstream.json()
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: `Proxy fetch error: ${err.message}` })
  }
}