import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

// ── Firebase config ───────────────────────────────────────────────────────
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

// ── Auth (obfuscated) ─────────────────────────────────────────────────────
const _a = [52,48,48,48,54,50].map(c => String.fromCharCode(c)).join("");
const checkAuth = (p) => p === _a;

// ── Constants ─────────────────────────────────────────────────────────────
const TOTAL_SPOTS = 12;
const ROW1 = [null, null, null, null, 1, 2, 3, 4];
const ROW2 = [12, 11, 10, 9, 8, 7, 6, 5];

// ── Helpers ───────────────────────────────────────────────────────────────
const mkSpots = () =>
  Object.fromEntries(Array.from({ length: TOTAL_SPOTS }, (_, i) => [
    i + 1, { id: i + 1, occupied: false, updatedBy: null, updatedAt: null }
  ]));

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function msUntilReset() {
  const now = new Date(), r = new Date(now);
  r.setHours(23, 59, 0, 0);
  if (r <= now) r.setDate(r.getDate() + 1);
  return r - now;
}

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

// ── Car SVG ───────────────────────────────────────────────────────────────
const CarSVG = ({ color = "#ff6b6b", size = 56 }) => (
  <svg width={size} height={size * 0.55} viewBox="0 0 80 44" fill="none">
    <rect x="3" y="18" width="74" height="20" rx="6" fill={color} />
    <path d="M13 18 L22 5 H58 L67 18Z" fill={color} opacity="0.88" />
    <rect x="23" y="7" width="11" height="9" rx="2" fill="#000" opacity="0.35" />
    <rect x="46" y="7" width="11" height="9" rx="2" fill="#000" opacity="0.35" />
    <circle cx="18" cy="38" r="6.5" fill="#1a1a1a" stroke={color} strokeWidth="2.5" />
    <circle cx="62" cy="38" r="6.5" fill="#1a1a1a" stroke={color} strokeWidth="2.5" />
    <rect x="50" y="21" width="14" height="6" rx="2" fill="#000" opacity="0.2" />
    <rect x="3" y="25" width="74" height="2" rx="1" fill="#000" opacity="0.08" />
  </svg>
);

// ── Eye icon ──────────────────────────────────────────────────────────────
const EyeIcon = ({ open }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open
      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
      : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
    }
  </svg>
);

