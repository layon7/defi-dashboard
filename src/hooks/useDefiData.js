import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchCoinGeckoPrices, fetchGlobalStats, fetchCoinHistory,
  searchCoins, fetchCoinsByIds, fetchFearGreed, fetchOHLC,
  fetchZerionPortfolio, fetchZerionPositions, fetchZerionTransactions,
} from '../services/api.js'

const CG_TO_BINANCE = {
  'bitcoin':'btcusdt','ethereum':'ethusdt','binancecoin':'bnbusdt',
  'solana':'solusdt','ripple':'xrpusdt','dogecoin':'dogeusdt',
  'tron':'trxusdt','cardano':'adausdt','avalanche-2':'avaxusdt',
  'shiba-inu':'shibusdt','chainlink':'linkusdt','polkadot':'dotusdt',
  'uniswap':'uniusdt','near':'nearusdt','aave':'aaveusdt',
  'matic-network':'maticusdt','arbitrum':'arbusdt','optimism':'opusdt',
  'cosmos':'atomusdt','stellar':'xlmusdt','maker':'mkrusdt',
  'curve-dao-token':'crvusdt','injective-protocol':'injeusdt',
  'aptos':'aptusdt','sui':'suiusdt','pepe':'pepeusdt',
  'render-token':'renderusdt','chiliz':'chzusdt',
}

// ── Precios: CoinGecko + Binance WS (optimizado) ──────────────
export function usePrices() {
  const [prices, setPrices]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [wsStatus, setWsStatus]     = useState('connecting')
  const wsRef     = useRef(null)
  const pricesRef = useRef([])

  const loadBase = useCallback(async () => {
    try {
      const data = await fetchCoinGeckoPrices()
      pricesRef.current = data
      setPrices(data)
      setLastUpdate(new Date())
    } catch {}
    finally { setLoading(false) }
  }, [])

  const connectWS = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    const streams = Object.values(CG_TO_BINANCE).filter(Boolean).map(s=>`${s}@ticker`).join('/')
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
    wsRef.current = ws
    ws.onopen  = () => setWsStatus('live')
    ws.onerror = () => setWsStatus('error')
    ws.onclose = () => { setWsStatus('connecting'); setTimeout(connectWS, 3000) }
    ws.onmessage = evt => {
      try {
        const { data: p } = JSON.parse(evt.data)
        if (!p?.s) return
        const cgId = Object.entries(CG_TO_BINANCE).find(([,v])=>v===p.s.toLowerCase())?.[0]
        if (!cgId) return
        pricesRef.current = pricesRef.current.map(c =>
          c.id === cgId ? { ...c, current_price: parseFloat(p.c), price_change_percentage_24h: parseFloat(p.P) } : c
        )
        setPrices([...pricesRef.current])
        setLastUpdate(new Date())
      } catch {}
    }
  }, [])

  useEffect(() => {
    loadBase().then(connectWS)
    const iv = setInterval(loadBase, 300000)
    return () => { clearInterval(iv); wsRef.current?.close() }
  }, [loadBase, connectWS])

  return { prices, loading, lastUpdate, wsStatus }
}

// ── Búsqueda global (arreglada, sin loops) ────────────────────
export function useGlobalSearch(query, localPrices) {
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const timerRef   = useRef(null)
  const localRef   = useRef(localPrices)

  useEffect(() => { localRef.current = localPrices }, [localPrices])

  useEffect(() => {
    if (!query || query.trim().length < 2) { setResults([]); setSearching(false); return }

    const local = localRef.current.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.symbol.toLowerCase().includes(query.toLowerCase())
    )
    setResults(local)
    setSearching(true)

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const found  = await searchCoins(query)
        const localSet = new Set(localRef.current.map(p=>p.id))
        const newIds   = found.filter(c=>!localSet.has(c.id)).map(c=>c.id)
        const extra    = newIds.length > 0 ? await fetchCoinsByIds(newIds) : []
        setResults([...local, ...extra])
      } catch { setResults(local) }
      finally { setSearching(false) }
    }, 600)

    return () => clearTimeout(timerRef.current)
  }, [query])

  return { results, searching }
}

