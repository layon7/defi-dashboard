import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchCoinGeckoPrices, fetchGlobalStats, fetchFearGreed,
  fetchOHLC, fetchPriceHistory, searchCoins, fetchCoinsByIds,
  fetchZerionPortfolio, fetchZerionPositions, fetchZerionTransactions,
} from '../services/api.js'
import { generateSignal } from '../utils/indicators.js'

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

// Colores por chain para mostrar badges distintivos
export const CHAIN_COLORS = {
  ethereum:  '#627EEA',
  polygon:   '#8247E5',
  arbitrum:  '#28A0F0',
  optimism:  '#FF0420',
  base:      '#0052FF',
  avalanche: '#E84142',
  bsc:       '#F3BA2F',
  solana:    '#9945FF',
  fantom:    '#1969FF',
  gnosis:    '#04795B',
  zksync:    '#8B8DFC',
  linea:     '#61DFFF',
}

export const CHAIN_NAMES = {
  ethereum:  'ETH',
  polygon:   'MATIC',
  arbitrum:  'ARB',
  optimism:  'OP',
  base:      'BASE',
  avalanche: 'AVAX',
  bsc:       'BSC',
  solana:    'SOL',
  fantom:    'FTM',
  gnosis:    'GNO',
  zksync:    'zkSync',
  linea:     'Linea',
}

// ── Precios + WebSocket ───────────────────────────────────────
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
      if (data.length > 0) {
        pricesRef.current = data
        setPrices(data)
        setLastUpdate(new Date())
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  const connectWS = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    const streams = Object.values(CG_TO_BINANCE).filter(Boolean).map(s => `${s}@ticker`).join('/')
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
    wsRef.current = ws
    ws.onopen  = () => setWsStatus('live')
    ws.onerror = () => setWsStatus('error')
    ws.onclose = () => { setWsStatus('connecting'); setTimeout(connectWS, 3000) }
    ws.onmessage = evt => {
      try {
        const { data: p } = JSON.parse(evt.data)
        if (!p?.s) return
        const cgId = Object.entries(CG_TO_BINANCE).find(([, v]) => v === p.s.toLowerCase())?.[0]
        if (!cgId) return
        pricesRef.current = pricesRef.current.map(c =>
          c.id === cgId
            ? { ...c, current_price: parseFloat(p.c), price_change_percentage_24h: parseFloat(p.P) }
            : c
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

// ── Búsqueda global ───────────────────────────────────────────
export function useGlobalSearch(query, localPrices) {
  const [results,   setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const timerRef = useRef(null)
  const localRef = useRef(localPrices)
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
        const ids    = new Set(localRef.current.map(p => p.id))
        const newIds = found.filter(c => !ids.has(c.id)).map(c => c.id)
        const extra  = newIds.length > 0 ? await fetchCoinsByIds(newIds) : []
        setResults([...local, ...extra])
      } catch { setResults(local) }
      finally { setSearching(false) }
    }, 600)
    return () => clearTimeout(timerRef.current)
  }, [query])

  return { results, searching }
}

export function useGlobalStats() {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    fetchGlobalStats().then(d => setStats(d.data)).catch(() => setStats(null))
  }, [])
  return { stats }
}

export function useFearGreed() {
  const [fearGreed, setFearGreed] = useState(null)
  useEffect(() => {
    fetchFearGreed().then(setFearGreed).catch(() => {})
    const iv = setInterval(() => fetchFearGreed().then(setFearGreed).catch(() => {}), 3600000)
    return () => clearInterval(iv)
  }, [])
  return { fearGreed }
}

export function useOHLC(coinId, days = 7) {
  const [candles, setCandles] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!coinId) { setCandles([]); return }
    setLoading(true)
    fetchOHLC(coinId, days)
      .then(raw => setCandles(raw.map(([ts, o, h, l, c]) => ({
        ts, open: o, high: h, low: l, close: c,
        date: new Date(ts).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })
      }))))
      .catch(() => setCandles([]))
      .finally(() => setLoading(false))
  }, [coinId, days])
  return { candles, loading }
}

