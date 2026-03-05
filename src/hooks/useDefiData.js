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
  'injective-protocol':'injeusdt','aptos':'aptusdt','sui':'suiusdt',
  'pepe':'pepeusdt','render-token':'renderusdt','chiliz':'chzusdt',
}

export const CHAIN_COLORS = {
  ethereum:'#627EEA', polygon:'#8247E5', arbitrum:'#28A0F0',
  optimism:'#FF0420', base:'#0052FF',    avalanche:'#E84142',
  bsc:'#F3BA2F',      solana:'#9945FF',  fantom:'#1969FF',
  gnosis:'#04795B',   zksync:'#8B8DFC',  linea:'#61DFFF',
}
export const CHAIN_NAMES = {
  ethereum:'ETH', polygon:'MATIC', arbitrum:'ARB', optimism:'OP',
  base:'BASE', avalanche:'AVAX', bsc:'BSC', solana:'SOL',
  fantom:'FTM', gnosis:'GNO', zksync:'zkSync', linea:'Linea',
}

// ── usePrices — carga parcial inmediata + WS Binance ─────────
export function usePrices() {
  const [prices,   setPrices]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [wsStatus, setWsStatus] = useState('connecting')
  const wsRef = useRef(null), pricesRef = useRef([])

  const loadBase = useCallback(async () => {
    try {
      // onPartial → actualiza UI tan pronto llegan páginas 1+2
      await fetchCoinGeckoPrices(partial => {
        if (partial.length) {
          pricesRef.current = partial
          setPrices([...partial])
          setLoading(false)
        }
      })
    } catch { setLoading(false) }
  }, [])

  const connectWS = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    const streams = Object.values(CG_TO_BINANCE).map(s=>`${s}@ticker`).join('/')
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
          c.id===cgId ? {...c, current_price:parseFloat(p.c), price_change_percentage_24h:parseFloat(p.P)} : c
        )
        setPrices([...pricesRef.current])
      } catch {}
    }
  }, [])

  useEffect(() => {
    loadBase().then(connectWS)
    const iv = setInterval(loadBase, 300000)
    return () => { clearInterval(iv); wsRef.current?.close() }
  }, [loadBase, connectWS])

  return { prices, loading, wsStatus }
}

export function useGlobalSearch(query, localPrices) {
  const [results, setResults]   = useState([])
  const [searching,setSearching]= useState(false)
  const timerRef=useRef(null), localRef=useRef(localPrices)
  useEffect(()=>{ localRef.current=localPrices },[localPrices])
  useEffect(()=>{
    if (!query||query.trim().length<2) { setResults([]); setSearching(false); return }
    const local=localRef.current.filter(p=>
      p.name.toLowerCase().includes(query.toLowerCase())||
      p.symbol.toLowerCase().includes(query.toLowerCase())
    )
    setResults(local); setSearching(true)
    clearTimeout(timerRef.current)
    timerRef.current=setTimeout(async()=>{
      try {
        const found=await searchCoins(query)
        const ids=new Set(localRef.current.map(p=>p.id))
        const newIds=found.filter(c=>!ids.has(c.id)).map(c=>c.id)
        const extra=newIds.length?await fetchCoinsByIds(newIds):[]
        setResults([...local,...extra])
      } catch { setResults(local) }
      finally { setSearching(false) }
    },600)
    return ()=>clearTimeout(timerRef.current)
  },[query])
  return { results, searching }
}

export function useGlobalStats() {
  const [stats,setStats]=useState(null)
  useEffect(()=>{ fetchGlobalStats().then(d=>setStats(d.data)).catch(()=>{}) },[])
  return { stats }
}

export function useFearGreed() {
  const [fearGreed,setFearGreed]=useState(null)
  useEffect(()=>{
    fetchFearGreed().then(setFearGreed).catch(()=>{})
    const iv=setInterval(()=>fetchFearGreed().then(setFearGreed).catch(()=>{}),3600000)
    return ()=>clearInterval(iv)
  },[])
  return { fearGreed }
}

export function useOHLC(coinId, days=7) {
  const [candles,setCandles]=useState([])
  const [loading,setLoading]=useState(false)
  useEffect(()=>{
    if (!coinId) { setCandles([]); return }
    setLoading(true)
    fetchOHLC(coinId,days)
      .then(raw=>setCandles(raw.map(([ts,o,h,l,c])=>({
        ts,open:o,high:h,low:l,close:c,
        date:new Date(ts).toLocaleDateString('es-CO',{month:'short',day:'numeric'})
      }))))
      .catch(()=>setCandles([]))
      .finally(()=>setLoading(false))
  },[coinId,days])
  return { candles, loading }
}