// ── Stats globales ────────────────────────────────────────────
export function useGlobalStats() {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    fetchGlobalStats().then(d=>setStats(d.data)).catch(()=>setStats(null))
  }, [])
  return { stats }
}

// ── Fear & Greed Index ────────────────────────────────────────
export function useFearGreed() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetchFearGreed().then(setData).catch(()=>setData(null))
    // Refresca cada hora
    const iv = setInterval(() => fetchFearGreed().then(setData).catch(()=>{}), 3600000)
    return () => clearInterval(iv)
  }, [])
  return { fearGreed: data }
}

// ── OHLC para gráfico de velas ────────────────────────────────
export function useOHLC(coinId, days = 7) {
  const [candles, setCandles] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!coinId) { setCandles([]); return }
    setLoading(true)
    fetchOHLC(coinId, days)
      .then(data => {
        // data = [[ts, open, high, low, close], ...]
        setCandles(data.map(([ts, o, h, l, c]) => ({
          ts, open:o, high:h, low:l, close:c,
          date: new Date(ts).toLocaleDateString('es-CO',{month:'short',day:'numeric'})
        })))
      })
      .catch(() => setCandles([]))
      .finally(() => setLoading(false))
  }, [coinId, days])

  return { candles, loading }
}

// ── Historial 7d (para sparklines en overview si se necesita) ─
export function useCoinHistory(coinId, days = 7) {
  const [history, setHistory] = useState([])
  useEffect(() => {
    if (!coinId) return
    fetchCoinHistory(coinId, days)
      .then(d => {
        const labels = days === 7 ? ['Lun','Mar','Mié','Jue','Vie','Sáb','Hoy'] : []
        setHistory(d.prices.slice(-days).map((p,i) => ({ day: labels[i]||`D${i+1}`, value: p[1] })))
      }).catch(() => setHistory([]))
  }, [coinId, days])
  return { history }
}

// ── Watchlist ─────────────────────────────────────────────────
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => {
    try { const s = localStorage.getItem('defi_wl_v5'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const [extraCoins, setExtraCoins] = useState(() => {
    try { const s = localStorage.getItem('defi_extra_v5'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const saveWL    = l => { setWatchlist(l);   try { localStorage.setItem('defi_wl_v5',    JSON.stringify(l)) } catch {} }
  const saveExtra = c => { setExtraCoins(c);  try { localStorage.setItem('defi_extra_v5', JSON.stringify(c)) } catch {} }
  const add    = (id, data) => { if (!watchlist.includes(id)) saveWL([...watchlist, id]); if (data && !extraCoins.find(c=>c.id===id)) saveExtra([...extraCoins, data]) }
  const remove = (id) => { saveWL(watchlist.filter(w=>w!==id)); saveExtra(extraCoins.filter(c=>c.id!==id)) }
  const toggle = (id, data) => watchlist.includes(id) ? remove(id) : add(id, data)
  const clear  = () => { saveWL([]); saveExtra([]) }
  return { watchlist, extraCoins, toggle, clear }
}

// ── Zerion Wallet ─────────────────────────────────────────────
export function useWallet(address) {
  const [portfolio,    setPortfolio]    = useState(null)
  const [positions,    setPositions]    = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)

  const load = useCallback(async addr => {
    if (!addr || !addr.startsWith('0x')) return
    setLoading(true); setError(null)
    try {
      const [port, pos, txs] = await Promise.all([
        fetchZerionPortfolio(addr),
        fetchZerionPositions(addr),
        fetchZerionTransactions(addr),
      ])
      setPortfolio(port?.data?.attributes || null)
      setPositions(pos?.data || [])
      setTransactions(txs?.data || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!address) return
    load(address)
    const iv = setInterval(() => load(address), 120000)
    return () => clearInterval(iv)
  }, [address, load])

  return { portfolio, positions, transactions, loading, error, refresh: () => load(address) }
}