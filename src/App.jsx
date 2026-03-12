import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

const FC = {
  apiKey: "AIzaSyC6gv0FtJj7MCwtO85xlrnyYbXiYImejeI",
  authDomain: "light-magic-park-live.firebaseapp.com",
  databaseURL: "https://light-magic-park-live-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "light-magic-park-live",
  storageBucket: "light-magic-park-live.firebasestorage.app",
  messagingSenderId: "382857282910",
  appId: "1:382857282910:web:31a348a2dfda26525fbbcf"
};
const fbApp = getApps().length ? getApps()[0] : initializeApp(FC);
const db = getDatabase(fbApp);

const _a = [52,48,48,48,54,50].map(c => String.fromCharCode(c)).join("");
const checkAuth = p => p === _a;

const FLOORS = [
  { id:"t3-2f",  label:"Tower 3 · 2nd Floor",  shortLabel:"T3 · 2F", fbKey:"parking",       totalSpots:12, spotIds:[1,2,3,4,5,6,7,8,9,10,11,12],                         layoutType:"t3-2f" },
  { id:"t4-b1",  label:"Tower 4 · Basement 1", shortLabel:"T4 · B1", fbKey:"parking-t4-b1", totalSpots:5,  spotIds:[211,210,209,208,207],                                 layoutType:"t4-b1" },
  { id:"t4-b2",  label:"Tower 4 · Basement 2", shortLabel:"T4 · B2", fbKey:"parking-t4-b2", totalSpots:13, spotIds:[189,190,191,192,193,194,195,179,178,177,176,175,174], layoutType:"t4-b2" },
];

const mkSpots = ids => Object.fromEntries(ids.map(id => [id, { id, occupied:false, updatedBy:null, updatedAt:null }]));
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
const fmt = iso => iso ? new Date(iso).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";
function msUntilReset() { const now=new Date(), r=new Date(now); r.setHours(23,59,0,0); if(r<=now) r.setDate(r.getDate()+1); return r-now; }

// Light theme
const T = { bg:"#f2f2f7", card:"#ffffff", fg:"#000000", sub:"#6c6c70", border:"#e5e5ea", inputBorder:"#c7c7cc" };

// ── SVGs ──────────────────────────────────────────────────────────────────
const CarSVG = ({ color="#d63031", size=34 }) => (
  <svg width={size} height={size*0.55} viewBox="0 0 80 44" fill="none">
    <rect x="3" y="18" width="74" height="20" rx="6" fill={color}/>
    <path d="M13 18 L22 5 H58 L67 18Z" fill={color} opacity="0.88"/>
    <rect x="23" y="7" width="11" height="9" rx="2" fill="#fff" opacity="0.4"/>
    <rect x="46" y="7" width="11" height="9" rx="2" fill="#fff" opacity="0.4"/>
    <circle cx="18" cy="38" r="6.5" fill="#333" stroke={color} strokeWidth="2.5"/>
    <circle cx="62" cy="38" r="6.5" fill="#333" stroke={color} strokeWidth="2.5"/>
  </svg>
);

const BikeSVG = ({ size=24, color="#aaa" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5"/>
    <circle cx="18.5" cy="17.5" r="3.5"/>
    <path d="M15 6h-5l-3 7h11l-3-7z"/>
    <path d="M5.5 17.5L9 10"/><path d="M18.5 17.5L15 6"/><path d="M9 10h6"/>
  </svg>
);

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
  </svg>
);

// ── Pillar ────────────────────────────────────────────────────────────────
const Pillar = ({ num }) => (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"stretch" }}>
    {num && <div style={{ fontSize:7, fontWeight:800, color:"#b8860b", marginBottom:2, textAlign:"center" }}>P{num}</div>}
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(180,140,0,0.08)", border:"1px solid rgba(180,140,0,0.3)", borderRadius:4, minHeight:60, width:12 }}>
      <div style={{ width:4, height:"50%", borderRadius:2, background:"rgba(180,140,0,0.4)" }}/>
    </div>
  </div>
);

