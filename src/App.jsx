import { useState, useEffect } from 'react'
import { usePrices, useGlobalStats, useEthHistory, useWatchlist, useWallet } from './hooks/useDefiData.js'
import { hasDebankKey } from './services/api.js'

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
  return n >= 0 ? `▲ ${Math.abs(n).toFixed(2)}%` : `▼ ${Math.abs(n).toFixed(2)}%`
}
function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts * 1000) / 60000)
  if (diff < 1) return 'ahora'
  if (diff < 60) return `hace ${diff}m`
  if (diff < 1440) return `hace ${Math.floor(diff/60)}h`
  return `hace ${Math.floor(diff/1440)}d`
}

const G = '#FF8C00', G2 = '#FFA733', R = '#FF4D4D', GOLD = '#FFCC00'
const DIM = 'rgba(255,255,255,0.58)', WHITE = '#FFFFFF', BG = '#0D0D0D'
const thS = { fontSize:11, letterSpacing:'0.12em', color:'rgba(255,140,0,0.55)', fontWeight:700, fontFamily:'inherit', paddingBottom:12, borderBottom:'1px solid rgba(255,140,0,0.12)' }
const tdS = (right, color, bold) => ({ fontSize:13, padding:'11px 0', borderBottom:'1px solid rgba(255,140,0,0.07)', textAlign:right?'right':'left', color:color||WHITE, fontWeight:bold?700:400 })

