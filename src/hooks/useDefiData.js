import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchCoinGeckoPrices, fetchGlobalStats, fetchCoinHistory,
  fetchWalletPortfolio, fetchWalletTokens, fetchWalletProtocols, fetchWalletHistory,
  searchCoins, fetchCoinsByIds,
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
  'maker':'mkrusdt','curve-dao-token':'crvusdt','sushi':'sushiusdt',
  'injective-protocol':'injeusdt','aptos':'aptusdt','sui':'suiusdt',
  'pepe':'pepeusdt','render-token':'renderusdt','fetch-ai':'fetusdt',
  'gala':'galausdt','chiliz':'chzusdt','flow':'flowusdt',
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
      setError(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const connectWS = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    const symbols = Object.values(CG_TO_BINANCE).filter(Boolean)
    const streams = symbols.map(s => `${s}@ticker`).join('/')
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
    wsRef.current = ws
    ws.onopen  = () => setWsStatus('live')
    ws.onerror = () => setWsStatus('error')
    ws.onclose = () => { setWsStatus('connecting'); setTimeout(connectWS, 3000) }
    ws.onmessage = (evt) => {
      try {
        const { data: payload } = JSON.parse(evt.data)
        if (!payload?.s) return
        const symbol = payload.s.toLowerCase()
        const price  = parseFloat(payload.c)
        const chg24  = parseFloat(payload.P)
        const cgId   = Object.entries(CG_TO_BINANCE).find(([, v]) => v === symbol)?.[0]
        if (!cgId) return
        pricesRef.current = pricesRef.current.map(p =>
          p.id === cgId ? { ...p, current_price: price, price_change_percentage_24h: chg24 } : p
        )
        setPrices([...pricesRef.current])
        setLastUpdate(new Date())
      } catch (_) {}
    }
  }, [])

  useEffect(() => {
    loadBase().then(connectWS)
    const interval = setInterval(loadBase, 300000)
    return () => { clearInterval(interval); wsRef.current?.close() }
  }, [loadBase, connectWS])

  return { prices, loading, error, lastUpdate, wsStatus, refresh: loadBase }
}

// ── Búsqueda global — busca en TODO CoinGecko, no solo top 500 ──
export function useGlobalSearch(query, localPrices) {
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return }

    // Primero filtra local (top 500)
    const local = localPrices.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.symbol.toLowerCase().includes(query.toLowerCase())
    )

    // Luego busca globalmente con debounce 500ms
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const searchRes = await searchCoins(query)
        // IDs que no están ya en resultados locales
        const localIds  = new Set(local.map(p => p.id))
        const newIds    = searchRes.filter(c => !localIds.has(c.id)).map(c => c.id)

        if (newIds.length > 0) {
          const extra = await fetchCoinsByIds(newIds)
          setResults([...local, ...extra])
        } else {
          setResults(local)
        }
      } catch {
        setResults(local)
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => clearTimeout(debounceRef.current)
  }, [query, localPrices])

  return { results, loading }
}

// ── Stats globales ─────────────────────────────────────────────
export function useGlobalStats() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetchGlobalStats().then(d => setStats(d.data)).catch(() => setStats(null)).finally(() => setLoading(false))
  }, [])
  return { stats, loading }
}

// ── Historial ETH 7d ───────────────────────────────────────────
export function useEthHistory() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetchCoinHistory('ethereum', 7)
      .then(d => {
        const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Hoy']
        setHistory(d.prices.slice(-7).map((p, i) => ({ day: days[i] || `D${i+1}`, value: p[1] })))
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [])
  return { history, loading }
}

// ── Watchlist vacía por defecto ────────────────────────────────
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => {
    try { const s = localStorage.getItem('defi_watchlist_v4'); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })
  // También guarda monedas extra (fuera del top500) para que persistan
  const [extraCoins, setExtraCoins] = useState(() => {
    try { const s = localStorage.getItem('defi_extra_coins'); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })

  const save      = (list) => { setWatchlist(list); try { localStorage.setItem('defi_watchlist_v4', JSON.stringify(list)) } catch {} }
  const saveExtra = (coins) => { setExtraCoins(coins); try { localStorage.setItem('defi_extra_coins', JSON.stringify(coins)) } catch {} }

  const add = (id, coinData) => {
    if (!watchlist.includes(id)) save([...watchlist, id])
    // Si tiene datos de precio (moneda extra), guárdala
    if (coinData && !extraCoins.find(c => c.id === id)) saveExtra([...extraCoins, coinData])
  }
  const remove = (id) => {
    save(watchlist.filter(w => w !== id))
    saveExtra(extraCoins.filter(c => c.id !== id))
  }
  const toggle = (id, coinData) => watchlist.includes(id) ? remove(id) : add(id, coinData)
  const clear  = () => { save([]); saveExtra([]) }

  return { watchlist, extraCoins, add, remove, toggle, clear }
}

// ── Wallet DeBank ──────────────────────────────────────────────
export function useWallet(address) {
  const [portfolio,  setPortfolio]  = useState(null)
  const [tokens,     setTokens]     = useState([])
  const [protocols,  setProtocols]  = useState([])
  const [history,    setHistory]    = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)

  const load = useCallback(async (addr) => {
    if (!addr || !addr.startsWith('0x')) return
    setLoading(true); setError(null)
    try {
      const [port, toks, protos, hist] = await Promise.all([
        fetchWalletPortfolio(addr), fetchWalletTokens(addr),
        fetchWalletProtocols(addr), fetchWalletHistory(addr),
      ])
      setPortfolio(port); setTokens(toks || []); setProtocols(protos || [])
      setHistory(hist?.history_list || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!address) return
    load(address)
    const interval = setInterval(() => load(address), 120000)
    return () => clearInterval(interval)
  }, [address, load])

  return { portfolio, tokens, protocols, history, loading, error, refresh: () => load(address) }
}