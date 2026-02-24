import { useState, useEffect } from 'react'
import { usePrices, useGlobalStats, useEthHistory, useWallet } from './hooks/useDefiData.js'

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

const G    = '#FF8C00'   // naranja principal
const G2   = '#FFA733'   // naranja claro
const R    = '#FF4D4D'   // rojo
const GOLD = '#FFCC00'   // amarillo
const DIM  = 'rgba(255,255,255,0.65)'
const WHITE = '#FFFFFF'
const BG   = '#0D0D0D'

function Dot({ color = G }) {
  return (
    <span style={{ position:'relative', display:'inline-flex', width:9, height:9 }}>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:color, opacity:0.4, animation:'ping 1.5s ease infinite' }}/>
      <span style={{ borderRadius:'50%', width:9, height:9, background:color, display:'block' }}/>
    </span>
  )
}

function Card({ children, accent, style = {} }) {
  return (
    <div style={{
      background: accent ? 'rgba(255,140,0,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${accent ? 'rgba(255,140,0,0.45)' : 'rgba(255,140,0,0.15)'}`,
      borderRadius:10, padding:22, ...style,
    }}>{children}</div>
  )
}

function CT({ children }) {
  return (
    <div style={{ fontSize:11, letterSpacing:'0.2em', color:'rgba(255,140,0,0.7)',
      marginBottom:18, fontWeight:700 }}>{children}
    </div>
  )
}

function Badge({ label, color = G }) {
  return (
    <span style={{ fontSize:11, fontWeight:700, color,
      border:`1px solid ${color}44`, background:`${color}15`,
      padding:'3px 10px', borderRadius:4, letterSpacing:'0.08em' }}>{label}
    </span>
  )
}