// ── Bottom Sheet ──────────────────────────────────────────────────────────
const BottomSheet = ({ spot, onOccupy, onRelease, onClose, isDark }) => {
  if (!spot) return null;
  const occ = spot.occupied;
  const bg = isDark ? "#1c1c1e" : "#ffffff";
  const fg = isDark ? "#ffffff" : "#000000";
  const sub = isDark ? "#8e8e93" : "#6c6c70";
  const div = isDark ? "#2c2c2e" : "#e5e5ea";
  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end" }}
      onClick={onClose}>
      <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(6px)" }} />
      <div style={{ position:"relative",background:bg,borderRadius:"24px 24px 0 0",padding:"12px 0 44px",boxShadow:"0 -8px 48px rgba(0,0,0,0.35)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width:36,height:4,borderRadius:2,background:sub,margin:"0 auto 22px",opacity:0.35 }} />
        <div style={{ padding:"0 24px 20px",borderBottom:`1px solid ${div}` }}>
          <div style={{ fontSize:12,fontWeight:700,color:sub,letterSpacing:"1px",marginBottom:6,textTransform:"uppercase" }}>
            Bay {String(spot.id).padStart(2, "0")}
          </div>
          <div style={{ fontSize:22,fontWeight:800,color:fg }}>
            {occ ? "Currently Occupied" : "Currently Free"}
          </div>
          {occ && spot.updatedBy && (
            <div style={{ fontSize:14,color:sub,marginTop:5 }}>
              Marked by <b style={{ color:fg }}>{spot.updatedBy}</b> at {fmt(spot.updatedAt)}
            </div>
          )}
        </div>
        <div style={{ padding:"18px 24px 0",display:"flex",flexDirection:"column",gap:12 }}>
          {!occ && (
            <button style={{ padding:"17px",borderRadius:16,border:"none",background:"#ff3b30",color:"#fff",fontSize:17,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}
              onClick={() => { onOccupy(spot.id); onClose(); }}>
              🚗  Mark as Occupied
            </button>
          )}
          {occ && (
            <button style={{ padding:"17px",borderRadius:16,border:"none",background:"#34c759",color:"#fff",fontSize:17,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}
              onClick={() => { onRelease(spot.id); onClose(); }}>
              ✅  Release This Bay
            </button>
          )}
          <button style={{ padding:"17px",borderRadius:16,border:`1.5px solid ${div}`,background:"transparent",color:sub,fontSize:16,fontWeight:600,cursor:"pointer" }}
            onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [fbLoaded, setFbLoaded] = useState(false);
  const [mode, setMode] = useState("driver");
  const [guardName, setGuardName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [authError, setAuthError] = useState("");
  const [spots, setSpots] = useState(mkSpots());
  const [connected, setConnected] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [toast, setToast] = useState(null);
  const [resetIn, setResetIn] = useState("");
  const [sheet, setSheet] = useState(null);
  const [isDark, setIsDark] = useState(true);
  const unsubRef = useRef(null);

  // ── System theme ──────────────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const h = (e) => setIsDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // ── Firebase ready immediately (npm package) ─────────────────────────────
  useEffect(() => { setFbLoaded(true); }, []);

  // ── Subscribe to Firebase live updates ───────────────────────────────────
  useEffect(() => {
    if (!fbLoaded || mode === "guard-login") return;
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }

    const parkRef = ref(db, "parking");
    const unsub = onValue(parkRef, (snap) => {
      setPulse(true); setTimeout(() => setPulse(false), 400);
      setConnected(true);
      if (!snap.exists()) { setSpots(mkSpots()); return; }
      const data = snap.val();
      if (data._date !== todayKey()) { setSpots(mkSpots()); return; }
      setSpots({ ...mkSpots(), ...data.spots });
    }, (err) => {
      console.error("Firebase error:", err);
      setConnected(false);
    });

    unsubRef.current = unsub;
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [fbLoaded, mode]);

  // ── Reset countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const ms = msUntilReset(), s = Math.floor(ms / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      setResetIn(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Auto-wipe at 23:59 ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(async () => {
      await set(ref(db, "parking"), { spots: mkSpots(), _date: todayKey() });
    }, msUntilReset());
    return () => clearTimeout(t);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const showToast = (msg, color) => {
    setToast({ msg, color }); setTimeout(() => setToast(null), 2200);
  };

  const occupy = async (id) => {
    if (!guardName || spots[id]?.occupied) return;
    const updated = {
      ...spots,
      [id]: { ...spots[id], occupied: true, updatedBy: guardName, updatedAt: new Date().toISOString() }
    };
    setSpots(updated);
    await set(ref(db, "parking"), { spots: updated, _date: todayKey() });
    showToast(`Bay ${id} — Occupied`, "#ff3b30");
  };

  const release = async (id) => {
    if (!guardName || !spots[id]?.occupied) return;
    const updated = {
      ...spots,
      [id]: { ...spots[id], occupied: false, updatedBy: guardName, updatedAt: new Date().toISOString() }
    };
    setSpots(updated);
    await set(ref(db, "parking"), { spots: updated, _date: todayKey() });
    showToast(`Bay ${id} — Released`, "#34c759");
  };

  const handleGuardLogin = () => {
    if (!nameInput.trim()) { setAuthError("Please enter your name."); return; }
    if (!checkAuth(passInput)) { setAuthError("Incorrect password. Try again."); setPassInput(""); return; }
    setAuthError(""); setGuardName(nameInput.trim()); setMode("guard");
  };

  const handleGuardLogout = () => {
    setGuardName(""); setNameInput(""); setPassInput(""); setMode("driver");
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const occupied = Object.values(spots).filter(s => s.occupied).length;
  const free = TOTAL_SPOTS - occupied;
  const isGuard = mode === "guard";
  const statusColor = free === 0 ? "#ff3b30" : free <= 3 ? "#ff9500" : "#34c759";
  const statusBg = free === 0
    ? (isDark ? "#2a0808" : "#fff1f0")
    : free <= 3
    ? (isDark ? "#2a1800" : "#fff8ed")
    : (isDark ? "#082a0e" : "#f0fff4");
  const statusLabel = free === 0 ? "NO SPACES" : free <= 3 ? "ALMOST FULL" : "SPACES OPEN";
  const statusEmoji = free === 0 ? "🔴" : free <= 3 ? "🟠" : "🟢";

  const T = {
    bg:          isDark ? "#000000" : "#f2f2f7",
    card:        isDark ? "#1c1c1e" : "#ffffff",
    fg:          isDark ? "#ffffff" : "#000000",
    sub:         isDark ? "#8e8e93" : "#6c6c70",
    border:      isDark ? "#2c2c2e" : "#e5e5ea",
    inputBg:     isDark ? "#1c1c1e" : "#ffffff",
    inputBorder: isDark ? "#3a3a3c" : "#c7c7cc",
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!fbLoaded) return (
    <div style={{ minHeight:"100dvh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"-apple-system,sans-serif" }}>
      <div style={{ width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#0a84ff,#34c759)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28 }}>🅿️</div>
      <div style={{ fontSize:18,fontWeight:700,color:T.fg }}>Light&amp;Magic Park Live</div>
      <div style={{ fontSize:14,color:T.sub }}>Connecting to live data…</div>
      <div style={{ display:"flex",gap:6,marginTop:4 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:8,height:8,borderRadius:"50%",background:T.sub,opacity:0.4,animation:`pulse 1.2s ${i*0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.2}50%{opacity:1}}`}</style>
    </div>
  );

  // ── Guard Login ───────────────────────────────────────────────────────────
  if (mode === "guard-login") return (
    <div style={{ minHeight:"100dvh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",position:"relative" }}>
      <button onClick={() => setMode("driver")} style={{ position:"absolute",top:20,left:20,background:"none",border:"none",color:"#0a84ff",fontSize:17,cursor:"pointer",fontWeight:600 }}>
        ← Back
      </button>
      <div style={{ width:72,height:72,borderRadius:22,background:"linear-gradient(135deg,#ff9500,#ff6000)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,marginBottom:20,boxShadow:"0 8px 32px rgba(255,149,0,0.3)" }}>
        🛡️
      </div>
      <div style={{ fontSize:26,fontWeight:800,color:T.fg,marginBottom:4 }}>Security Guard</div>
      <div style={{ fontSize:15,color:T.sub,marginBottom:32 }}>Light &amp; Magic Park Live</div>

      <div style={{ width:"100%",maxWidth:360,display:"flex",flexDirection:"column",gap:12 }}>
        <input
          style={{ width:"100%",padding:"16px 18px",borderRadius:14,border:`1.5px solid ${T.inputBorder}`,background:T.inputBg,color:T.fg,fontSize:17,outline:"none",boxSizing:"border-box",WebkitAppearance:"none" }}
          placeholder="Your name"
          value={nameInput}
          onChange={e => { setNameInput(e.target.value); setAuthError(""); }}
          autoFocus
        />
        <div style={{ position:"relative" }}>
          <input
            style={{ width:"100%",padding:"16px 52px 16px 18px",borderRadius:14,border:`1.5px solid ${authError ? "#ff3b30" : T.inputBorder}`,background:T.inputBg,color:T.fg,fontSize:17,outline:"none",boxSizing:"border-box",WebkitAppearance:"none" }}
            placeholder="Password"
            type={showPass ? "text" : "password"}
            value={passInput}
            onChange={e => { setPassInput(e.target.value); setAuthError(""); }}
            onKeyDown={e => e.key === "Enter" && handleGuardLogin()}
          />
          <button onClick={() => setShowPass(v => !v)}
            style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center" }}>
            <EyeIcon open={showPass} />
          </button>
        </div>
        {authError && (
          <div style={{ color:"#ff3b30",fontSize:14,fontWeight:600,textAlign:"center",padding:"8px 12px",background:"rgba(255,59,48,0.1)",borderRadius:10 }}>
            {authError}
          </div>
        )}
        <button
          style={{ padding:"17px",borderRadius:14,border:"none",background: nameInput.trim() && passInput ? "#0a84ff" : T.border,color: nameInput.trim() && passInput ? "#fff" : T.sub,fontSize:17,fontWeight:700,cursor:"pointer",transition:"all 0.2s",marginTop:4 }}
          onClick={handleGuardLogin}>
          Enter Dashboard
        </button>
      </div>
    </div>
  );

  // ── Spot cell ─────────────────────────────────────────────────────────────
  const SpotCell = ({ id }) => {
    if (!id) return <div style={{ minHeight:100 }} />;
    const sp = spots[id];
    const occ = sp?.occupied;
    return (
      <div
        onClick={() => isGuard && setSheet(sp)}
        onTouchStart={e => { if (isGuard) e.currentTarget.style.transform = "scale(0.92)"; }}
        onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; }}
        style={{
          borderRadius:14, minHeight:100, padding:"8px 4px 6px",
          display:"flex", flexDirection:"column", alignItems:"center",
          background: occ
            ? (isDark ? "linear-gradient(160deg,#2a0808,#170202)" : "linear-gradient(160deg,#fff0f0,#ffe4e4)")
            : (isDark ? "linear-gradient(160deg,#0a1f0a,#020d02)" : "linear-gradient(160deg,#f0fff4,#e4ffe9)"),
          border:`2px solid ${occ ? (isDark?"#ff3b3055":"#ff3b3077") : (isDark?"#34c75944":"#34c75966")}`,
          boxShadow: occ ? "0 0 14px rgba(255,59,48,0.1)" : "0 0 10px rgba(52,199,89,0.07)",
          cursor: isGuard ? "pointer" : "default",
          userSelect:"none", WebkitTapHighlightColor:"transparent",
          transition:"transform 0.15s, border-color 0.3s, background 0.3s",
          position:"relative", overflow:"hidden",
        }}>
        {/* Bay number */}
        <div style={{ fontSize:11,fontWeight:800,color: occ?(isDark?"#ff6b6b88":"#ff3b3077"):(isDark?"#34c75977":"#34c75999"),marginBottom:4 }}>
          {String(id).padStart(2,"0")}
        </div>
        {/* Content */}
        {occ ? (
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,flex:1,justifyContent:"center" }}>
            <CarSVG color={isDark ? "#ff6060" : "#ff3b30"} size={44} />
            {sp?.updatedBy && (
              <div style={{ fontSize:8,fontWeight:700,color:isDark?"#ff3b3088":"#ff3b3066",textAlign:"center",lineHeight:1.3,marginTop:2 }}>
                <div>{sp.updatedBy}</div>
                {sp.updatedAt && <div>{fmt(sp.updatedAt)}</div>}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:5 }}>
            <div style={{ display:"flex",flexDirection:"column",gap:5,width:"58%",alignItems:"center" }}>
              <div style={{ width:"100%",height:2,borderRadius:1,background:isDark?"rgba(52,199,89,0.18)":"rgba(52,199,89,0.28)" }} />
              <div style={{ width:"100%",height:2,borderRadius:1,background:isDark?"rgba(52,199,89,0.18)":"rgba(52,199,89,0.28)" }} />
            </div>
            <div style={{ fontSize:8,fontWeight:700,letterSpacing:"0.8px",color:isDark?"rgba(52,199,89,0.4)":"rgba(52,199,89,0.55)" }}>FREE</div>
          </div>
        )}
        {/* Guard dot indicator */}
        {isGuard && (
          <div style={{ position:"absolute",bottom:4,right:5,width:5,height:5,borderRadius:"50%",background:occ?"#ff3b30":"#34c759",opacity:0.55 }} />
        )}
      </div>
    );
  };

  // ── Main View ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100dvh",background:T.bg,color:T.fg,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",paddingBottom:48,maxWidth:480,margin:"0 auto",position:"relative" }}>

      {sheet && (
        <BottomSheet spot={sheet} onOccupy={occupy} onRelease={release} onClose={() => setSheet(null)} isDark={isDark} />
      )}

      {toast && (
        <div style={{ position:"fixed",top:56,left:"50%",transform:"translateX(-50%)",padding:"10px 22px",borderRadius:100,background:toast.color,color:"#fff",fontWeight:700,fontSize:14,zIndex:99,boxShadow:"0 4px 24px rgba(0,0,0,0.25)",whiteSpace:"nowrap",pointerEvents:"none" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 18px 0" }}>
        <div>
          <div style={{ fontSize:14,fontWeight:800,letterSpacing:"-0.3px",color:T.fg }}>Light&amp;Magic</div>
          <div style={{ fontSize:11,color:T.sub,marginTop:1 }}>Park Live</div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          <div style={{ width:7,height:7,borderRadius:"50%",
            background: connected ? (pulse?"#aaa":"#34c759") : "#ff3b30",
            transition:"background 0.4s",
            boxShadow: connected && !pulse ? "0 0 7px #34c75977" : "none" }} />
          <span style={{ fontSize:10,color:T.sub,letterSpacing:"1px" }}>
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Status Hero */}
      <div style={{ margin:"14px 14px 0",borderRadius:24,background:statusBg,border:`1.5px solid ${statusColor}2e`,padding:"22px 20px",overflow:"hidden",position:"relative" }}>
        <div style={{ position:"absolute",right:-24,top:-24,width:130,height:130,borderRadius:"50%",background:`${statusColor}09` }} />
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",position:"relative" }}>
          <div>
            <div style={{ fontSize:76,fontWeight:900,lineHeight:1,letterSpacing:"-3px",color:statusColor }}>{free}</div>
            <div style={{ fontSize:15,color:T.sub,marginTop:4,fontWeight:500 }}>
              {free === 1 ? "space available" : "spaces available"}
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:30,marginBottom:10 }}>{statusEmoji}</div>
            <div style={{ fontSize:10,fontWeight:800,letterSpacing:"1px",color:statusColor,padding:"5px 12px",borderRadius:100,background:`${statusColor}18`,border:`1px solid ${statusColor}44` }}>
              {statusLabel}
            </div>
          </div>
        </div>
        <div style={{ display:"flex",gap:4,marginTop:16 }}>
          {Object.values(spots).map(sp => (
            <div key={sp.id} style={{ flex:1,height:5,borderRadius:100,background:sp.occupied?"#ff3b30":"#34c759",transition:"background 0.4s" }} />
          ))}
        </div>
        <div style={{ display:"flex",justifyContent:"space-between",marginTop:5 }}>
          <span style={{ fontSize:11,color:T.sub }}>{occupied} taken</span>
          <span style={{ fontSize:11,color:T.sub }}>{TOTAL_SPOTS} total bays</span>
        </div>
      </div>

      {/* Full alert */}
      {free === 0 && (
        <div style={{ margin:"10px 14px 0",borderRadius:16,background:"rgba(255,59,48,0.1)",border:"1.5px solid rgba(255,59,48,0.25)",padding:"14px 18px",textAlign:"center" }}>
          <div style={{ fontSize:15,fontWeight:700,color:"#ff3b30" }}>🚫 Car park is full</div>
          <div style={{ fontSize:13,color:T.sub,marginTop:3 }}>Please check back in a few minutes</div>
        </div>
      )}

      {/* Guard strip */}
      {isGuard && (
        <div style={{ margin:"10px 14px 0",borderRadius:14,background:T.card,border:`1px solid ${T.border}`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:12,color:T.sub }}>Logged in as</div>
            <div style={{ fontSize:15,fontWeight:700,color:T.fg }}>🛡️ {guardName}</div>
          </div>
          <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5 }}>
            <div style={{ fontSize:11,color:"#ff9500",fontWeight:600 }}>🕛 Reset in {resetIn}</div>
            <button onClick={handleGuardLogout} style={{ fontSize:12,color:"#ff3b30",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0 }}>
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Guard hint */}
      {isGuard && (
        <div style={{ margin:"8px 14px 0",borderRadius:12,background:isDark?"rgba(10,132,255,0.09)":"rgba(10,132,255,0.06)",border:"1px solid rgba(10,132,255,0.18)",padding:"10px 16px",fontSize:13,color:"#0a84ff",textAlign:"center",fontWeight:500 }}>
          Tap any bay to mark occupied or release
        </div>
      )}

      {/* Map */}
      <div style={{ fontSize:11,fontWeight:700,color:T.sub,letterSpacing:"1.5px",padding:"18px 18px 10px",textTransform:"uppercase" }}>
        Parking Map
      </div>

      <div style={{ margin:"0 12px",padding:"14px 10px 14px",background:T.card,borderRadius:22,border:`1px solid ${T.border}` }}>

        {/* Row 1 — spots 1–4 with pillar gap */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 10px 1fr 1fr 1fr 1fr",gap:"6px" }}>
          {ROW1.map((id, i) => {
            if (i === 4) return [
              <div key="p-r1" style={{ width:10 }} />,
              <SpotCell key={`r1-${i}`} id={id} />
            ];
            return <SpotCell key={`r1-${i}`} id={id} />;
          })}
        </div>

        {/* Divider line */}
        <div style={{ height:1,background:T.border,margin:"8px 0" }} />

        {/* Row 2 — spots 12,11,10,9 | PILLAR | 8,7,6,5 */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 10px 1fr 1fr 1fr 1fr",gap:"6px",alignItems:"stretch" }}>
          {[12,11,10,9].map(id => <SpotCell key={`r2-${id}`} id={id} />)}
          <div style={{ display:"flex",alignItems:"stretch",justifyContent:"center" }}>
            <div style={{ width:10,borderRadius:4,background:isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.07)",border:`1px solid ${isDark?"rgba(255,255,255,0.09)":"rgba(0,0,0,0.1)"}`,display:"flex",alignItems:"center",justifyContent:"center" }}>
              <div style={{ width:3,height:"55%",borderRadius:2,background:isDark?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.12)" }} />
            </div>
          </div>
          {[8,7,6,5].map(id => <SpotCell key={`r2-${id}`} id={id} />)}
        </div>

        <div style={{ textAlign:"center",fontSize:9,color:T.sub,marginTop:10,letterSpacing:"1.5px",opacity:0.4 }}>
          ▲ ENTRY / EXIT
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign:"center",marginTop:14 }}>
        <span style={{ fontSize:11,color:T.sub,opacity:0.6 }}>
          {connected ? "Live sync via Firebase" : "Reconnecting…"}
        </span>
      </div>

      {/* Guard login link */}
      {!isGuard && (
        <div style={{ textAlign:"center",marginTop:20 }}>
          <button onClick={() => setMode("guard-login")} style={{ background:"none",border:"none",color:T.sub,fontSize:13,cursor:"pointer",opacity:0.45,padding:"8px 16px" }}>
            Security Guard Login
          </button>
        </div>
      )}
    </div>
  );
}