// ── Bike Bay — visual only, never tappable (same concept as Reserved) ─────
const BikeBayCell = () => (
  <div style={{
    borderRadius:10, minHeight:78,
    background:"#f0f0f0",
    backgroundImage:"repeating-linear-gradient(45deg,rgba(0,0,0,0.05) 0px,rgba(0,0,0,0.05) 4px,transparent 4px,transparent 11px)",
    border:"2px solid #d8d8d8",
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4,
    cursor:"default", userSelect:"none",
  }}>
    <BikeSVG size={22} color="#b0b0b0"/>
    <div style={{ fontSize:6.5, fontWeight:700, color:"#b0b0b0", letterSpacing:"0.5px" }}>BIKE ONLY</div>
  </div>
);

// ── Spot Cell ─────────────────────────────────────────────────────────────
const SpotCell = ({ id, spots, isGuard, onTap, blocked=false, empty=false }) => {
  if (empty) return <div/>;
  if (blocked) return (
    <div style={{ borderRadius:10, minHeight:78, background:"#fff8f0", border:"2px solid #ffcc88", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3 }}>
      <div style={{ fontSize:14 }}>🚧</div>
      <div style={{ fontSize:6.5, fontWeight:700, color:"#cc8800" }}>RESERVED</div>
    </div>
  );
  const sp=spots?.[id], occ=sp?.occupied;
  return (
    <div onClick={() => isGuard && onTap(sp || { id, occupied:false, updatedBy:null, updatedAt:null })}
      style={{ borderRadius:10, minHeight:78, padding:"5px 3px 4px", display:"flex", flexDirection:"column", alignItems:"center",
        background: occ ? "linear-gradient(160deg,#fff0f0,#ffe6e6)" : "linear-gradient(160deg,#f0fff4,#e6ffe9)",
        border:`2px solid ${occ ? "#ff3b3066" : "#34c75955"}`,
        cursor: isGuard ? "pointer" : "default", userSelect:"none", position:"relative", overflow:"hidden",
        boxShadow: occ ? "0 1px 4px rgba(255,59,48,0.1)" : "0 1px 4px rgba(52,199,89,0.1)",
        transition:"border-color 0.2s" }}>
      <div style={{ fontSize:9, fontWeight:800, color: occ ? "#ff3b3099" : "#34c75999", marginBottom:2 }}>{id}</div>
      {occ ? (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, flex:1, justifyContent:"center" }}>
          <CarSVG/>
          {sp?.updatedBy && <div style={{ fontSize:6, fontWeight:700, color:"#ff3b3099", textAlign:"center", lineHeight:1.3 }}><div>{sp.updatedBy}</div><div>{fmt(sp.updatedAt)}</div></div>}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, gap:3 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:3, width:"52%" }}>
            <div style={{ height:2, borderRadius:1, background:"rgba(52,199,89,0.35)" }}/>
            <div style={{ height:2, borderRadius:1, background:"rgba(52,199,89,0.35)" }}/>
          </div>
          <div style={{ fontSize:6.5, fontWeight:700, color:"rgba(52,199,89,0.65)" }}>FREE</div>
        </div>
      )}
      {isGuard && <div style={{ position:"absolute", bottom:3, right:3, width:5, height:5, borderRadius:"50%", background: occ ? "#ff3b30" : "#34c759", opacity:0.7 }}/>}
    </div>
  );
};