function SparkBar({ data }) {
  if (!data.length) return (
    <div style={{ height:60, display:'flex', alignItems:'center',
      justifyContent:'center', color:DIM, fontSize:13 }}>Cargando datos…</div>
  )
  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:64 }}>
      {data.map((d, i) => {
        const h = ((d.value - min) / (max - min || 1)) * 50 + 8
        const last = i === data.length - 1
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div title={`$${d.value.toFixed(0)}`} style={{
              width:'100%', height:h, borderRadius:'4px 4px 0 0',
              background: last ? `linear-gradient(180deg,${G},${G2})` : 'rgba(255,140,0,0.25)',
              transition:'height 0.6s',
            }}/>
            <span style={{ fontSize:10, color:'rgba(255,140,0,0.5)' }}>{d.day}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── TAB OVERVIEW ──────────────────────────────────────────────────────────
function OverviewTab({ prices, stats, history }) {
  const eth = prices.find(p => p.id === 'ethereum')
  const kpis = [
    { label:'MARKET CAP CRIPTO',  value: fmt(stats?.total_market_cap?.usd), sub: stats ? `BTC dom. ${stats.market_cap_percentage?.btc?.toFixed(1)}%` : 'Cargando…', accent:true },
    { label:'VOLUMEN 24H',        value: fmt(stats?.total_volume?.usd),      sub:'Mercado global' },
    { label:'ETH PRECIO',         value: eth ? `$${(eth.current_price ?? 0).toLocaleString()}` : '…', sub: eth ? pct(eth.price_change_percentage_24h) : '…' },
    { label:'ACTIVOS RASTREADOS', value: stats?.active_cryptocurrencies?.toLocaleString() || '…', sub:'CoinGecko live' },
  ]
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:22 }}>
        {kpis.map((k, i) => (
          <Card key={i} accent={k.accent}>
            <div style={{ fontSize:11, letterSpacing:'0.15em', color:'rgba(255,140,0,0.6)', marginBottom:10 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:G, lineHeight:1, marginBottom:8 }}>{k.value}</div>
            <div style={{ fontSize:13, color:DIM }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:16 }}>
        <Card>
          <CT>ETH · PRECIO 7 DÍAS — CoinGecko LIVE</CT>
          <SparkBar data={history} />
          {history.length > 1 && (
            <div style={{ marginTop:14, display:'flex', gap:28 }}>
              {[
                ['INICIO',    `$${history[0]?.value.toFixed(0)}`],
                ['ACTUAL',    `$${history[history.length-1]?.value.toFixed(0)}`],
                ['VARIACIÓN', pct(((history[history.length-1]?.value - history[0]?.value) / history[0]?.value) * 100)],
              ].map(([l, v], i) => (
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
          {prices.slice(0, 7).map((p, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <img src={p.image} alt={p.symbol}
                  style={{ width:22, height:22, borderRadius:'50%' }}
                  onError={e => e.target.style.display='none'}/>
                <span style={{ fontSize:13, fontWeight:700, color:WHITE }}>{p.symbol.toUpperCase()}</span>
              </div>
              <span style={{ fontSize:13, fontWeight:700,
                color: p.price_change_percentage_24h >= 0 ? G : R }}>
                {pct(p.price_change_percentage_24h)}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}

// ── TAB PRECIOS ───────────────────────────────────────────────────────────
function PricesTab({ prices, loading, lastUpdate, refresh }) {
  const thS = {
    fontSize:11, letterSpacing:'0.12em', color:'rgba(255,140,0,0.55)',
    fontWeight:700, fontFamily:'inherit', paddingBottom:12,
    borderBottom:'1px solid rgba(255,140,0,0.12)',
  }
  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <CT>PRECIOS EN TIEMPO REAL · CoinGecko</CT>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {lastUpdate && (
            <span style={{ fontSize:11, color:DIM }}>
              Actualizado: {lastUpdate.toLocaleTimeString('es-CO')}
            </span>
          )}
          <button onClick={refresh} style={{
            fontSize:11, padding:'6px 16px',
            background:'rgba(255,140,0,0.1)', border:'1px solid rgba(255,140,0,0.35)',
            borderRadius:5, color:G, cursor:'pointer',
            fontFamily:'inherit', letterSpacing:'0.08em', fontWeight:700,
          }}>↻ REFRESH</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:DIM, fontSize:14 }}>
          Cargando desde CoinGecko…
        </div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {['#','TOKEN','PRECIO USD','24H','MARKET CAP','VOL 24H'].map((h, i) => (
                <th key={i} style={{ ...thS, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prices.map((p, i) => {
              const chg = p.price_change_percentage_24h
              return (
                <tr key={p.id}>
                  <td style={{ fontSize:13, padding:'12px 0', borderBottom:'1px solid rgba(255,140,0,0.07)', color:DIM }}>{i+1}</td>
                  <td style={{ fontSize:13, padding:'12px 0', borderBottom:'1px solid rgba(255,140,0,0.07)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <img src={p.image} alt={p.symbol}
                        style={{ width:24, height:24, borderRadius:'50%' }}
                        onError={e => e.target.style.display='none'}/>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:WHITE }}>{p.symbol.toUpperCase()}</div>
                        <div style={{ fontSize:11, color:DIM }}>{p.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize:14, padding:'12px 0', borderBottom:'1px solid rgba(255,140,0,0.07)', textAlign:'right', fontWeight:700, color:WHITE }}>
                    ${(p.current_price ?? 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:6 })}
                  </td>
                  <td style={{ fontSize:14, padding:'12px 0', borderBottom:'1px solid rgba(255,140,0,0.07)', textAlign:'right', fontWeight:700, color: chg >= 0 ? G : R }}>
                    {pct(chg)}
                  </td>
                  <td style={{ fontSize:13, padding:'12px 0', borderBottom:'1px solid rgba(255,140,0,0.07)', textAlign:'right', color:DIM }}>
                    {fmt(p.market_cap)}
                  </td>
                  <td style={{ fontSize:13, padding:'12px 0', borderBottom:'1px solid rgba(255,140,0,0.07)', textAlign:'right', color:DIM }}>
                    {fmt(p.total_volume)}
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

// ── TAB WALLET ────────────────────────────────────────────────────────────
function WalletTab() {
  const [input, setInput]       = useState('')
  const [activeAddr, setActive] = useState('')
  const debankKey = import.meta.env.VITE_DEBANK_API_KEY

  const { portfolio, tokens, protocols, loading, error } = useWallet(activeAddr)

  const totalVal = tokens.reduce((s, t) => s + t.amount * t.price, 0)

  const thS = {
    fontSize:11, letterSpacing:'0.12em', color:'rgba(255,140,0,0.55)',
    fontWeight:700, fontFamily:'inherit', paddingBottom:12,
    borderBottom:'1px solid rgba(255,140,0,0.12)',
  }
  const tdS = (right, color, bold) => ({
    fontSize:13, padding:'12px 0',
    borderBottom:'1px solid rgba(255,140,0,0.07)',
    textAlign: right ? 'right' : 'left',
    color: color || WHITE,
    fontWeight: bold ? 700 : 400,
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {!debankKey && (
        <div style={{ padding:16, background:'rgba(255,204,0,0.07)',
          border:'1px solid rgba(255,204,0,0.3)', borderRadius:8 }}>
          <div style={{ fontSize:13, color:GOLD, fontWeight:700, marginBottom:6 }}>
            ⚠ DEBANK API KEY NO CONFIGURADA
          </div>
          <div style={{ fontSize:12, color:DIM, lineHeight:1.8 }}>
            1. Regístrate gratis en <span style={{ color:G }}>cloud.debank.com</span><br/>
            2. Copia tu API Key<br/>
            3. En Vercel → Settings → Environment Variables agrega:<br/>
            <code style={{ color:G }}>VITE_DEBANK_API_KEY = tu_key_aqui</code>
          </div>
        </div>
      )}

      <Card>
        <CT>CONECTAR WALLET · DeBank</CT>
        <div style={{ display:'flex', gap:12 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="0x... dirección de tu wallet"
            style={{
              flex:1, background:'rgba(255,140,0,0.05)',
              border:'1px solid rgba(255,140,0,0.25)',
              borderRadius:7, padding:'12px 16px',
              color:WHITE, fontFamily:'inherit', fontSize:13, outline:'none',
            }}
          />
          <button
            onClick={() => setActive(input.trim())}
            disabled={loading}
            style={{
              padding:'12px 28px',
              background: loading ? 'rgba(255,140,0,0.08)' : 'rgba(255,140,0,0.15)',
              border:'1px solid rgba(255,140,0,0.4)',
              borderRadius:7, color:G, cursor: loading ? 'wait' : 'pointer',
              fontFamily:'inherit', fontSize:13, fontWeight:700, letterSpacing:'0.08em',
            }}>
            {loading ? 'CARGANDO…' : 'ANALIZAR'}
          </button>
        </div>
        {error && <div style={{ marginTop:10, fontSize:12, color:R }}>{error}</div>}
      </Card>

      {portfolio && (
        <Card accent>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', flexWrap:'wrap', gap:16 }}>
            <div>
              <div style={{ fontSize:11, color:'rgba(255,140,0,0.55)', marginBottom:5 }}>WALLET</div>
              <div style={{ fontSize:14, color:G }}>{activeAddr.slice(0,8)}…{activeAddr.slice(-6)}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'rgba(255,140,0,0.55)', marginBottom:5 }}>VALOR TOTAL</div>
              <div style={{ fontSize:30, color:G, fontWeight:700 }}>{fmt(portfolio.total_usd_value)}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Dot/><span style={{ fontSize:12, color:'rgba(255,140,0,0.7)' }}>DATOS REALES · DEBANK</span>
            </div>
          </div>
        </Card>
      )}

      {tokens.length > 0 && (
        <Card>
          <CT>TOKENS EN WALLET</CT>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={thS}>TOKEN</th>
                <th style={thS}>CHAIN</th>
                <th style={{ ...thS, textAlign:'right' }}>CANTIDAD</th>
                <th style={{ ...thS, textAlign:'right' }}>PRECIO</th>
                <th style={{ ...thS, textAlign:'right' }}>VALOR</th>
                <th style={{ ...thS, textAlign:'right' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {tokens
                .filter(t => t.amount * t.price > 1)
                .sort((a, b) => b.amount * b.price - a.amount * a.price)
                .map((t, i) => {
                  const val = t.amount * t.price
                  return (
                    <tr key={i}>
                      <td style={tdS()}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {t.logo_url && <img src={t.logo_url} alt={t.symbol}
                            style={{ width:22, height:22, borderRadius:'50%' }}
                            onError={e => e.target.style.display='none'}/>}
                          <span style={{ fontWeight:700, fontSize:14 }}>{t.symbol}</span>
                        </div>
                      </td>
                      <td style={tdS()}><Badge label={t.chain?.toUpperCase() || 'ETH'} /></td>
                      <td style={tdS(true, DIM)}>{t.amount < 0.001 ? t.amount.toExponential(2) : t.amount.toFixed(4)}</td>
                      <td style={tdS(true, DIM)}>${t.price.toFixed(4)}</td>
                      <td style={tdS(true, G, true)}>{fmt(val)}</td>
                      <td style={tdS(true, DIM)}>{((val / totalVal) * 100).toFixed(1)}%</td>
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
            <thead>
              <tr>
                <th style={thS}>PROTOCOLO</th>
                <th style={thS}>CHAIN</th>
                <th style={{ ...thS, textAlign:'right' }}>VALOR USD</th>
              </tr>
            </thead>
            <tbody>
              {protocols
                .sort((a, b) =>
                  (b.portfolio_item_list?.reduce((s, x) => s + (x.stats?.net_usd_value || 0), 0) || 0) -
                  (a.portfolio_item_list?.reduce((s, x) => s + (x.stats?.net_usd_value || 0), 0) || 0)
                )
                .map((proto, i) => {
                  const val = proto.portfolio_item_list?.reduce((s, x) => s + (x.stats?.net_usd_value || 0), 0) || 0
                  return (
                    <tr key={i}>
                      <td style={tdS()}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {proto.logo_url && <img src={proto.logo_url} alt={proto.name}
                            style={{ width:22, height:22, borderRadius:'50%' }}
                            onError={e => e.target.style.display='none'}/>}
                          <span style={{ fontWeight:700, fontSize:14 }}>{proto.name}</span>
                        </div>
                      </td>
                      <td style={tdS()}><Badge label={proto.chain?.toUpperCase() || 'ETH'} /></td>
                      <td style={tdS(true, G, true)}>{fmt(val)}</td>
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

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]   = useState('overview')
  const [time, setTime] = useState(new Date())

  const { prices, loading: pricesLoading, lastUpdate, refresh } = usePrices()
  const { stats }   = useGlobalStats()
  const { history } = useEthHistory()

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const TABS = [
    { id:'overview', label:'OVERVIEW'         },
    { id:'prices',   label:'PRECIOS'          },
    { id:'wallet',   label:'WALLET · DEBANK'  },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { background:${BG}; }
        @keyframes ping { 75%,100%{ transform:scale(2); opacity:0; } }
        tr:hover td { background:rgba(255,140,0,0.03); }
        input::placeholder { color:rgba(255,255,255,0.2); }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:${BG}; }
        ::-webkit-scrollbar-thumb { background:rgba(255,140,0,0.25); border-radius:4px; }
        button:hover { opacity:0.85; }
      `}</style>

      <div style={{ minHeight:'100vh', background:BG,
        fontFamily:"'IBM Plex Mono',monospace", color:WHITE,
        position:'relative', overflow:'hidden' }}>

        {/* Grid BG */}
        <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
          backgroundImage:'linear-gradient(rgba(255,140,0,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,140,0,0.03) 1px,transparent 1px)',
          backgroundSize:'40px 40px' }}/>

        {/* Glow naranja arriba */}
        <div style={{ position:'fixed', top:'-200px', left:'50%',
          transform:'translateX(-50%)', width:'800px', height:'400px',
          borderRadius:'50%', pointerEvents:'none', zIndex:0,
          background:'radial-gradient(ellipse,rgba(255,140,0,0.08) 0%,transparent 70%)' }}/>

        <div style={{ position:'relative', zIndex:1, maxWidth:1300,
          margin:'0 auto', padding:'0 24px 56px' }}>

          {/* HEADER */}
          <header style={{ display:'flex', alignItems:'center',
            justifyContent:'space-between', padding:'24px 0 28px',
            borderBottom:'1px solid rgba(255,140,0,0.15)', marginBottom:28 }}>

            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:40, height:40, borderRadius:9,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:20, fontWeight:900, color:BG,
                background:`linear-gradient(135deg,${G},#E67A00)` }}>₿</div>
              <div>
                <div style={{ fontSize:17, fontWeight:700,
                  letterSpacing:'0.15em', color:G }}>DEFI PULSE</div>
                <div style={{ fontSize:10, color:'rgba(255,140,0,0.5)',
                  letterSpacing:'0.2em' }}>DASHBOARD v2.0 · LIVE</div>
              </div>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:22 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <Dot/>
                <span style={{ fontSize:12, color:'rgba(255,140,0,0.65)' }}>CoinGecko API LIVE</span>
              </div>
              <div style={{ fontSize:13, color:'rgba(255,140,0,0.6)',
                letterSpacing:'0.1em' }}>
                {time.toLocaleTimeString('es-CO')}
              </div>
            </div>
          </header>

          {/* TABS */}
          <div style={{ display:'flex', gap:5, marginBottom:26 }}>
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding:'10px 22px', fontSize:12, letterSpacing:'0.12em',
                  fontWeight: active ? 700 : 400, fontFamily:'inherit',
                  background: active ? 'rgba(255,140,0,0.15)' : 'transparent',
                  color: active ? G : 'rgba(255,140,0,0.4)',
                  border:`1px solid ${active ? 'rgba(255,140,0,0.45)' : 'rgba(255,140,0,0.12)'}`,
                  borderRadius:5, cursor:'pointer', transition:'all 0.2s',
                }}>{t.label}</button>
              )
            })}
          </div>

          {/* CONTENIDO */}
          {tab === 'overview' && <OverviewTab prices={prices} stats={stats} history={history} />}
          {tab === 'prices'   && <PricesTab prices={prices} loading={pricesLoading} lastUpdate={lastUpdate} refresh={refresh} />}
          {tab === 'wallet'   && <WalletTab />}
        </div>
      </div>
    </>
  )
}