// ── useAnalysis — carga historia + BTC + precio en paralelo ──
// Antes: 3 llamadas secuenciales = 6-9s
// Ahora: todo en Promise.all = ~2.5s (limitado por la más lenta)
export function useAnalysis(coinId) {
  const [signal,   setSignal]   = useState(null)
  const [coinData, setCoinData] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(()=>{
    if (!coinId) { setSignal(null); setCoinData(null); return }
    setLoading(true); setError(null)

    const run = async () => {
      try {
        // TODO en paralelo — fetchPriceHistory ya carga BTC internamente en paralelo
        const [{ coin:history, btc:btcHistory }, coinArr] = await Promise.all([
          fetchPriceHistory(coinId, 90),
          fetchCoinsByIds([coinId]),
        ])
        const prices    = history.prices.map(([,p])=>p)
        const volumes   = history.total_volumes?.map(([,v])=>v)||null
        const btcPrices = btcHistory?.prices?.map(([,p])=>p)||null

        // generateSignal ahora recibe btcPrices para correlación y ATR
        setSignal(generateSignal(prices, volumes, btcPrices))
        if (coinArr?.length) setCoinData(coinArr[0])
      } catch(e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    run()
  },[coinId])

  return { signal, coinData, loading, error }
}

export function useWatchlist() {
  const [watchlist,  setWatchlist]  = useState(()=>{ try { return JSON.parse(localStorage.getItem('defi_wl_v5')||'[]') } catch { return [] } })
  const [extraCoins, setExtraCoins] = useState(()=>{ try { return JSON.parse(localStorage.getItem('defi_extra_v5')||'[]') } catch { return [] } })
  const saveWL    = l => { setWatchlist(l);  try { localStorage.setItem('defi_wl_v5',JSON.stringify(l)) } catch {} }
  const saveExtra = c => { setExtraCoins(c); try { localStorage.setItem('defi_extra_v5',JSON.stringify(c)) } catch {} }
  const add    = (id,data) => { if (!watchlist.includes(id)) saveWL([...watchlist,id]); if (data&&!extraCoins.find(c=>c.id===id)) saveExtra([...extraCoins,data]) }
  const remove = id => { saveWL(watchlist.filter(w=>w!==id)); saveExtra(extraCoins.filter(c=>c.id!==id)) }
  const toggle = (id,data) => watchlist.includes(id)?remove(id):add(id,data)
  const clear  = () => { saveWL([]); saveExtra([]) }
  return { watchlist, extraCoins, toggle, clear }
}

function parsePortfolio(raw) {
  const attr=raw?.data?.attributes; if (!attr) return null
  return {
    totalValue:attr.total?.value??attr.total_usd_value??0,
    pnl24h:attr.changes?.percent_1d??null,
    pnlAbs24h:attr.changes?.absolute_1d?.value??null,
  }
}

function parsePositions(raw) {
  return (raw?.data||[]).map(pos=>{
    const a=pos.attributes, tk=a?.fungible_info
    const qty=a?.quantity?.float??0, price=a?.price??0
    return {
      id:pos.id, symbol:tk?.symbol||'?', name:tk?.name||'',
      icon:tk?.icon?.url||null,
      chain:pos.relationships?.chain?.data?.id??a?.chain??'ethereum',
      qty, price, value:a?.value??(qty*price),
      pct1d:a?.changes?.percent_1d??null,
    }
  }).filter(p=>p.value>0.01).sort((a,b)=>b.value-a.value)
}

function parseTransactions(raw) {
  return (raw?.data||[]).map(tx=>{
    const a=tx.attributes
    return {
      id:tx.id, type:a?.operation_type||'transfer', status:a?.status||'confirmed',
      chain:tx.relationships?.chain?.data?.id??a?.chain??'ethereum',
      time:a?.mined_at||a?.sent_at||null,
      value:a?.transfers?.reduce((s,t)=>s+(t.value??0),0)??0,
      fee:a?.fee?.value??null,
    }
  })
}

export function useWallet(address) {
  const [portfolio,    setPortfolio]    = useState(null)
  const [positions,    setPositions]    = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)

  const load = useCallback(async addr=>{
    if (!addr||!addr.startsWith('0x')) return
    setLoading(true); setError(null)
    try {
      const [portRaw,posRaw,txRaw] = await Promise.all([
        fetchZerionPortfolio(addr),
        fetchZerionPositions(addr),
        fetchZerionTransactions(addr),
      ])
      const parsedPos=parsePositions(posRaw)
      const parsedPort=parsePortfolio(portRaw)
      if (parsedPort&&!parsedPort.totalValue)
        parsedPort.totalValue=parsedPos.reduce((s,p)=>s+p.value,0)
      setPortfolio(parsedPort); setPositions(parsedPos); setTransactions(parseTransactions(txRaw))
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  },[])

  useEffect(()=>{
    if (!address) return
    load(address)
    const iv=setInterval(()=>load(address),120000)
    return ()=>clearInterval(iv)
  },[address,load])

  return { portfolio, positions, transactions, loading, error, refresh:()=>load(address) }
}