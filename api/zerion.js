// /api/zerion.js — Vercel Serverless Function (proxy)
// Coloca este archivo en la carpeta /api/ en la raíz del proyecto
// Vercel lo expone automáticamente en /api/zerion
// Resuelve CORS: Browser → este proxy → Zerion API → respuesta

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { path, ...params } = req.query
  if (!path) return res.status(400).json({ error: 'Missing path parameter' })

  const ZERION_KEY = process.env.VITE_ZERION_API_KEY
  if (!ZERION_KEY) return res.status(500).json({ error: 'Zerion API key not configured in environment variables' })

  const qs  = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
  const url = `https://api.zerion.io/v1/${path}${qs}`

  try {
    const upstream = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'authorization': `Basic ${Buffer.from(ZERION_KEY + ':').toString('base64')}`,
      },
    })
    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (err) {
    return res.status(500).json({ error: `Proxy error: ${err.message}` })
  }
}