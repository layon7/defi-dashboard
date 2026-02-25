import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchCoinGeckoPrices, fetchGlobalStats, fetchCoinHistory,
  fetchWalletPortfolio, fetchWalletTokens, fetchWalletProtocols, fetchWalletHistory,
} from '../services/api.js'

// Mapa CoinGecko ID → símbolo Binance WS (los más comunes del top 500)
const CG_TO_BINANCE = {
  'bitcoin':'btcusdt','ethereum':'ethusdt','binancecoin':'bnbusdt',
  'solana':'solusdt','ripple':'xrpusdt','dogecoin':'dogeusdt',
  'tron':'trxusdt','cardano':'adausdt','avalanche-2':'avaxusdt',
  'shiba-inu':'shibusdt','chainlink':'linkusdt','polkadot':'dotusdt',
  'uniswap':'uniusdt','near':'nearusdt','aave':'aaveusdt',
  'matic-network':'maticusdt','arbitrum':'arbusdt','optimism':'opusdt',
  'cosmos':'atomusdt','stellar':'xlmusdt','monero':'xmrusdt',
  'algorand':'algousdt','filecoin':'filusdt','internet-computer':'icpusdt',
  'hedera-hashgraph':'hbarusdt','vechain':'vetusdt','theta-token':'thetausdt',
  'the-sandbox':'sandusdt','decentraland':'manausdt','axie-infinity':'axsusdt',
  'maker':'mkrusdt','compound-governance-token':'compusdt','curve-dao-token':'crvusdt',
  'synthetix-network-token':'snxusdt','yearn-finance':'yfiusdt','sushi':'sushiusdt',
  '1inch':'1inchusdt','pancakeswap-token':'cakeusdt','injective-protocol':'injeusdt',
  'aptos':'aptusdt','sui':'suiusdt','sei-network':'seiusdt',
  'pepe':'pepeusdt','floki':'flokiusdt','bonk':'bonkusdt',
  'render-token':'renderusdt','fetch-ai':'fetusdt','ocean-protocol':'oceanusdt',
  'gala':'galausdt','enjincoin':'enjusdt','chiliz':'chzusdt',
  'flow':'flowusdt','harmony':'oneusdt','zilliqa':'zilusdt',
}

// ── Precios: CoinGecko base + Binance WS tick a tick ──────────
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

// ── Stats globales ─────────────────────────────────────────────
export function useGlobalStats() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetchGlobalStats()
      .then(d => setStats(d.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])
  return { stats, loading }
}

// ── Historial ETH 7 días ───────────────────────────────────────
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

// ── Watchlist — VACÍA por defecto ─────────────────────────────
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem('defi_watchlist_v3')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const save   = (list) => { setWatchlist(list); try { localStorage.setItem('defi_watchlist_v3', JSON.stringify(list)) } catch {} }
  const add    = (id)   => { if (!watchlist.includes(id)) save([...watchlist, id]) }
  const remove = (id)   => save(watchlist.filter(w => w !== id))
  const toggle = (id)   => watchlist.includes(id) ? remove(id) : add(id)
  const clear  = ()     => save([])
  return { watchlist, add, remove, toggle, clear }
}

// ── Wallet DeBank completa ─────────────────────────────────────
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
        fetchWalletPortfolio(addr),
        fetchWalletTokens(addr),
        fetchWalletProtocols(addr),
        fetchWalletHistory(addr),
      ])
      setPortfolio(port)
      setTokens(toks    || [])
      setProtocols(protos || [])
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