// ── Componentes base ──────────────────────────────────────────
function Dot({ color = G, size = 9 }) {
  return (
    <span style={{ position:'relative', display:'inline-flex', width:size, height:size }}>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:color, opacity:0.4, animation:'ping 1.5s ease infinite' }}/>
      <span style={{ borderRadius:'50%', width:size, height:size, background:color, display:'block' }}/>
    </span>
  )
}
function Card({ children, accent, style = {} }) {
  return <div style={{ background:accent?'rgba(255,140,0,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${accent?'rgba(255,140,0,0.45)':'rgba(255,140,0,0.15)'}`, borderRadius:10, padding:22, ...style }}>{children}</div>
}
function CT({ children }) {
  return <div style={{ fontSize:11, letterSpacing:'0.2em', color:'rgba(255,140,0,0.7)', marginBottom:18, fontWeight:700 }}>{children}</div>
}
function Badge({ label, color = G }) {
  return <span style={{ fontSize:11, fontWeight:700, color, border:`1px solid ${color}44`, background:`${color}15`, padding:'3px 10px', borderRadius:4 }}>{label}</span>
}
function WsIndicator({ status }) {
  const map = { live:{ color:G, label:'LIVE · BINANCE WS' }, connecting:{ color:GOLD, label:'CONECTANDO…' }, error:{ color:R, label:'WS ERROR' } }
  const { color, label } = map[status] || map.connecting
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
      <Dot color={color}/>
      <span style={{ fontSize:11, color, fontWeight:700, letterSpacing:'0.08em' }}>{label}</span>
    </div>
  )
}
function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position:'relative' }}>
      <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'rgba(255,140,0,0.4)', pointerEvents:'none' }}>⌕</span>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Buscar…'}
        style={{ width:'100%', background:'rgba(255,140,0,0.05)', border:'1px solid rgba(255,140,0,0.2)', borderRadius:7, padding:'10px 36px', color:WHITE, fontFamily:'inherit', fontSize:13, outline:'none' }}/>
      {value && <button onClick={()=>onChange('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:DIM, fontSize:18, lineHeight:1 }}>×</button>}
    </div>
  )
}
function SparkBar({ data }) {
  if (!data.length) return <div style={{ height:64, display:'flex', alignItems:'center', justifyContent:'center', color:DIM, fontSize:13 }}>Cargando…</div>
  const max = Math.max(...data.map(d=>d.value))
  const min = Math.min(...data.map(d=>d.value))
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:64 }}>
      {data.map((d,i)=>{
        const h = ((d.value-min)/(max-min||1))*50+8
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div title={`$${d.value.toFixed(0)}`} style={{ width:'100%', height:h, borderRadius:'4px 4px 0 0', background:i===data.length-1?`linear-gradient(180deg,${G},${G2})`:'rgba(255,140,0,0.22)', transition:'height 0.6s' }}/>
            <span style={{ fontSize:10, color:'rgba(255,140,0,0.45)' }}>{d.day}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── OVERVIEW ──────────────────────────────────────────────────
function OverviewTab({ prices, stats, history, wsStatus }) {
  const eth = prices.find(p=>p.id==='ethereum')
  const kpis = [
    { label:'MARKET CAP CRIPTO', value:fmt(stats?.total_market_cap?.usd), sub:stats?`BTC dom. ${stats.market_cap_percentage?.btc?.toFixed(1)}%`:'Cargando…', accent:true },
    { label:'VOLUMEN 24H',       value:fmt(stats?.total_volume?.usd), sub:'Mercado global' },
    { label:'ETH PRECIO',        value:eth?`$${(eth.current_price??0).toLocaleString()}`:'…', sub:eth?pct(eth.price_change_percentage_24h):'…' },
    { label:'MONEDAS RASTREADAS',value:prices.length||'…', sub:'Top 500 por market cap' },
  ]
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:22 }}>
        {kpis.map((k,i)=>(
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
            <WsIndicator status={wsStatus}/>
          </div>
          <SparkBar data={history}/>
          {history.length>1&&(
            <div style={{ marginTop:14, display:'flex', gap:28 }}>
              {[['INICIO',`$${history[0]?.value.toFixed(0)}`],['ACTUAL',`$${history[history.length-1]?.value.toFixed(0)}`],['VARIACIÓN',pct(((history[history.length-1]?.value-history[0]?.value)/history[0]?.value)*100)]].map(([l,v],i)=>(
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
          {[...prices].sort((a,b)=>Math.abs(b.price_change_percentage_24h??0)-Math.abs(a.price_change_percentage_24h??0)).slice(0,8).map((p,i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:11 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <img src={p.image} alt={p.symbol} style={{ width:20, height:20, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                <span style={{ fontSize:13, fontWeight:700, color:WHITE }}>{p.symbol.toUpperCase()}</span>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:p.price_change_percentage_24h>=0?G:R }}>{pct(p.price_change_percentage_24h)}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}

// ── PRECIOS (top 500 + búsqueda + estrella) ───────────────────
function PricesTab({ prices, loading, lastUpdate, wsStatus, watchlist, onToggle }) {
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const PER_PAGE = 50

  const filtered = prices.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.symbol.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const visible    = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE)

  // Reset página al buscar
  useEffect(() => { setPage(1) }, [search])

  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <CT>PRECIOS · TOP 500 · BINANCE WS TIEMPO REAL</CT>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <WsIndicator status={wsStatus}/>
          {lastUpdate&&<span style={{ fontSize:11, color:DIM }}>{lastUpdate.toLocaleTimeString('es-CO')}</span>}
        </div>
      </div>

      <div style={{ marginBottom:16 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar entre 500 monedas (nombre o símbolo)…"/>
      </div>
      {search && <div style={{ marginBottom:12, fontSize:12, color:DIM }}>{filtered.length} resultado{filtered.length!==1?'s':''} para "{search}"</div>}

      {loading ? (
        <div style={{ textAlign:'center', padding:56, color:DIM, fontSize:14 }}>Cargando top 500 desde CoinGecko…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:40, color:DIM, fontSize:13 }}>No se encontró "{search}"</div>
      ) : (
        <>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['#','TOKEN','PRECIO USD','24H','MARKET CAP','VOL 24H','★'].map((h,i)=>(
                  <th key={i} style={{ ...thS, textAlign:i>1?'right':'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p=>{
                const chg     = p.price_change_percentage_24h
                const watched = watchlist.includes(p.id)
                return (
                  <tr key={p.id}>
                    <td style={tdS(false,DIM)}>{prices.indexOf(p)+1}</td>
                    <td style={tdS()}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <img src={p.image} alt={p.symbol} style={{ width:24, height:24, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                        <div>
                          <div style={{ fontWeight:700, fontSize:14, color:WHITE }}>{p.symbol.toUpperCase()}</div>
                          <div style={{ fontSize:11, color:DIM }}>{p.name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdS(true,WHITE,true)}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:8})}</td>
                    <td style={tdS(true,chg>=0?G:R,true)}>{pct(chg)}</td>
                    <td style={tdS(true,DIM)}>{fmt(p.market_cap)}</td>
                    <td style={tdS(true,DIM)}>{fmt(p.total_volume)}</td>
                    <td style={{ ...tdS(true), width:44 }}>
                      {/* ESTRELLA — click directo añade/quita de watchlist */}
                      <button
                        onClick={()=>onToggle(p.id)}
                        title={watched?'Quitar de watchlist':'Añadir a watchlist'}
                        style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:watched?G:'rgba(255,255,255,0.18)', transition:'all 0.15s', transform:watched?'scale(1.1)':'scale(1)' }}>
                        {watched?'★':'☆'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Paginación */}
          {!search && totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:20 }}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'6px 14px', background:'rgba(255,140,0,0.08)', border:'1px solid rgba(255,140,0,0.2)', borderRadius:5, color:page===1?DIM:G, cursor:page===1?'default':'pointer', fontFamily:'inherit', fontSize:12 }}>← ANT</button>
              {Array.from({length:totalPages},(_,i)=>i+1).map(n=>(
                <button key={n} onClick={()=>setPage(n)} style={{ padding:'6px 12px', background:n===page?'rgba(255,140,0,0.2)':'transparent', border:`1px solid ${n===page?'rgba(255,140,0,0.5)':'rgba(255,140,0,0.12)'}`, borderRadius:5, color:n===page?G:DIM, cursor:'pointer', fontFamily:'inherit', fontSize:12 }}>{n}</button>
              ))}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding:'6px 14px', background:'rgba(255,140,0,0.08)', border:'1px solid rgba(255,140,0,0.2)', borderRadius:5, color:page===totalPages?DIM:G, cursor:page===totalPages?'default':'pointer', fontFamily:'inherit', fontSize:12 }}>SIG →</button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// ── WATCHLIST ─────────────────────────────────────────────────
function WatchlistTab({ prices, watchlist, onToggle, onClear, wsStatus }) {
  const [addSearch, setAddSearch] = useState('')
  const watched    = prices.filter(p=>watchlist.includes(p.id))
  const avgChange  = watched.length ? watched.reduce((s,p)=>s+(p.price_change_percentage_24h??0),0)/watched.length : 0
  const suggestions = addSearch.length > 1
    ? prices.filter(p=>!watchlist.includes(p.id)&&(p.name.toLowerCase().includes(addSearch.toLowerCase())||p.symbol.toLowerCase().includes(addSearch.toLowerCase()))).slice(0,6)
    : []

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        <Card accent>
          <div style={{ fontSize:11, color:'rgba(255,140,0,0.6)', marginBottom:8, letterSpacing:'0.15em' }}>MONEDAS SEGUIDAS</div>
          <div style={{ fontSize:28, fontWeight:700, color:G }}>{watched.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize:11, color:'rgba(255,140,0,0.6)', marginBottom:8, letterSpacing:'0.15em' }}>CAMBIO PROMEDIO 24H</div>
          <div style={{ fontSize:28, fontWeight:700, color:avgChange>=0?G:R }}>{watched.length?pct(avgChange):'—'}</div>
        </Card>
        <Card>
          <div style={{ fontSize:11, color:'rgba(255,140,0,0.6)', marginBottom:8, letterSpacing:'0.15em' }}>FEED</div>
          <div style={{ marginTop:6 }}><WsIndicator status={wsStatus}/></div>
        </Card>
      </div>

      <Card>
        <CT>AÑADIR MONEDA — busca entre las 500</CT>
        <div style={{ position:'relative' }}>
          <SearchInput value={addSearch} onChange={setAddSearch} placeholder="Escribe nombre o símbolo (ej: solana, bnb, pepe…)"/>
          {suggestions.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'#1A1A1A', border:'1px solid rgba(255,140,0,0.25)', borderRadius:8, marginTop:4, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', overflow:'hidden' }}>
              {suggestions.map(p=>(
                <button key={p.id} onClick={()=>{ onToggle(p.id); setAddSearch('') }} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 16px', background:'transparent', border:'none', borderBottom:'1px solid rgba(255,140,0,0.08)', cursor:'pointer', color:WHITE, fontFamily:'inherit', transition:'background 0.15s' }}
                  onMouseOver={e=>e.currentTarget.style.background='rgba(255,140,0,0.06)'}
                  onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <img src={p.image} alt={p.symbol} style={{ width:24, height:24, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                    <span style={{ fontWeight:700, fontSize:14 }}>{p.symbol.toUpperCase()}</span>
                    <span style={{ fontSize:12, color:DIM }}>{p.name}</span>
                    <span style={{ fontSize:12, color:p.price_change_percentage_24h>=0?G:R }}>{pct(p.price_change_percentage_24h)}</span>
                  </div>
                  <span style={{ fontSize:12, color:G, fontWeight:700 }}>★ AÑADIR</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop:10, fontSize:11, color:DIM }}>También puedes pulsar ★ directamente en la tab PRECIOS</div>
      </Card>

      {watched.length === 0 ? (
        <Card>
          <div style={{ textAlign:'center', padding:56, color:DIM }}>
            <div style={{ fontSize:52, marginBottom:16 }}>☆</div>
            <div style={{ fontSize:15, marginBottom:10, color:WHITE }}>Tu watchlist está vacía</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)', lineHeight:1.9 }}>
              Busca arriba y pulsa ★ AÑADIR<br/>
              o ve a PRECIOS y toca ★ en cualquier moneda
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {watched.map(p=>{
              const chg = p.price_change_percentage_24h ?? 0
              return (
                <div key={p.id} style={{ background:'rgba(255,140,0,0.04)', border:`1px solid ${chg>=0?'rgba(255,140,0,0.2)':'rgba(255,77,77,0.2)'}`, borderRadius:8, padding:18, position:'relative' }}>
                  <button onClick={()=>onToggle(p.id)} title="Quitar de watchlist" style={{ position:'absolute', top:10, right:12, background:'none', border:'none', cursor:'pointer', fontSize:20, color:G }}>★</button>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <img src={p.image} alt={p.symbol} style={{ width:30, height:30, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:WHITE }}>{p.symbol.toUpperCase()}</div>
                      <div style={{ fontSize:11, color:DIM }}>{p.name}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:24, fontWeight:700, color:WHITE, marginBottom:6, fontVariantNumeric:'tabular-nums' }}>
                    ${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:chg>=0?G:R }}>{pct(chg)}</div>
                  <div style={{ marginTop:8, fontSize:11, color:DIM }}>Cap: {fmt(p.market_cap)}</div>
                </div>
              )
            })}
          </div>
          <Card>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <CT>TABLA DETALLADA</CT>
              <button onClick={onClear} style={{ fontSize:11, padding:'5px 14px', background:'rgba(255,77,77,0.08)', border:'1px solid rgba(255,77,77,0.25)', borderRadius:5, color:R, cursor:'pointer', fontFamily:'inherit' }}>✕ LIMPIAR TODO</button>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['TOKEN','PRECIO','24H','MARKET CAP','VOL 24H','QUITAR'].map((h,i)=><th key={i} style={{ ...thS, textAlign:i>0?'right':'left' }}>{h}</th>)}</tr></thead>
              <tbody>
                {watched.map(p=>{
                  const chg = p.price_change_percentage_24h??0
                  return (
                    <tr key={p.id}>
                      <td style={tdS()}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <img src={p.image} alt={p.symbol} style={{ width:20, height:20, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                          <span style={{ fontWeight:700 }}>{p.symbol.toUpperCase()}</span>
                        </div>
                      </td>
                      <td style={tdS(true,WHITE,true)}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</td>
                      <td style={tdS(true,chg>=0?G:R,true)}>{pct(chg)}</td>
                      <td style={tdS(true,DIM)}>{fmt(p.market_cap)}</td>
                      <td style={tdS(true,DIM)}>{fmt(p.total_volume)}</td>
                      <td style={tdS(true)}><button onClick={()=>onToggle(p.id)} style={{ background:'rgba(255,77,77,0.08)', border:'1px solid rgba(255,77,77,0.25)', borderRadius:4, color:R, cursor:'pointer', fontSize:11, padding:'4px 12px', fontFamily:'inherit' }}>✕</button></td>
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

// ── WALLET (DeBank completo + historial) ──────────────────────
function WalletTab() {
  const [input, setInput]     = useState('')
  const [activeAddr, setActive] = useState('')
  const [walletTab, setWalletTab] = useState('tokens')
  const debankActive = hasDebankKey()
  const { portfolio, tokens, protocols, history, loading, error, refresh } = useWallet(activeAddr)
  const totalVal = tokens.reduce((s,t)=>s+t.amount*t.price, 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Estado DeBank */}
      {debankActive ? (
        <div style={{ padding:14, background:'rgba(255,140,0,0.06)', border:'1px solid rgba(255,140,0,0.25)', borderRadius:8, display:'flex', alignItems:'center', gap:10 }}>
          <Dot/><span style={{ fontSize:12, color:G, fontWeight:700 }}>DEBANK API CONECTADA ✓</span>
          <span style={{ fontSize:12, color:DIM }}>— Tu key está cifrada en Vercel, nunca expuesta en el código</span>
        </div>
      ) : (
        <div style={{ padding:18, background:'rgba(255,204,0,0.06)', border:'1px solid rgba(255,204,0,0.28)', borderRadius:8 }}>
          <div style={{ fontSize:13, color:GOLD, fontWeight:700, marginBottom:8 }}>⚠ DEBANK API KEY NO CONFIGURADA</div>
          <div style={{ fontSize:12, color:DIM, lineHeight:2 }}>
            1. Regístrate gratis en <span style={{ color:G }}>cloud.debank.com</span><br/>
            2. Ve a <span style={{ color:G }}>API Keys</span> → crea una key<br/>
            3. En Vercel → <span style={{ color:G }}>Settings → Environment Variables</span> → añade:<br/>
            <div style={{ marginTop:6, padding:'8px 14px', background:'rgba(0,0,0,0.4)', borderRadius:6, fontSize:12 }}>
              <span style={{ color:'rgba(255,140,0,0.6)' }}>Nombre:</span> <span style={{ color:WHITE }}>VITE_DEBANK_API_KEY</span><br/>
              <span style={{ color:'rgba(255,140,0,0.6)' }}>Valor:</span> <span style={{ color:WHITE }}>tu_key_aqui</span>
            </div>
            4. Click en <span style={{ color:G }}>Redeploy</span> → listo ✓<br/>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>La key nunca aparece en tu código ni en GitHub</span>
          </div>
        </div>
      )}

      {/* Input wallet */}
      <Card>
        <CT>ANALIZAR WALLET · DeBank</CT>
        <div style={{ fontSize:12, color:DIM, marginBottom:14, lineHeight:1.7 }}>
          Solo lectura pública — no necesitas MetaMask ni firmar nada.<br/>
          Funciona con cualquier wallet de Ethereum, Polygon, BSC, Arbitrum, Optimism y más.
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setActive(input.trim())}
            placeholder="0x... dirección Ethereum (o cualquier EVM chain)"
            style={{ flex:1, background:'rgba(255,140,0,0.05)', border:'1px solid rgba(255,140,0,0.25)', borderRadius:7, padding:'12px 16px', color:WHITE, fontFamily:'inherit', fontSize:13, outline:'none' }}/>
          <button onClick={()=>setActive(input.trim())} disabled={loading}
            style={{ padding:'12px 28px', background:loading?'rgba(255,140,0,0.06)':'rgba(255,140,0,0.15)', border:'1px solid rgba(255,140,0,0.4)', borderRadius:7, color:G, cursor:loading?'wait':'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700, letterSpacing:'0.08em' }}>
            {loading?'CARGANDO…':'ANALIZAR'}
          </button>
          {activeAddr&&<button onClick={refresh} style={{ padding:'12px 18px', background:'transparent', border:'1px solid rgba(255,140,0,0.2)', borderRadius:7, color:'rgba(255,140,0,0.6)', cursor:'pointer', fontFamily:'inherit', fontSize:16 }}>↻</button>}
        </div>
        {error&&<div style={{ marginTop:10, fontSize:12, color:R }}>Error: {error}</div>}
      </Card>

      {/* Resumen portfolio */}
      {portfolio && (
        <Card accent>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
            <div>
              <div style={{ fontSize:11, color:'rgba(255,140,0,0.55)', marginBottom:5, letterSpacing:'0.15em' }}>WALLET ANALIZADA</div>
              <div style={{ fontSize:13, color:G }}>{activeAddr.slice(0,10)}…{activeAddr.slice(-8)}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'rgba(255,140,0,0.55)', marginBottom:5, letterSpacing:'0.15em' }}>VALOR TOTAL</div>
              <div style={{ fontSize:34, color:G, fontWeight:700 }}>{fmt(portfolio.total_usd_value)}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><Dot/><span style={{ fontSize:12, color:'rgba(255,140,0,0.7)' }}>DEBANK LIVE</span></div>
              <div style={{ fontSize:11, color:DIM }}>Auto-refresh: 2 min</div>
              <div style={{ fontSize:11, color:DIM }}>{protocols.length} protocolo{protocols.length!==1?'s':''} · {tokens.filter(t=>t.amount*t.price>1).length} tokens</div>
            </div>
          </div>
        </Card>
      )}

      {/* Sub-tabs de wallet */}
      {(tokens.length > 0 || protocols.length > 0 || history.length > 0) && (
        <>
          <div style={{ display:'flex', gap:4 }}>
            {[['tokens','TOKENS'],['protocols','PROTOCOLOS DeFi'],['history','HISTORIAL']].map(([id,label])=>(
              <button key={id} onClick={()=>setWalletTab(id)} style={{ padding:'8px 18px', fontSize:11, letterSpacing:'0.1em', fontWeight:walletTab===id?700:400, fontFamily:'inherit', background:walletTab===id?'rgba(255,140,0,0.12)':'transparent', color:walletTab===id?G:'rgba(255,140,0,0.4)', border:`1px solid ${walletTab===id?'rgba(255,140,0,0.4)':'rgba(255,140,0,0.1)'}`, borderRadius:5, cursor:'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          {walletTab==='tokens' && tokens.length>0 && (
            <Card>
              <CT>TOKENS EN WALLET</CT>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['TOKEN','CHAIN','CANTIDAD','PRECIO','VALOR USD','% WALLET'].map((h,i)=><th key={i} style={{ ...thS, textAlign:i>1?'right':'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {tokens.filter(t=>t.amount*t.price>1).sort((a,b)=>b.amount*b.price-a.amount*a.price).map((t,i)=>{
                    const val=t.amount*t.price
                    return (
                      <tr key={i}>
                        <td style={tdS()}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            {t.logo_url&&<img src={t.logo_url} alt={t.symbol} style={{ width:22,height:22,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>}
                            <span style={{ fontWeight:700,fontSize:14 }}>{t.symbol}</span>
                          </div>
                        </td>
                        <td style={tdS()}><Badge label={t.chain?.toUpperCase()||'ETH'}/></td>
                        <td style={tdS(true,DIM)}>{t.amount<0.001?t.amount.toExponential(2):t.amount.toFixed(4)}</td>
                        <td style={tdS(true,DIM)}>${t.price.toFixed(4)}</td>
                        <td style={tdS(true,G,true)}>{fmt(val)}</td>
                        <td style={tdS(true,DIM)}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8 }}>
                            <div style={{ width:50,height:4,background:'rgba(255,255,255,0.08)',borderRadius:2 }}>
                              <div style={{ width:`${Math.min((val/totalVal)*100,100)}%`,height:'100%',background:G,borderRadius:2 }}/>
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

          {walletTab==='protocols' && protocols.length>0 && (
            <Card>
              <CT>POSICIONES EN PROTOCOLOS DeFi</CT>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['PROTOCOLO','CHAIN','VALOR USD'].map((h,i)=><th key={i} style={{ ...thS, textAlign:i>1?'right':'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {protocols.sort((a,b)=>(b.portfolio_item_list?.reduce((s,x)=>s+(x.stats?.net_usd_value||0),0)||0)-(a.portfolio_item_list?.reduce((s,x)=>s+(x.stats?.net_usd_value||0),0)||0)).map((proto,i)=>{
                    const val=proto.portfolio_item_list?.reduce((s,x)=>s+(x.stats?.net_usd_value||0),0)||0
                    return (
                      <tr key={i}>
                        <td style={tdS()}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            {proto.logo_url&&<img src={proto.logo_url} alt={proto.name} style={{ width:22,height:22,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>}
                            <span style={{ fontWeight:700,fontSize:14 }}>{proto.name}</span>
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

          {walletTab==='history' && (
            <Card>
              <CT>HISTORIAL DE TRANSACCIONES</CT>
              {history.length===0 ? (
                <div style={{ textAlign:'center', padding:32, color:DIM, fontSize:13 }}>No se encontró historial o DeBank API key no configurada</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>{['TIPO','CHAIN','DESCRIPCIÓN','VALOR','HACE'].map((h,i)=><th key={i} style={{ ...thS, textAlign:i>2?'right':'left' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {history.slice(0,30).map((tx,i)=>{
                      const val = tx.sends?.reduce((s,x)=>s+(x.amount*x.price||0),0)||0
                      return (
                        <tr key={i}>
                          <td style={tdS()}><Badge label={tx.tx?.name||'TX'} color={G}/></td>
                          <td style={tdS()}><Badge label={tx.chain?.toUpperCase()||'ETH'}/></td>
                          <td style={{ ...tdS(), maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            <span style={{ color:DIM, fontSize:12 }}>{tx.tx?.name||'Transacción'}</span>
                          </td>
                          <td style={tdS(true, val>0?G:DIM, val>0)}>{val>0?fmt(val):'—'}</td>
                          <td style={tdS(true,DIM)}>{timeAgo(tx.time_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── APP PRINCIPAL ─────────────────────────────────────────────
export default function App() {
  const [tab, setTab]   = useState('overview')
  const [time, setTime] = useState(new Date())

  const { prices, loading, lastUpdate, wsStatus } = usePrices()
  const { stats }   = useGlobalStats()
  const { history } = useEthHistory()
  const { watchlist, toggle, clear } = useWatchlist()

  useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(t) },[])

  const TABS = [
    { id:'overview',  label:'OVERVIEW' },
    { id:'prices',    label:'PRECIOS · 500' },
    { id:'watchlist', label:`★ WATCHLIST${watchlist.length>0?` (${watchlist.length})`:''}` },
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
        input::placeholder { color:rgba(255,255,255,0.22); }
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
                <div style={{ fontSize:10, color:'rgba(255,140,0,0.5)', letterSpacing:'0.2em' }}>DASHBOARD v4.0 · CEREBRO DeFi</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:24 }}>
              <WsIndicator status={wsStatus}/>
              <div style={{ fontSize:13, color:'rgba(255,140,0,0.6)', letterSpacing:'0.1em' }}>{time.toLocaleTimeString('es-CO')}</div>
            </div>
          </header>
          <div style={{ display:'flex', gap:5, marginBottom:26 }}>
            {TABS.map(t=>{
              const active=tab===t.id
              return <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'10px 22px', fontSize:12, letterSpacing:'0.12em', fontWeight:active?700:400, fontFamily:'inherit', background:active?'rgba(255,140,0,0.15)':'transparent', color:active?G:'rgba(255,140,0,0.4)', border:`1px solid ${active?'rgba(255,140,0,0.45)':'rgba(255,140,0,0.12)'}`, borderRadius:5, cursor:'pointer', transition:'all 0.2s' }}>{t.label}</button>
            })}
          </div>
          {tab==='overview'  && <OverviewTab  prices={prices} stats={stats} history={history} wsStatus={wsStatus}/>}
          {tab==='prices'    && <PricesTab    prices={prices} loading={loading} lastUpdate={lastUpdate} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle}/>}
          {tab==='watchlist' && <WatchlistTab prices={prices} watchlist={watchlist} onToggle={toggle} onClear={clear} wsStatus={wsStatus}/>}
          {tab==='wallet'    && <WalletTab/>}
        </div>
      </div>
    </>
  )
}