// ── Análisis técnico — ahora con volúmenes ────────────────────
export function useAnalysis(coinId) {
  const [signal,  setSignal]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!coinId) { setSignal(null); return }
    setLoading(true); setError(null); setSignal(null)
    fetchPriceHistory(coinId, 90)
      .then(data => {
        const prices  = data.prices.map(([, p]) => p)
        const volumes = data.total_volumes?.map(([, v]) => v) || null
        // Pasa volúmenes al generador de señales
        setSignal(generateSignal(prices, volumes, null))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [coinId])

  return { signal, loading, error }
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => {
    try { const s = localStorage.getItem('defi_wl_v5'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const [extraCoins, setExtraCoins] = useState(() => {
    try { const s = localStorage.getItem('defi_extra_v5'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const saveWL    = l => { setWatchlist(l);  try { localStorage.setItem('defi_wl_v5',    JSON.stringify(l)) } catch {} }
  const saveExtra = c => { setExtraCoins(c); try { localStorage.setItem('defi_extra_v5', JSON.stringify(c)) } catch {} }
  const add    = (id, data) => {
    if (!watchlist.includes(id)) saveWL([...watchlist, id])
    if (data && !extraCoins.find(c => c.id === id)) saveExtra([...extraCoins, data])
  }
  const remove = id => { saveWL(watchlist.filter(w => w !== id)); saveExtra(extraCoins.filter(c => c.id !== id)) }
  const toggle = (id, data) => watchlist.includes(id) ? remove(id) : add(id, data)
  const clear  = () => { saveWL([]); saveExtra([]) }
  return { watchlist, extraCoins, toggle, clear }
}

// ── Zerion: parser mejorado para chains ──────────────────────
// La respuesta de Zerion tiene:
// pos.relationships.chain.data.id → el chain ID correcto
// pos.attributes → datos del token
function parsePortfolio(raw) {
  const attr = raw?.data?.attributes
  if (!attr) return null
  const total = attr.total?.value ?? attr.total_usd_value ?? 0
  return {
    totalValue:   total,
    chains:       attr.positions_distribution_by_chain || {},
    distribution: attr.positions_distribution_by_type || {},
    pnl24h:       attr.changes?.percent_1d ?? null,
    pnlAbs24h:    attr.changes?.absolute_1d?.value ?? null,
  }
}

function parsePositions(raw) {
  return (raw?.data || []).map(pos => {
    const a     = pos.attributes
    const tk    = a?.fungible_info
    const qty   = a?.quantity?.float ?? 0
    const price = a?.price ?? 0
    const value = a?.value ?? (qty * price)

    // ← AQUÍ está el fix del chain:
    // Zerion mete el chain en relationships, NO en attributes
    const chainId = pos.relationships?.chain?.data?.id
      ?? a?.chain        // fallback antiguo
      ?? 'ethereum'

    return {
      id:     pos.id,
      symbol: tk?.symbol || '?',
      name:   tk?.name   || '',
      icon:   tk?.icon?.url || null,
      chain:  chainId,
      qty, price, value,
      pct1d:  a?.changes?.percent_1d ?? null,
    }
  }).filter(p => p.value > 0.01)
    .sort((a, b) => b.value - a.value)
}

function parseTransactions(raw) {
  return (raw?.data || []).map(tx => {
    const a      = tx.attributes
    const chainId = tx.relationships?.chain?.data?.id ?? a?.chain ?? 'ethereum'
    return {
      id:     tx.id,
      type:   a?.operation_type || 'transfer',
      status: a?.status || 'confirmed',
      chain:  chainId,
      time:   a?.mined_at || a?.sent_at || null,
      value:  a?.transfers?.reduce((s, t) => s + (t.value ?? 0), 0) ?? 0,
      fee:    a?.fee?.value ?? null,
      hash:   a?.hash || null,
    }
  })
}

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
      const [portRaw, posRaw, txRaw] = await Promise.all([
        fetchZerionPortfolio(addr),
        fetchZerionPositions(addr),
        fetchZerionTransactions(addr),
      ])
      const parsedPort = parsePortfolio(portRaw)
      const parsedPos  = parsePositions(posRaw)
      // Si portfolio.totalValue es 0, suma desde posiciones
      if (parsedPort && (!parsedPort.totalValue || parsedPort.totalValue === 0)) {
        parsedPort.totalValue = parsedPos.reduce((s, p) => s + p.value, 0)
      }
      setPortfolio(parsedPort)
      setPositions(parsedPos)
      setTransactions(parseTransactions(txRaw))
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