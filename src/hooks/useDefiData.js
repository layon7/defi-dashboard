import { useState, useEffect, useCallback } from 'react'
import { fetchCoinGeckoPrices, fetchGlobalStats, fetchCoinHistory, fetchWalletPortfolio, fetchWalletTokens, fetchWalletProtocols } from '../services/api.js'

export function usePrices() {
  const [prices, setPrices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const load = useCallback(async () => {
    try {
      const data = await fetchCoinGeckoPrices()
      setPrices(data); setLastUpdate(new Date()); setError(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i) }, [load])
  return { prices, loading, error, lastUpdate, refresh: load }
}

export function useGlobalStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetchGlobalStats().then(d => setStats(d.data)).catch(() => setStats(null)).finally(() => setLoading(false))
  }, [])
  return { stats, loading }
}

export function useEthHistory() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetchCoinHistory('ethereum', 7).then(d => {
      const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Hoy']
      setHistory(d.prices.slice(-7).map((p, i) => ({ day: days[i] || `D${i+1}`, value: p[1], ts: p[0] })))
    }).catch(() => setHistory([])).finally(() => setLoading(false))
  }, [])
  return { history, loading }
}

export function useWallet(address) {
  const [portfolio, setPortfolio] = useState(null)
  const [tokens, setTokens] = useState([])
  const [protocols, setProtocols] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const load = useCallback(async (addr) => {
    if (!addr || !addr.startsWith('0x')) return
    setLoading(true); setError(null)
    try {
      const [port, toks, protos] = await Promise.all([fetchWalletPortfolio(addr), fetchWalletTokens(addr), fetchWalletProtocols(addr)])
      setPortfolio(port); setTokens(toks || []); setProtocols(protos || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (address) load(address) }, [address, load])
  return { portfolio, tokens, protocols, loading, error, refresh: () => load(address) }
}