// ── Bottom Sheet ──────────────────────────────────────────────────────────
const BottomSheet = ({ spot, onOccupy, onRelease, onClose }) => {
  if (!spot) return null;
  const occ = spot.occupied;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", flexDirection:"column", justifyContent:"flex-end" }} onClick={onClose}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.3)", backdropFilter:"blur(4px)" }}/>
      <div style={{ position:"relative", background:"#fff", borderRadius:"22px 22px 0 0", padding:"10px 0 44px", boxShadow:"0 -4px 32px rgba(0,0,0,0.1)" }} onClick={e => e.stopPropagation()}>
        <div style={{ width:32, height:4, borderRadius:2, background:"#ccc", margin:"0 auto 18px" }}/>
        <div style={{ padding:"0 22px 14px", borderBottom:"1px solid #e5e5ea" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#6c6c70", letterSpacing:"1px", textTransform:"uppercase", marginBottom:4 }}>Bay {spot.id}</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#000" }}>{occ ? "Currently Occupied" : "Currently Free"}</div>
          {occ && spot.updatedBy && <div style={{ fontSize:13, color:"#6c6c70", marginTop:3 }}>By <b style={{ color:"#000" }}>{spot.updatedBy}</b> at {fmt(spot.updatedAt)}</div>}
        </div>
        <div style={{ padding:"12px 22px 0", display:"flex", flexDirection:"column", gap:10 }}>
          {!occ && <button style={{ padding:"15px", borderRadius:14, border:"none", background:"#ff3b30", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer" }} onClick={() => { onOccupy(spot.id); onClose(); }}>🚗  Mark as Occupied</button>}
          {occ  && <button style={{ padding:"15px", borderRadius:14, border:"none", background:"#34c759", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer" }} onClick={() => { onRelease(spot.id); onClose(); }}>✅  Release This Bay</button>}
          <button style={{ padding:"15px", borderRadius:14, border:"1.5px solid #e5e5ea", background:"transparent", color:"#6c6c70", fontSize:15, fontWeight:600, cursor:"pointer" }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ── Floor Map ─────────────────────────────────────────────────────────────
const FloorMap = ({ floor, spots, isGuard, onTapSpot }) => {
  const card = { background:T.card, borderRadius:20, border:`1px solid ${T.border}`, margin:"0 10px", padding:"12px 8px", boxShadow:"0 1px 6px rgba(0,0,0,0.05)" };

  if (floor.layoutType === "t3-2f") return (
    <div style={card}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 18px 1fr 1fr 1fr 1fr", gap:"5px" }}>
        {[null,null,null,null].map((_,i) => <SpotCell key={`e${i}`} empty/>)}
        <div/>
        {[1,2,3,4].map(id => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot}/>)}
      </div>
      <div style={{ height:1, background:T.border, margin:"7px 0" }}/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 18px 1fr 1fr 1fr 1fr", gap:"5px", alignItems:"stretch" }}>
        {[12,11,10,9].map(id => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot}/>)}
        <Pillar/>
        {[8,7,6,5].map(id => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot}/>)}
      </div>
      <div style={{ textAlign:"center", fontSize:8, color:T.sub, marginTop:8, letterSpacing:"1.5px", opacity:0.5 }}>▲ ENTRY / EXIT</div>
    </div>
  );

  if (floor.layoutType === "t4-b1") return (
    <div style={{ ...card }}>
      <div style={{ fontSize:9, color:"#999", fontWeight:600, marginBottom:8, textAlign:"center" }}>
        🚲 Grey striped = Bike parking only
      </div>
      {/* P72 | bike,bike,bike | P72 | 211,210,209 | P71 | 208,207,bike | P70 */}
      <div style={{ display:"grid", gridTemplateColumns:"18px 1fr 1fr 1fr 18px 1fr 1fr 1fr 18px 1fr 1fr 1fr 18px", gap:"4px", alignItems:"stretch" }}>
        <Pillar num={72}/>
        <BikeBayCell/><BikeBayCell/><BikeBayCell/>
        <Pillar num={72}/>
        {[211,210,209].map(id => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot}/>)}
        <Pillar num={71}/>
        {[208,207].map(id => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot}/>)}
        <BikeBayCell/>
        <Pillar num={70}/>
      </div>
      <div style={{ textAlign:"center", fontSize:8, color:T.sub, marginTop:8, letterSpacing:"1.5px", opacity:0.5 }}>▲ ENTRY / EXIT</div>
    </div>
  );

  if (floor.layoutType === "t4-b2") return (
    <div style={{ ...card, padding:"12px 6px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"18px 1fr 1fr 1fr 18px 1fr 1fr 1fr 1fr 18px", gap:"4px", alignItems:"stretch" }}>
        <Pillar num={64}/>
        {[189,190,191].map(id => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot}/>)}
        <Pillar num={65}/>
        {[192,193,194,195].map(id => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot}/>)}
        <Pillar num={66}/>
      </div>
      <div style={{ height:1, background:T.border, margin:"5px 0" }}/>
      <div style={{ display:"grid", gridTemplateColumns:"18px 1fr 1fr 1fr 18px 1fr 1fr 1fr 1fr 18px", gap:"4px", alignItems:"stretch" }}>
        <Pillar num={61}/>
        {[179,178,177].map(id => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot}/>)}
        <Pillar num={60}/>
        {[176,175,174].map(id => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot}/>)}
        <SpotCell blocked/>
        <Pillar num={59}/>
      </div>
      <div style={{ textAlign:"center", fontSize:8, color:T.sub, marginTop:8, letterSpacing:"1.5px", opacity:0.5 }}>▲ ENTRY / EXIT</div>
    </div>
  );
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [floorIdx,     setFloorIdx]     = useState(0);
  const [floorData,    setFloorData]    = useState({});
  const [connected,    setConnected]    = useState(false);
  const [pulse,        setPulse]        = useState(false);
  const [guardSession, setGuardSession] = useState(null);
  const [showLogin,    setShowLogin]    = useState(false);
  const [nameInput,    setNameInput]    = useState("");
  const [passInput,    setPassInput]    = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [authError,    setAuthError]    = useState("");
  const [sheet,        setSheet]        = useState(null);
  const [toast,        setToast]        = useState(null);
  const [resetIn,      setResetIn]      = useState("");
  const txRef     = useRef(null);
  const unsubRefs = useRef({});

  const floor     = FLOORS[floorIdx];
  const spots     = floorData[floor.fbKey] || mkSpots(floor.spotIds);
  const isGuard   = !!guardSession;
  const guardName = guardSession?.name;

  useEffect(() => {
    FLOORS.forEach(fl => {
      const unsub = onValue(ref(db, fl.fbKey), snap => {
        setPulse(true); setTimeout(() => setPulse(false), 400);
        setConnected(true);
        let s;
        if (!snap.exists()) { s = mkSpots(fl.spotIds); }
        else { const d = snap.val(); s = d._date !== todayKey() ? mkSpots(fl.spotIds) : { ...mkSpots(fl.spotIds), ...d.spots }; }
        setFloorData(prev => ({ ...prev, [fl.fbKey]: s }));
      }, () => setConnected(false));
      unsubRefs.current[fl.fbKey] = unsub;
    });
    return () => Object.values(unsubRefs.current).forEach(u => u());
  }, []);

  useEffect(() => {
    const tick = () => {
      const ms=msUntilReset(), s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
      setResetIn(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`);
    };
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      for (const fl of FLOORS) await set(ref(db, fl.fbKey), { spots: mkSpots(fl.spotIds), _date: todayKey() });
    }, msUntilReset());
    return () => clearTimeout(t);
  }, []);

  const showToast = (msg, color) => { setToast({ msg, color }); setTimeout(() => setToast(null), 2200); };

  const occupy = async id => {
    if (!guardName || spots[id]?.occupied) return;
    const updated = { ...spots, [id]: { ...spots[id], occupied:true, updatedBy:guardName, updatedAt:new Date().toISOString() } };
    setFloorData(p => ({ ...p, [floor.fbKey]: updated }));
    await set(ref(db, floor.fbKey), { spots: updated, _date: todayKey() });
    showToast(`Bay ${id} — Occupied`, "#ff3b30");
  };

  const release = async id => {
    if (!guardName || !spots[id]?.occupied) return;
    const updated = { ...spots, [id]: { ...spots[id], occupied:false, updatedBy:guardName, updatedAt:new Date().toISOString() } };
    setFloorData(p => ({ ...p, [floor.fbKey]: updated }));
    await set(ref(db, floor.fbKey), { spots: updated, _date: todayKey() });
    showToast(`Bay ${id} — Released`, "#34c759");
  };

  const handleLogin = () => {
    if (!nameInput.trim()) { setAuthError("Enter your name."); return; }
    if (!checkAuth(passInput)) { setAuthError("Wrong password."); setPassInput(""); return; }
    setGuardSession({ name: nameInput.trim() });
    setShowLogin(false); setAuthError(""); setPassInput("");
    showToast(`Welcome ${nameInput.trim()}! 🛡️`, "#0a84ff");
  };

  const onTS = e => { txRef.current = e.touches[0].clientX; };
  const onTE = e => {
    if (txRef.current === null) return;
    const dx = e.changedTouches[0].clientX - txRef.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && floorIdx < FLOORS.length-1) setFloorIdx(i => i+1);
      if (dx > 0 && floorIdx > 0)              setFloorIdx(i => i-1);
    }
    txRef.current = null;
  };

  const occupied  = Object.values(spots).filter(s => s.occupied).length;
  const free      = floor.totalSpots - occupied;
  const sc        = free===0 ? "#ff3b30" : free<=3 ? "#ff9500" : "#34c759";
  const sbg       = free===0 ? "#fff0f0" : free<=3 ? "#fff8f0" : "#f0fff4";
  const sbd       = free===0 ? "#ff3b3033" : free<=3 ? "#ff950033" : "#34c75933";
  const totalFree = FLOORS.reduce((a,fl) => { const s=floorData[fl.fbKey]||mkSpots(fl.spotIds); return a+(fl.totalSpots-Object.values(s).filter(x=>x.occupied).length); }, 0);
  const totalAll  = FLOORS.reduce((a,fl) => a+fl.totalSpots, 0);

  // Login screen
  if (showLogin) return (
    <div style={{ minHeight:"100dvh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px", fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif", position:"relative" }}>
      <button onClick={() => { setShowLogin(false); setAuthError(""); }} style={{ position:"absolute", top:20, left:20, background:"none", border:"none", color:"#0a84ff", fontSize:17, cursor:"pointer", fontWeight:600 }}>← Back</button>
      <div style={{ width:64, height:64, borderRadius:20, background:"linear-gradient(135deg,#ff9500,#ff6000)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, marginBottom:16, boxShadow:"0 6px 24px rgba(255,149,0,0.25)" }}>🛡️</div>
      <div style={{ fontSize:22, fontWeight:800, color:T.fg, marginBottom:4 }}>Security Guard Login</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:8 }}>Light &amp; Magic Park Live</div>
      <div style={{ fontSize:11, color:"#0a84ff", marginBottom:24, padding:"4px 14px", background:"rgba(10,132,255,0.1)", borderRadius:100, fontWeight:600 }}>✓ One login · all 3 floors</div>
      <div style={{ width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:12 }}>
        <input style={{ width:"100%", padding:"15px 16px", borderRadius:14, border:`1.5px solid ${T.inputBorder}`, background:T.card, color:T.fg, fontSize:16, outline:"none", boxSizing:"border-box" }} placeholder="Your name" value={nameInput} onChange={e => { setNameInput(e.target.value); setAuthError(""); }} autoFocus/>
        <div style={{ position:"relative" }}>
          <input style={{ width:"100%", padding:"15px 50px 15px 16px", borderRadius:14, border:`1.5px solid ${authError ? "#ff3b30" : T.inputBorder}`, background:T.card, color:T.fg, fontSize:16, outline:"none", boxSizing:"border-box" }} placeholder="Password" type={showPass ? "text" : "password"} value={passInput} onChange={e => { setPassInput(e.target.value); setAuthError(""); }} onKeyDown={e => e.key==="Enter" && handleLogin()}/>
          <button onClick={() => setShowPass(v => !v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:4, display:"flex" }}><EyeIcon open={showPass}/></button>
        </div>
        {authError && <div style={{ color:"#ff3b30", fontSize:13, fontWeight:600, textAlign:"center", padding:"8px", background:"rgba(255,59,48,0.08)", borderRadius:10 }}>{authError}</div>}
        <button style={{ padding:"16px", borderRadius:14, border:"none", background: nameInput.trim()&&passInput ? "#0a84ff" : "#e5e5ea", color: nameInput.trim()&&passInput ? "#fff" : "#aaa", fontSize:17, fontWeight:700, cursor:"pointer" }} onClick={handleLogin}>Enter Dashboard</button>
      </div>
    </div>
  );

  // Main view
  return (
    <div style={{ minHeight:"100dvh", background:T.bg, color:T.fg, fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif", paddingBottom:48, maxWidth:480, margin:"0 auto" }} onTouchStart={onTS} onTouchEnd={onTE}>

      {sheet && <BottomSheet spot={sheet} onOccupy={occupy} onRelease={release} onClose={() => setSheet(null)}/>}
      {toast  && <div style={{ position:"fixed", top:56, left:"50%", transform:"translateX(-50%)", padding:"10px 22px", borderRadius:100, background:toast.color, color:"#fff", fontWeight:700, fontSize:14, zIndex:99, whiteSpace:"nowrap", pointerEvents:"none", boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 18px 0" }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:T.fg }}>Light&amp;Magic</div>
          <div style={{ fontSize:11, color:T.sub }}>Park Live</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background: connected ? (pulse ? "#bbb" : "#34c759") : "#ff3b30", transition:"background 0.4s", boxShadow: connected&&!pulse ? "0 0 7px #34c75966" : "none" }}/>
          <span style={{ fontSize:10, color:T.sub, letterSpacing:"1px" }}>{connected ? "LIVE" : "OFFLINE"}</span>
        </div>
      </div>

      {/* All floors pill */}
      <div style={{ margin:"10px 14px 0", padding:"8px 14px", borderRadius:12, background:T.card, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
        <span style={{ fontSize:12, color:T.sub }}>All floors combined</span>
        <span style={{ fontSize:13, fontWeight:800, color: totalFree===0 ? "#ff3b30" : totalFree<=6 ? "#ff9500" : "#34c759" }}>{totalFree} / {totalAll} free</span>
      </div>

      {/* Guard bar */}
      {isGuard && (
        <div style={{ margin:"8px 14px 0", padding:"10px 14px", borderRadius:12, background:"rgba(10,132,255,0.07)", border:"1.5px solid rgba(10,132,255,0.15)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:11, color:T.sub }}>Guard session — all floors</div>
            <div style={{ fontSize:14, fontWeight:700, color:T.fg }}>🛡️ {guardName}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
            <div style={{ fontSize:10, color:"#ff9500", fontWeight:600 }}>🕛 {resetIn}</div>
            <button onClick={() => setGuardSession(null)} style={{ fontSize:11, color:"#ff3b30", background:"none", border:"none", cursor:"pointer", fontWeight:600, padding:0 }}>Log out</button>
          </div>
        </div>
      )}

      {/* Floor tabs */}
      <div style={{ display:"flex", gap:6, padding:"10px 14px 0", overflowX:"auto", scrollbarWidth:"none" }}>
        {FLOORS.map((fl,i) => {
          const s=floorData[fl.fbKey]||mkSpots(fl.spotIds);
          const f=fl.totalSpots-Object.values(s).filter(x=>x.occupied).length;
          const c=f===0?"#ff3b30":f<=3?"#ff9500":"#34c759", active=i===floorIdx;
          return (
            <button key={fl.id} onClick={() => setFloorIdx(i)} style={{ flexShrink:0, padding:"7px 14px", borderRadius:10, border:`1.5px solid ${active ? c : T.border}`, background: active ? c+"15" : T.card, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:1, transition:"all 0.2s", WebkitTapHighlightColor:"transparent", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
              <span style={{ fontSize:11, fontWeight:700, color: active ? c : T.sub }}>{fl.shortLabel}</span>
              <span style={{ fontSize:10, fontWeight:800, color:c }}>{f} free</span>
            </button>
          );
        })}
      </div>

      {/* Status hero */}
      <div style={{ margin:"10px 14px 0", borderRadius:22, background:sbg, border:`1.5px solid ${sbd}`, padding:"16px 18px", overflow:"hidden", position:"relative", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:10, fontWeight:700, color:sc, marginBottom:6, opacity:0.9 }}>{floor.label.toUpperCase()}</div>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:60, fontWeight:900, lineHeight:1, letterSpacing:"-2px", color:sc }}>{free}</div>
            <div style={{ fontSize:13, color:T.sub, marginTop:3 }}>{free===1 ? "space available" : "spaces available"}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{free===0 ? "🔴" : free<=3 ? "🟠" : "🟢"}</div>
            <div style={{ fontSize:9, fontWeight:800, color:sc, padding:"4px 10px", borderRadius:100, background:`${sc}18`, border:`1px solid ${sc}44` }}>{free===0 ? "NO SPACES" : free<=3 ? "ALMOST FULL" : "SPACES OPEN"}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:3, marginTop:10 }}>
          {floor.spotIds.map(id => <div key={id} style={{ flex:1, height:4, borderRadius:100, background: spots[id]?.occupied ? "#ff3b30" : "#34c759", transition:"background 0.3s" }}/>)}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
          <span style={{ fontSize:10, color:T.sub }}>{occupied} taken</span>
          <span style={{ fontSize:10, color:T.sub }}>{floor.totalSpots} total</span>
        </div>
      </div>

      {free===0 && <div style={{ margin:"8px 14px 0", borderRadius:12, background:"#fff0f0", border:"1.5px solid #ff3b3033", padding:"11px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:700, color:"#ff3b30" }}>🚫 This floor is full — check other floors</div></div>}
      {isGuard  && <div style={{ margin:"6px 14px 0", borderRadius:10, background:"rgba(10,132,255,0.07)", border:"1px solid rgba(10,132,255,0.15)", padding:"8px 14px", fontSize:12, color:"#0a84ff", textAlign:"center", fontWeight:500 }}>Tap any bay to mark occupied or release</div>}

      {/* Map label */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px 6px" }}>
        <div style={{ fontSize:10, fontWeight:700, color:T.sub, letterSpacing:"1.5px", textTransform:"uppercase" }}>Parking Map</div>
        <div style={{ fontSize:9, color:"#b8860b", fontWeight:600 }}>🟡 P__ = Pillar</div>
      </div>

      <FloorMap floor={floor} spots={spots} isGuard={isGuard} onTapSpot={sp => setSheet(sp)}/>

      {/* Dots */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, marginTop:16 }}>
        {FLOORS.map((_,i) => <div key={i} onClick={() => setFloorIdx(i)} style={{ width: i===floorIdx ? 18 : 6, height:6, borderRadius:100, background: i===floorIdx ? sc : T.border, cursor:"pointer", transition:"all 0.3s" }}/>)}
      </div>
      <div style={{ textAlign:"center", fontSize:10, color:T.sub, marginTop:5, opacity:0.5, paddingBottom:16 }}>← swipe or tap tabs to change floor →</div>

      <div style={{ textAlign:"center", paddingBottom:4 }}>
        <span style={{ fontSize:11, color:T.sub, opacity:0.5 }}>{connected ? "Live sync via Firebase" : "Reconnecting…"}</span>
      </div>

      {!isGuard && (
        <div style={{ textAlign:"center", paddingBottom:24, marginTop:8 }}>
          <button onClick={() => setShowLogin(true)} style={{ background:"none", border:"none", color:T.sub, fontSize:13, cursor:"pointer", opacity:0.45, padding:"8px 16px" }}>Security Guard Login</button>
        </div>
      )}
    </div>
  );
}
