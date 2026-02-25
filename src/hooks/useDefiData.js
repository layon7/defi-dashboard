import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchCoinGeckoPrices, fetchGlobalStats, fetchCoinHistory,
  searchCoins, fetchCoinsByIds,
  fetchZerionPortfolio, fetchZerionPositions, fetchZerionTransactions,
} from '../services/api.js'

const CG_TO_BINANCE = {
  'bitcoin':'btcusdt','ethereum':'ethusdt','binancecoin':'bnbusdt',
  'solana':'solusdt','ripple':'xrpusdt','dogecoin':'dogeusdt',
  'tron':'trxusdt','cardano':'adausdt','avalanche-2':'avaxusdt',
  'shiba-inu':'shibusdt','chainlink':'linkusdt','polkadot':'dotusdt',
  'uniswap':'uniusdt','near':'nearusdt','aave':'aaveusdt',
  'matic-network':'maticusdt','arbitrum':'arbusdt','optimism':'opusdt',
  'cosmos':'atomusdt','stellar':'xlmusdt','monero':'xmrusdt',
  'filecoin':'filusdt','internet-computer':'icpusdt','vechain':'vetusdt',
  'the-sandbox':'sandusdt','decentraland':'manausdt','axie-infinity':'axsusdt',
  'maker':'mkrusdt','curve-dao-token':'crvusdt','injective-protocol':'injeusdt',
  'aptos':'aptusdt','sui':'suiusdt','pepe':'pepeusdt',
  'render-token':'renderusdt','fetch-ai':'fetusdt','chiliz':'chzusdt',
}

// ── Precios CoinGecko + Binance WS ────────────────────────────
export function usePrices() {
  const [prices, setPrices]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
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
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const connectWS = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    const syms    = Object.values(CG_TO_BINANCE).filter(Boolean)
    const streams = syms.map(s => `${s}@ticker`).join('/')
    const ws      = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
    wsRef.current = ws
    ws.onopen  = () => setWsStatus('live')
    ws.onerror = () => setWsStatus('error')
    ws.onclose = () => { setWsStatus('connecting'); setTimeout(connectWS, 3000) }
    ws.onmessage = evt => {
      try {
        const { data: p } = JSON.parse(evt.data)
        if (!p?.s) return
        const sym  = p.s.toLowerCase()
        const cgId = Object.entries(CG_TO_BINANCE).find(([,v]) => v === sym)?.[0]
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

  return { prices, loading, error, lastUpdate, wsStatus, refresh: loadBase }
}

// ── Búsqueda global ARREGLADA ─────────────────────────────────
// Busca en CoinGecko completo y trae precios reales de los que
// NO están ya en el top 500 local
export function useGlobalSearch(query, localPrices) {
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const timerRef = useRef(null)
  const lastQuery = useRef('')

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    // Resultados locales instantáneos (top 500)
    const local = localPrices.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.symbol.toLowerCase().includes(query.toLowerCase())
    )
    setResults(local) // muestra locales de inmediato

    // Luego busca globalmente con debounce
    clearTimeout(timerRef.current)
    setSearching(true)
    timerRef.current = setTimeout(async () => {
      if (query !== lastQuery.current) {
        lastQuery.current = query
        try {
          const found  = await searchCoins(query)
          const localSet = new Set(localPrices.map(p => p.id))
          const newIds   = found.filter(c => !localSet.has(c.id)).map(c => c.id)

          let extra = []
          if (newIds.length > 0) {
            extra = await fetchCoinsByIds(newIds)
          }

          // Combina: locales primero, luego extras
          setResults([...local, ...extra])
        } catch {
          setResults(local)
        } finally {
          setSearching(false)
        }
      }
    }, 600)

    return () => clearTimeout(timerRef.current)
  }, [query]) // solo depende de query, no de localPrices para evitar loops

  return { results, searching }
}

// ── Stats globales ────────────────────────────────────────────
export function useGlobalStats() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetchGlobalStats().then(d => setStats(d.data)).catch(() => setStats(null)).finally(() => setLoading(false))
  }, [])
  return { stats, loading }
}

// ── Historial ETH 7d ──────────────────────────────────────────
export function useEthHistory() {
  const [history, setHistory] = useState([])
  useEffect(() => {
    fetchCoinHistory('ethereum', 7)
      .then(d => {
        const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Hoy']
        setHistory(d.prices.slice(-7).map((p,i) => ({ day: days[i]||`D${i+1}`, value: p[1] })))
      }).catch(() => setHistory([]))
  }, [])
  return { history }
}

// ── Watchlist vacía por defecto ───────────────────────────────
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => {
    try { const s = localStorage.getItem('defi_wl_v5'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const [extraCoins, setExtraCoins] = useState(() => {
    try { const s = localStorage.getItem('defi_extra_v5'); return s ? JSON.parse(s) : [] } catch { return [] }
  })

  const saveWL    = list  => { setWatchlist(list);   try { localStorage.setItem('defi_wl_v5',    JSON.stringify(list))  } catch {} }
  const saveExtra = coins => { setExtraCoins(coins); try { localStorage.setItem('defi_extra_v5', JSON.stringify(coins)) } catch {} }

  const add    = (id, data) => {
    if (!watchlist.includes(id)) saveWL([...watchlist, id])
    if (data && !extraCoins.find(c => c.id === id)) saveExtra([...extraCoins, data])
  }
  const remove = (id) => { saveWL(watchlist.filter(w => w !== id)); saveExtra(extraCoins.filter(c => c.id !== id)) }
  const toggle = (id, data) => watchlist.includes(id) ? remove(id) : add(id, data)
  const clear  = () => { saveWL([]); saveExtra([]) }

  return { watchlist, extraCoins, toggle, clear }
}

// ── Zerion Wallet ─────────────────────────────────────────────
export function useWallet(address) {
  const [portfolio,   setPortfolio]   = useState(null)
  const [positions,   setPositions]   = useState([])
  const [transactions,setTransactions]= useState([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

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