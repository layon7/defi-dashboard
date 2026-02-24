import { useState, useEffect } from 'react'
import { usePrices, useGlobalStats, useEthHistory, useWatchlist, useWallet } from './hooks/useDefiData.js'

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`
  if (n >= 1e3)  return `$${(n/1e3).toFixed(1)}K`
  return `$${Number(n).toFixed(2)}`
}
function pct(n) {
  if (n == null) return '—'
  const v = Math.abs(Number(n)).toFixed(2)
  return n >= 0 ? `▲ ${v}%` : `▼ ${v}%`
}

const G = '#FF8C00', G2 = '#FFA733', R = '#FF4D4D', GOLD = '#FFCC00'
const DIM = 'rgba(255,255,255,0.60)', WHITE = '#FFFFFF', BG = '#0D0D0D'

function Dot({ color = G, size = 9 }) {
  return (
    <span style={{ position:'relative', display:'inline-flex', width:size, height:size }}>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:color, opacity:0.4, animation:'ping 1.5s ease infinite' }}/>
      <span style={{ borderRadius:'50%', width:size, height:size, background:color, display:'block' }}/>
    </span>
  )
}

function Card({ children, accent, style = {} }) {
  return (
    <div style={{ background: accent ? 'rgba(255,140,0,0.08)' : 'rgba(255,255,255,0.03)', border:`1px solid ${accent ? 'rgba(255,140,0,0.45)' : 'rgba(255,140,0,0.15)'}`, borderRadius:10, padding:22, ...style }}>
      {children}
    </div>
  )
}

function CT({ children }) {
  return <div style={{ fontSize:11, letterSpacing:'0.2em', color:'rgba(255,140,0,0.7)', marginBottom:18, fontWeight:700 }}>{children}</div>
}

function Badge({ label, color = G }) {
  return <span style={{ fontSize:11, fontWeight:700, color, border:`1px solid ${color}44`, background:`${color}15`, padding:'3px 10px', borderRadius:4, letterSpacing:'0.08em' }}>{label}</span>
}

function WsIndicator({ status }) {
  const map = { live:{ color:G, label:'LIVE · BINANCE WS' }, connecting:{ color:GOLD, label:'CONECTANDO…' }, error:{ color:R, label:'WS ERROR' } }
  const { color, label } = map[status] || map.connecting
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
      <Dot color={color} />
      <span style={{ fontSize:11, color, fontWeight:700, letterSpacing:'0.08em' }}>{label}</span>
    </div>
  )
}

function SparkBar({ data }) {
  if (!data.length) return <div style={{ height:64, display:'flex', alignItems:'center', justifyContent:'center', color:DIM, fontSize:13 }}>Cargando…</div>
  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:64 }}>
      {data.map((d, i) => {
        const h = ((d.value - min) / (max - min || 1)) * 50 + 8
        const last = i === data.length - 1
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div title={`$${d.value.toFixed(0)}`} style={{ width:'100%', height:h, borderRadius:'4px 4px 0 0', background: last ? `linear-gradient(180deg,${G},${G2})` : 'rgba(255,140,0,0.22)', transition:'height 0.6s' }}/>
            <span style={{ fontSize:10, color:'rgba(255,140,0,0.45)' }}>{d.day}</span>
          </div>
        )
      })}
    </div>
  )
}

const thS = { fontSize:11, letterSpacing:'0.12em', color:'rgba(255,140,0,0.55)', fontWeight:700, fontFamily:'inherit', paddingBottom:12, borderBottom:'1px solid rgba(255,140,0,0.12)' }
const tdS = (right, color, bold) => ({ fontSize:13, padding:'11px 0', borderBottom:'1px solid rgba(255,140,0,0.07)', textAlign: right?'right':'left', color: color||WHITE, fontWeight: bold?700:400 })

// ── OVERVIEW ──────────────────────────────────────────────────
function OverviewTab({ prices, stats, history, wsStatus }) {
  const eth = prices.find(p => p.id === 'ethereum')
  const kpis = [
    { label:'MARKET CAP CRIPTO', value: fmt(stats?.total_market_cap?.usd), sub: stats ? `BTC dom. ${stats.market_cap_percentage?.btc?.toFixed(1)}%` : 'Cargando…', accent:true },
    { label:'VOLUMEN 24H',       value: fmt(stats?.total_volume?.usd), sub:'Mercado global' },
    { label:'ETH PRECIO',        value: eth ? `$${(eth.current_price ?? 0).toLocaleString()}` : '…', sub: eth ? pct(eth.price_change_percentage_24h) : '…' },
    { label:'ACTIVOS RASTREADOS',value: stats?.active_cryptocurrencies?.toLocaleString() || '…', sub:'CoinGecko live' },
  ]
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:22 }}>
        {kpis.map((k,i) => (
          <Card key={i} accent={k.accent}>
            <div style={{ fontSize:11, letterSpacing:'0.15em', color:'rgba(255,140,0,0.6)', marginBottom:10 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:G, lineHeight:1, marginBottom:8 }}>{k.value}</div>
            <div style={{ fontSize:13, color:DIM }}>{k.sub}</div>
          </Card>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:16 }}>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <CT>ETH · PRECIO 7 DÍAS</CT>
            <WsIndicator status={wsStatus} />
          </div>
          <SparkBar data={history} />
          {history.length > 1 && (
            <div style={{ marginTop:14, display:'flex', gap:28 }}>
              {[['INICIO',`$${history[0]?.value.toFixed(0)}`],['ACTUAL',`$${history[history.length-1]?.value.toFixed(0)}`],['VARIACIÓN',pct(((history[history.length-1]?.value - history[0]?.value) / history[0]?.value) * 100)]].map(([l,v],i) => (
                <div key={i}>
                  <div style={{ fontSize:10, color:'rgba(255,140,0,0.5)', marginBottom:4 }}>{l}</div>
                  <div style={{ fontSize:15, color:G, fontWeight:700 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CT>TOP MOVERS 24H</CT>
          {prices.slice(0,7).map((p,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <img src={p.image} alt={p.symbol} style={{ width:22, height:22, borderRadius:'50%' }} onError={e => e.target.style.display='none'}/>
                <span style={{ fontSize:13, fontWeight:700, color:WHITE }}>{p.symbol.toUpperCase()}</span>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color: p.price_change_percentage_24h >= 0 ? G : R }}>{pct(p.price_change_percentage_24h)}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}

// ── PRECIOS ──────────────────────────────────────────────────
function PricesTab({ prices, loading, lastUpdate, wsStatus, watchlist, onToggle }) {
  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <CT>PRECIOS · BINANCE WEBSOCKET TIEMPO REAL</CT>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <WsIndicator status={wsStatus} />
          {lastUpdate && <span style={{ fontSize:11, color:DIM }}>{lastUpdate.toLocaleTimeString('es-CO')}</span>}
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:DIM, fontSize:14 }}>Conectando a Binance WebSocket…</div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {['#','TOKEN','PRECIO USD','24H','MARKET CAP','VOL 24H','★'].map((h,i) => (
                <th key={i} style={{ ...thS, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prices.map((p,i) => {
              const chg = p.price_change_percentage_24h
              return (
                <tr key={p.id}>
                  <td style={tdS(false,DIM)}>{i+1}</td>
                  <td style={tdS()}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <img src={p.image} alt={p.symbol} style={{ width:24, height:24, borderRadius:'50%' }} onError={e => e.target.style.display='none'}/>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:WHITE }}>{p.symbol.toUpperCase()}</div>
                        <div style={{ fontSize:11, color:DIM }}>{p.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdS(true,WHITE,true)}>${(p.current_price ?? 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</td>
                  <td style={tdS(true, chg >= 0 ? G : R, true)}>{pct(chg)}</td>
                  <td style={tdS(true,DIM)}>{fmt(p.market_cap)}</td>
                  <td style={tdS(true,DIM)}>{fmt(p.total_volume)}</td>
                  <td style={{ ...tdS(true), cursor:'pointer' }}>
                    <button onClick={() => onToggle(p.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, filter: watchlist.includes(p.id) ? 'none' : 'grayscale(1) opacity(0.35)' }}>
                      {watchlist.includes(p.id) ? '★' : '☆'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// ── WATCHLIST ─────────────────────────────────────────────────
function WatchlistTab({ prices, watchlist, onToggle, wsStatus }) {
  const watched = prices.filter(p => watchlist.includes(p.id))
  const avgChange = watched.length ? watched.reduce((s,p) => s + (p.price_change_percentage_24h ?? 0), 0) / watched.length : 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        <Card accent>
          <div style={{ fontSize:11, color:'rgba(255,140,0,0.6)', marginBottom:8, letterSpacing:'0.15em' }}>MONEDAS SEGUIDAS</div>
          <div style={{ fontSize:28, fontWeight:700, color:G }}>{watched.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize:11, color:'rgba(255,140,0,0.6)', marginBottom:8, letterSpacing:'0.15em' }}>CAMBIO PROMEDIO 24H</div>
          <div style={{ fontSize:28, fontWeight:700, color: avgChange >= 0 ? G : R }}>{pct(avgChange)}</div>
        </Card>
        <Card>
          <div style={{ fontSize:11, color:'rgba(255,140,0,0.6)', marginBottom:8, letterSpacing:'0.15em' }}>FEED</div>
          <div style={{ marginTop:6 }}><WsIndicator status={wsStatus} /></div>
        </Card>
      </div>

      {watched.length === 0 ? (
        <Card>
          <div style={{ textAlign:'center', padding:56, color:DIM }}>
            <div style={{ fontSize:48, marginBottom:16 }}>☆</div>
            <div style={{ fontSize:15, marginBottom:10, color:WHITE }}>Tu watchlist está vacía</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>Ve a PRECIOS y pulsa ★ en las monedas que quieras seguir</div>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {watched.map(p => {
              const chg = p.price_change_percentage_24h ?? 0
              return (
                <div key={p.id} style={{ background:'rgba(255,140,0,0.04)', border:`1px solid ${chg >= 0 ? 'rgba(255,140,0,0.2)' : 'rgba(255,77,77,0.2)'}`, borderRadius:8, padding:18, position:'relative' }}>
                  <button onClick={() => onToggle(p.id)} style={{ position:'absolute', top:12, right:14, background:'none', border:'none', cursor:'pointer', fontSize:18, color:G }}>★</button>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <img src={p.image} alt={p.symbol} style={{ width:30, height:30, borderRadius:'50%' }} onError={e => e.target.style.display='none'}/>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:WHITE }}>{p.symbol.toUpperCase()}</div>
                      <div style={{ fontSize:11, color:DIM }}>{p.name}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:24, fontWeight:700, color:WHITE, marginBottom:6, fontVariantNumeric:'tabular-nums' }}>
                    ${(p.current_price ?? 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color: chg >= 0 ? G : R }}>{pct(chg)}</div>
                  <div style={{ marginTop:10, fontSize:11, color:DIM }}>Vol 24h: {fmt(p.total_volume)}</div>
                </div>
              )
            })}
          </div>
          <Card>
            <CT>TABLA RESUMEN · WATCHLIST</CT>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['TOKEN','PRECIO','24H','MARKET CAP','VOL 24H','QUITAR'].map((h,i) => (
                  <th key={i} style={{ ...thS, textAlign: i > 0 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {watched.map(p => {
                  const chg = p.price_change_percentage_24h ?? 0
                  return (
                    <tr key={p.id}>
                      <td style={tdS()}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <img src={p.image} alt={p.symbol} style={{ width:20, height:20, borderRadius:'50%' }} onError={e => e.target.style.display='none'}/>
                          <span style={{ fontWeight:700 }}>{p.symbol.toUpperCase()}</span>
                        </div>
                      </td>
                      <td style={tdS(true,WHITE,true)}>${(p.current_price ?? 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                      <td style={tdS(true, chg >= 0 ? G : R, true)}>{pct(chg)}</td>
                      <td style={tdS(true,DIM)}>{fmt(p.market_cap)}</td>
                      <td style={tdS(true,DIM)}>{fmt(p.total_volume)}</td>
                      <td style={tdS(true)}>
                        <button onClick={() => onToggle(p.id)} style={{ background:'rgba(255,77,77,0.1)', border:'1px solid rgba(255,77,77,0.3)', borderRadius:4, color:R, cursor:'pointer', fontSize:11, padding:'4px 12px', fontFamily:'inherit' }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}

// ── WALLET ───────────────────────────────────────────────────
function WalletTab() {
  const [input, setInput]       = useState('')
  const [activeAddr, setActive] = useState('')
  const debankKey = import.meta.env.VITE_DEBANK_API_KEY
  const { portfolio, tokens, protocols, loading, error, refresh } = useWallet(activeAddr)
  const totalVal = tokens.reduce((s,t) => s + t.amount * t.price, 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {!debankKey && (
        <div style={{ padding:18, background:'rgba(255,204,0,0.06)', border:'1px solid rgba(255,204,0,0.3)', borderRadius:8 }}>
          <div style={{ fontSize:13, color:GOLD, fontWeight:700, marginBottom:8 }}>⚠ DEBANK API KEY REQUERIDA</div>
          <div style={{ fontSize:12, color:DIM, lineHeight:1.9 }}>
            1. Regístrate gratis en <span style={{ color:G }}>cloud.debank.com</span><br/>
            2. Ve a API Keys → crea una key gratuita<br/>
            3. En Vercel → Settings → Environment Variables:<br/>
            <code style={{ color:G }}>VITE_DEBANK_API_KEY = tu_key_aqui</code><br/>
            4. Redeploy → listo
          </div>
        </div>
      )}
      <Card>
        <CT>ANALIZAR WALLET · DeBank</CT>
        <div style={{ fontSize:12, color:DIM, marginBottom:14, lineHeight:1.7 }}>Solo lectura pública — no necesitas MetaMask ni firmar nada. Auto-refresh cada 2 minutos.</div>
        <div style={{ display:'flex', gap:12 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && setActive(input.trim())} placeholder="0x... dirección Ethereum" style={{ flex:1, background:'rgba(255,140,0,0.05)', border:'1px solid rgba(255,140,0,0.25)', borderRadius:7, padding:'12px 16px', color:WHITE, fontFamily:'inherit', fontSize:13, outline:'none' }}/>
          <button onClick={() => setActive(input.trim())} disabled={loading} style={{ padding:'12px 28px', background: loading ? 'rgba(255,140,0,0.06)' : 'rgba(255,140,0,0.15)', border:'1px solid rgba(255,140,0,0.4)', borderRadius:7, color:G, cursor: loading?'wait':'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700, letterSpacing:'0.08em' }}>
            {loading ? 'CARGANDO…' : 'ANALIZAR'}
          </button>
          {activeAddr && <button onClick={refresh} style={{ padding:'12px 18px', background:'transparent', border:'1px solid rgba(255,140,0,0.2)', borderRadius:7, color:'rgba(255,140,0,0.6)', cursor:'pointer', fontFamily:'inherit', fontSize:16 }}>↻</button>}
        </div>
        {error && <div style={{ marginTop:10, fontSize:12, color:R }}>Error: {error}</div>}
      </Card>

      {portfolio && (
        <Card accent>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
            <div>
              <div style={{ fontSize:11, color:'rgba(255,140,0,0.55)', marginBottom:5, letterSpacing:'0.15em' }}>WALLET</div>
              <div style={{ fontSize:13, color:G }}>{activeAddr.slice(0,10)}…{activeAddr.slice(-8)}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'rgba(255,140,0,0.55)', marginBottom:5, letterSpacing:'0.15em' }}>VALOR TOTAL</div>
              <div style={{ fontSize:32, color:G, fontWeight:700 }}>{fmt(portfolio.total_usd_value)}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><Dot/><span style={{ fontSize:12, color:'rgba(255,140,0,0.7)' }}>DEBANK LIVE</span></div>
              <div style={{ fontSize:11, color:DIM }}>Auto-refresh: 2 min</div>
            </div>
          </div>
        </Card>
      )}

      {tokens.length > 0 && (
        <Card>
          <CT>TOKENS EN WALLET</CT>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['TOKEN','CHAIN','CANTIDAD','PRECIO','VALOR USD','% WALLET'].map((h,i) => (
                <th key={i} style={{ ...thS, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {tokens.filter(t => t.amount * t.price > 1).sort((a,b) => b.amount*b.price - a.amount*a.price).map((t,i) => {
                const val = t.amount * t.price
                return (
                  <tr key={i}>
                    <td style={tdS()}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {t.logo_url && <img src={t.logo_url} alt={t.symbol} style={{ width:22, height:22, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>}
                        <span style={{ fontWeight:700, fontSize:14 }}>{t.symbol}</span>
                      </div>
                    </td>
                    <td style={tdS()}><Badge label={t.chain?.toUpperCase()||'ETH'}/></td>
                    <td style={tdS(true,DIM)}>{t.amount < 0.001 ? t.amount.toExponential(2) : t.amount.toFixed(4)}</td>
                    <td style={tdS(true,DIM)}>${t.price.toFixed(4)}</td>
                    <td style={tdS(true,G,true)}>{fmt(val)}</td>
                    <td style={tdS(true,DIM)}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8 }}>
                        <div style={{ width:50, height:4, background:'rgba(255,255,255,0.08)', borderRadius:2 }}>
                          <div style={{ width:`${Math.min((val/totalVal)*100,100)}%`, height:'100%', background:G, borderRadius:2 }}/>
                        </div>
                        {((val/totalVal)*100).toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {protocols.length > 0 && (
        <Card>
          <CT>POSICIONES EN PROTOCOLOS DeFi</CT>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['PROTOCOLO','CHAIN','VALOR USD'].map((h,i) => (
                <th key={i} style={{ ...thS, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {protocols.sort((a,b) => (b.portfolio_item_list?.reduce((s,x)=>s+(x.stats?.net_usd_value||0),0)||0)-(a.portfolio_item_list?.reduce((s,x)=>s+(x.stats?.net_usd_value||0),0)||0)).map((proto,i) => {
                const val = proto.portfolio_item_list?.reduce((s,x)=>s+(x.stats?.net_usd_value||0),0)||0
                return (
                  <tr key={i}>
                    <td style={tdS()}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {proto.logo_url && <img src={proto.logo_url} alt={proto.name} style={{ width:22, height:22, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>}
                        <span style={{ fontWeight:700, fontSize:14 }}>{proto.name}</span>
                      </div>
                    </td>
                    <td style={tdS()}><Badge label={proto.chain?.toUpperCase()||'ETH'}/></td>
                    <td style={tdS(true,G,true)}>{fmt(val)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

// ── APP ──────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]   = useState('overview')
  const [time, setTime] = useState(new Date())

  const { prices, loading, lastUpdate, wsStatus, refresh } = usePrices()
  const { stats }   = useGlobalStats()
  const { history } = useEthHistory()
  const { watchlist, toggle } = useWatchlist()

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const TABS = [
    { id:'overview',  label:'OVERVIEW'        },
    { id:'prices',    label:'PRECIOS'         },
    { id:'watchlist', label:'★ WATCHLIST'     },
    { id:'wallet',    label:'WALLET · DEBANK' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { background:${BG}; }
        @keyframes ping { 75%,100%{ transform:scale(2); opacity:0; } }
        tr:hover td { background:rgba(255,140,0,0.025); }
        input::placeholder { color:rgba(255,255,255,0.2); }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:${BG}; }
        ::-webkit-scrollbar-thumb { background:rgba(255,140,0,0.25); border-radius:4px; }
        button:hover { opacity:0.82; transition:opacity 0.15s; }
      `}</style>

      <div style={{ minHeight:'100vh', background:BG, fontFamily:"'IBM Plex Mono',monospace", color:WHITE, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(255,140,0,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,140,0,0.025) 1px,transparent 1px)', backgroundSize:'40px 40px' }}/>
        <div style={{ position:'fixed', top:'-200px', left:'50%', transform:'translateX(-50%)', width:'800px', height:'400px', borderRadius:'50%', pointerEvents:'none', zIndex:0, background:'radial-gradient(ellipse,rgba(255,140,0,0.07) 0%,transparent 70%)' }}/>

        <div style={{ position:'relative', zIndex:1, maxWidth:1300, margin:'0 auto', padding:'0 24px 56px' }}>
          <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 0 28px', borderBottom:'1px solid rgba(255,140,0,0.15)', marginBottom:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:42, height:42, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:BG, background:`linear-gradient(135deg,${G},#E67A00)` }}>₿</div>
              <div>
                <div style={{ fontSize:17, fontWeight:700, letterSpacing:'0.15em', color:G }}>DEFI PULSE</div>
                <div style={{ fontSize:10, color:'rgba(255,140,0,0.5)', letterSpacing:'0.2em' }}>DASHBOARD v3.0 · CEREBRO DeFi</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:24 }}>
              <WsIndicator status={wsStatus} />
              <div style={{ fontSize:13, color:'rgba(255,140,0,0.6)', letterSpacing:'0.1em' }}>{time.toLocaleTimeString('es-CO')}</div>
            </div>
          </header>

          <div style={{ display:'flex', gap:5, marginBottom:26 }}>
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'10px 22px', fontSize:12, letterSpacing:'0.12em', fontWeight:active?700:400, fontFamily:'inherit', background:active?'rgba(255,140,0,0.15)':'transparent', color:active?G:'rgba(255,140,0,0.4)', border:`1px solid ${active?'rgba(255,140,0,0.45)':'rgba(255,140,0,0.12)'}`, borderRadius:5, cursor:'pointer', transition:'all 0.2s' }}>
                  {t.label}
                </button>
              )
            })}
          </div>

          {tab === 'overview'  && <OverviewTab  prices={prices} stats={stats} history={history} wsStatus={wsStatus} />}
          {tab === 'prices'    && <PricesTab    prices={prices} loading={loading} lastUpdate={lastUpdate} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle} />}
          {tab === 'watchlist' && <WatchlistTab prices={prices} watchlist={watchlist} onToggle={toggle} wsStatus={wsStatus} />}
          {tab === 'wallet'    && <WalletTab />}
        </div>
      </div>
    </>
  )
}
