import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

// ── Firebase ──────────────────────────────────────────────────────────────
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

const _a = [52, 48, 48, 48, 54, 50].map((c) => String.fromCharCode(c)).join("");
const checkAuth = (p) => p === _a;

const FLOORS = [
  { id: "t3-2f", label: "Tower 3 · 2nd Floor", shortLabel: "T3 · 2F", fbKey: "parking", totalSpots: 12, spotIds: [1,2,3,4,5,6,7,8,9,10,11,12], layoutType: "t3-2f" },
  { id: "t4-b1", label: "Tower 4 · Basement 1", shortLabel: "T4 · B1", fbKey: "parking-t4-b1", totalSpots: 9, spotIds: [214,213,212,211,210,209,208,207,206], layoutType: "t4-b1" },
  { id: "t4-b2", label: "Tower 4 · Basement 2", shortLabel: "T4 · B2", fbKey: "parking-t4-b2", totalSpots: 13, spotIds: [189,190,191,192,193,194,195,179,178,177,176,175,174], layoutType: "t4-b2" },
];

const BIKE_BAYS = new Set([214, 213, 212, 206]);

const mkSpots = (ids) => Object.fromEntries(ids.map((id) => [id, { id, occupied: false, updatedBy: null, updatedAt: null }]));
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
function msUntilReset() { const now = new Date(), r = new Date(now); r.setHours(23, 59, 0, 0); if (r <= now) r.setDate(r.getDate() + 1); return r - now; }

// ── SVGs ──────────────────────────────────────────────────────────────────
const CarSVG = ({ color = "#ff6060", size = 36 }) => (
  <svg width={size} height={size * 0.55} viewBox="0 0 80 44" fill="none">
    <rect x="3" y="18" width="74" height="20" rx="6" fill={color} />
    <path d="M13 18 L22 5 H58 L67 18Z" fill={color} opacity="0.88" />
    <rect x="23" y="7" width="11" height="9" rx="2" fill="#000" opacity="0.35" />
    <rect x="46" y="7" width="11" height="9" rx="2" fill="#000" opacity="0.35" />
    <circle cx="18" cy="38" r="6.5" fill="#1a1a1a" stroke={color} strokeWidth="2.5" />
    <circle cx="62" cy="38" r="6.5" fill="#1a1a1a" stroke={color} strokeWidth="2.5" />
  </svg>
);

const BikeSVG = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(60,180,60,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M15 6h-5l-3 7h11l-3-7z" />
    <path d="M5.5 17.5L9 10" />
    <path d="M18.5 17.5L15 6" />
    <path d="M9 10h6" />
  </svg>
);

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>) : (<><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>)}
  </svg>
);

// ── Pillar ────────────────────────────────────────────────────────────────
const Pillar = ({ num }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "stretch", gap: 0 }}>
    {num && (
      <div style={{ fontSize: 7, fontWeight: 800, color: "rgba(255,200,50,0.8)", letterSpacing: "0.3px", marginBottom: 2, textAlign: "center" }}>
        P{num}
      </div>
    )}
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,200,50,0.07)", border: "1px solid rgba(255,200,50,0.2)", borderRadius: 4, minHeight: 60, width: 10 }}>
      <div style={{ width: 4, height: "50%", borderRadius: 2, background: "rgba(255,200,50,0.3)" }} />
    </div>
  </div>
);

// ── Spot Cell ─────────────────────────────────────────────────────────────
const SpotCell = ({ id, spots, isGuard, onTap, blocked = false, empty = false }) => {
  if (empty) return <div />;
  if (blocked) return (
    <div style={{ borderRadius: 10, minHeight: 78, background: "rgba(255,149,0,0.1)", border: "2px solid rgba(255,149,0,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
      <div style={{ fontSize: 12 }}>🚧</div>
      <div style={{ fontSize: 6.5, fontWeight: 700, color: "rgba(255,149,0,0.7)" }}>RESERVED</div>
    </div>
  );

  const isBike = BIKE_BAYS.has(id);
  const sp = spots?.[id], occ = sp?.occupied;

  if (isBike) return (
    <div onClick={() => isGuard && onTap(sp || { id, occupied: false, updatedBy: null, updatedAt: null })}
      style={{ borderRadius: 10, minHeight: 78, padding: "5px 3px 4px", display: "flex", flexDirection: "column", alignItems: "center",
        background: "linear-gradient(160deg,#071f07,#031003)",
        backgroundImage: "repeating-linear-gradient(45deg,rgba(52,180,52,0.12) 0px,rgba(52,180,52,0.12) 5px,transparent 5px,transparent 13px)",
        border: `2px solid ${occ ? "#34c75988" : "#34c75933"}`,
        cursor: isGuard ? "pointer" : "default", userSelect: "none", position: "relative", overflow: "hidden" }}>
      <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(52,199,89,0.5)", marginBottom: 2 }}>{id}</div>
      {occ ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1, justifyContent: "center" }}>
          <BikeSVG size={24} />
          {sp?.updatedBy && <div style={{ fontSize: 6, fontWeight: 700, color: "rgba(52,199,89,0.7)", textAlign: "center", lineHeight: 1.3 }}><div>{sp.updatedBy}</div></div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 3 }}>
          <BikeSVG size={22} />
          <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.5px", color: "rgba(52,199,89,0.4)" }}>BIKE</div>
        </div>
      )}
      {isGuard && <div style={{ position: "absolute", bottom: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: occ ? "#ff3b30" : "#34c759", opacity: 0.6 }} />}
    </div>
  );

  return (
    <div onClick={() => isGuard && onTap(sp || { id, occupied: false, updatedBy: null, updatedAt: null })}
      style={{ borderRadius: 10, minHeight: 78, padding: "5px 3px 4px", display: "flex", flexDirection: "column", alignItems: "center",
        background: occ ? "linear-gradient(160deg,#2a0808,#170202)" : "linear-gradient(160deg,#0a1f0a,#020d02)",
        border: `2px solid ${occ ? "#ff3b3055" : "#34c75944"}`,
        cursor: isGuard ? "pointer" : "default", userSelect: "none", position: "relative", overflow: "hidden", transition: "border-color 0.3s" }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: occ ? "#ff6b6b66" : "#34c75966", marginBottom: 2 }}>{id}</div>
      {occ ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, flex: 1, justifyContent: "center" }}>
          <CarSVG />
          {sp?.updatedBy && <div style={{ fontSize: 6, fontWeight: 700, color: "#ff3b3088", textAlign: "center", lineHeight: 1.3 }}><div>{sp.updatedBy}</div><div>{fmt(sp.updatedAt)}</div></div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 3 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "52%" }}>
            <div style={{ height: 2, borderRadius: 1, background: "rgba(52,199,89,0.2)" }} />
            <div style={{ height: 2, borderRadius: 1, background: "rgba(52,199,89,0.2)" }} />
          </div>
          <div style={{ fontSize: 6.5, fontWeight: 700, color: "rgba(52,199,89,0.45)" }}>FREE</div>
        </div>
      )}
      {isGuard && <div style={{ position: "absolute", bottom: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: occ ? "#ff3b30" : "#34c759", opacity: 0.6 }} />}
    </div>
  );
};

// ── Bottom Sheet ──────────────────────────────────────────────────────────
const BottomSheet = ({ spot, onOccupy, onRelease, onClose }) => {
  if (!spot) return null;
  const occ = spot.occupied, isBike = BIKE_BAYS.has(spot.id);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }} />
      <div style={{ position: "relative", background: "#1c1c1e", borderRadius: "22px 22px 0 0", padding: "10px 0 44px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 32, height: 4, borderRadius: 2, background: "#555", margin: "0 auto 18px", opacity: 0.5 }} />
        <div style={{ padding: "0 22px 14px", borderBottom: "1px solid #2c2c2e" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8e8e93", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>
            {isBike ? "🚲 Bike Bay" : "Bay"} {spot.id}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{occ ? "Currently Occupied" : "Currently Free"}</div>
          {occ && spot.updatedBy && <div style={{ fontSize: 13, color: "#8e8e93", marginTop: 3 }}>By <b style={{ color: "#fff" }}>{spot.updatedBy}</b> at {fmt(spot.updatedAt)}</div>}
        </div>
        <div style={{ padding: "12px 22px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {!occ && <button style={{ padding: "14px", borderRadius: 14, border: "none", background: isBike ? "#34c759" : "#ff3b30", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }} onClick={() => { onOccupy(spot.id); onClose(); }}>{isBike ? "🚲  Mark Bike Bay Occupied" : "🚗  Mark as Occupied"}</button>}
          {occ && <button style={{ padding: "14px", borderRadius: 14, border: "none", background: "#34c759", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }} onClick={() => { onRelease(spot.id); onClose(); }}>✅  Release This Bay</button>}
          <button style={{ padding: "14px", borderRadius: 14, border: "1.5px solid #2c2c2e", background: "transparent", color: "#8e8e93", fontSize: 15, fontWeight: 600, cursor: "pointer" }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ── Floor Map ─────────────────────────────────────────────────────────────
const FloorMap = ({ floor, spots, isGuard, onTapSpot }) => {
  const T = { card: "#1c1c1e", border: "#2c2c2e", sub: "#8e8e93" };

  if (floor.layoutType === "t3-2f") return (
    <div style={{ margin: "0 10px", padding: "12px 8px", background: T.card, borderRadius: 20, border: `1px solid ${T.border}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 18px 1fr 1fr 1fr 1fr", gap: "5px" }}>
        {[null, null, null, null].map((_, i) => <SpotCell key={`e${i}`} empty={true} />)}
        <div />
        {[1, 2, 3, 4].map((id) => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot} />)}
      </div>
      <div style={{ height: 1, background: T.border, margin: "7px 0" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 18px 1fr 1fr 1fr 1fr", gap: "5px", alignItems: "stretch" }}>
        {[12, 11, 10, 9].map((id) => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot} />)}
        <Pillar />
        {[8, 7, 6, 5].map((id) => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot} />)}
      </div>
      <div style={{ textAlign: "center", fontSize: 8, color: T.sub, marginTop: 8, letterSpacing: "1.5px", opacity: 0.4 }}>▲ ENTRY / EXIT</div>
    </div>
  );

  if (floor.layoutType === "t4-b1") return (
    <div style={{ margin: "0 10px", padding: "12px 8px", background: T.card, borderRadius: 20, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 9, color: "#34c759", fontWeight: 700, letterSpacing: "0.5px", marginBottom: 8, textAlign: "center", opacity: 0.7 }}>
        🚲 Striped green bays = Bike parking only
      </div>
      {/* P72 | 214,213,212 | P72 | 211,210,209 | P71 | 208,207,206 | P70 */}
      <div style={{ display: "grid", gridTemplateColumns: "18px 1fr 1fr 1fr 18px 1fr 1fr 1fr 18px 1fr 1fr 1fr 18px", gap: "4px", alignItems: "stretch" }}>
        <Pillar num={72} />
        {[214, 213, 212].map((id) => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot} />)}
        <Pillar num={72} />
        {[211, 210, 209].map((id) => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot} />)}
        <Pillar num={71} />
        {[208, 207, 206].map((id) => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot} />)}
        <Pillar num={70} />
      </div>
      <div style={{ textAlign: "center", fontSize: 8, color: T.sub, marginTop: 8, letterSpacing: "1.5px", opacity: 0.4 }}>▲ ENTRY / EXIT</div>
    </div>
  );

  if (floor.layoutType === "t4-b2") return (
    <div style={{ margin: "0 10px", padding: "12px 6px", background: T.card, borderRadius: 20, border: `1px solid ${T.border}` }}>
      {/* Row1: P64 | 189,190,191 | P65 | 192,193,194,195 | P66 */}
      <div style={{ display: "grid", gridTemplateColumns: "18px 1fr 1fr 1fr 18px 1fr 1fr 1fr 1fr 18px", gap: "4px", alignItems: "stretch" }}>
        <Pillar num={64} />
        {[189, 190, 191].map((id) => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot} />)}
        <Pillar num={65} />
        {[192, 193, 194, 195].map((id) => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot} />)}
        <Pillar num={66} />
      </div>
      <div style={{ height: 1, background: T.border, margin: "5px 0" }} />
      {/* Row2: P61 | 179,178,177 | P60 | 176,175,174,BLOCKED | P59 */}
      <div style={{ display: "grid", gridTemplateColumns: "18px 1fr 1fr 1fr 18px 1fr 1fr 1fr 1fr 18px", gap: "4px", alignItems: "stretch" }}>
        <Pillar num={61} />
        {[179, 178, 177].map((id) => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot} />)}
        <Pillar num={60} />
        {[176, 175, 174].map((id) => <SpotCell key={id} id={id} spots={spots} isGuard={isGuard} onTap={onTapSpot} />)}
        <SpotCell blocked={true} />
        <Pillar num={59} />
      </div>
      <div style={{ textAlign: "center", fontSize: 8, color: T.sub, marginTop: 8, letterSpacing: "1.5px", opacity: 0.4 }}>▲ ENTRY / EXIT</div>
    </div>
  );
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [floorIdx, setFloorIdx] = useState(0);
  const [floorData, setFloorData] = useState({});
  const [connected, setConnected] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [guardSession, setGuardSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [authError, setAuthError] = useState("");
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [resetIn, setResetIn] = useState("");
  const txRef = useRef(null);
  const unsubRefs = useRef({});

  const floor = FLOORS[floorIdx];
  const spots = floorData[floor.fbKey] || mkSpots(floor.spotIds);
  const isGuard = !!guardSession;
  const guardName = guardSession?.name;

  // ── Subscribe ALL floors ──────────────────────────────────────────────
  useEffect(() => {
    FLOORS.forEach((fl) => {
      const parkRef = ref(db, fl.fbKey);
      const unsub = onValue(parkRef, (snap) => {
        setPulse(true); setTimeout(() => setPulse(false), 400);
        setConnected(true);
        let s;
        if (!snap.exists()) { s = mkSpots(fl.spotIds); }
        else { const data = snap.val(); s = data._date !== todayKey() ? mkSpots(fl.spotIds) : { ...mkSpots(fl.spotIds), ...data.spots }; }
        setFloorData((prev) => ({ ...prev, [fl.fbKey]: s }));
      }, () => setConnected(false));
      unsubRefs.current[fl.fbKey] = unsub;
    });
    return () => Object.values(unsubRefs.current).forEach((u) => u());
  }, []);

  // ── Reset countdown ───────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const ms = msUntilReset(), s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      setResetIn(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`);
    };
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  // ── Auto-reset all floors at 23:59 ────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(async () => {
      for (const fl of FLOORS) await set(ref(db, fl.fbKey), { spots: mkSpots(fl.spotIds), _date: todayKey() });
    }, msUntilReset());
    return () => clearTimeout(t);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────
  const showToast = (msg, color) => { setToast({ msg, color }); setTimeout(() => setToast(null), 2200); };

  const occupy = async (id) => {
    if (!guardName || spots[id]?.occupied) return;
    const updated = { ...spots, [id]: { ...spots[id], occupied: true, updatedBy: guardName, updatedAt: new Date().toISOString() } };
    setFloorData((p) => ({ ...p, [floor.fbKey]: updated }));
    await set(ref(db, floor.fbKey), { spots: updated, _date: todayKey() });
    showToast(`Bay ${id} — Occupied`, "#ff3b30");
  };

  const release = async (id) => {
    if (!guardName || !spots[id]?.occupied) return;
    const updated = { ...spots, [id]: { ...spots[id], occupied: false, updatedBy: guardName, updatedAt: new Date().toISOString() } };
    setFloorData((p) => ({ ...p, [floor.fbKey]: updated }));
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

  // ── Swipe ─────────────────────────────────────────────────────────────
  const onTS = (e) => { txRef.current = e.touches[0].clientX; };
  const onTE = (e) => {
    if (txRef.current === null) return;
    const dx = e.changedTouches[0].clientX - txRef.current;
    if (Math.abs(dx) > 40) { if (dx < 0 && floorIdx < FLOORS.length - 1) setFloorIdx((i) => i + 1); if (dx > 0 && floorIdx > 0) setFloorIdx((i) => i - 1); }
    txRef.current = null;
  };

  // ── Derived ───────────────────────────────────────────────────────────
  const occupied = Object.values(spots).filter((s) => s.occupied).length;
  const free = floor.totalSpots - occupied;
  const sc = free === 0 ? "#ff3b30" : free <= 3 ? "#ff9500" : "#34c759";
  const sbg = free === 0 ? "#2a0808" : free <= 3 ? "#2a1800" : "#082a0e";
  const totalFree = FLOORS.reduce((a, fl) => { const s = floorData[fl.fbKey] || mkSpots(fl.spotIds); return a + (fl.totalSpots - Object.values(s).filter((x) => x.occupied).length); }, 0);
  const totalAll = FLOORS.reduce((a, fl) => a + fl.totalSpots, 0);
  const T = { bg: "#000", card: "#1c1c1e", fg: "#fff", sub: "#8e8e93", border: "#2c2c2e" };

  // ── Login Screen ──────────────────────────────────────────────────────
  if (showLogin) return (
    <div style={{ minHeight: "100dvh", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif", position: "relative" }}>
      <button onClick={() => { setShowLogin(false); setAuthError(""); }} style={{ position: "absolute", top: 20, left: 20, background: "none", border: "none", color: "#0a84ff", fontSize: 17, cursor: "pointer", fontWeight: 600 }}>← Back</button>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,#ff9500,#ff6000)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 16, boxShadow: "0 6px 24px rgba(255,149,0,0.3)" }}>🛡️</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4, textAlign: "center" }}>Security Guard Login</div>
      <div style={{ fontSize: 13, color: "#8e8e93", marginBottom: 8, textAlign: "center" }}>Light &amp; Magic Park Live</div>
      <div style={{ fontSize: 11, color: "#0a84ff", marginBottom: 24, padding: "4px 14px", background: "rgba(10,132,255,0.1)", borderRadius: 100, fontWeight: 600 }}>✓ One login · access all 3 floors</div>
      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
        <input style={{ width: "100%", padding: "15px 16px", borderRadius: 14, border: "1.5px solid #3a3a3c", background: "#1c1c1e", color: "#fff", fontSize: 16, outline: "none", boxSizing: "border-box", WebkitAppearance: "none" }} placeholder="Your name" value={nameInput} onChange={(e) => { setNameInput(e.target.value); setAuthError(""); }} autoFocus />
        <div style={{ position: "relative" }}>
          <input style={{ width: "100%", padding: "15px 50px 15px 16px", borderRadius: 14, border: `1.5px solid ${authError ? "#ff3b30" : "#3a3a3c"}`, background: "#1c1c1e", color: "#fff", fontSize: 16, outline: "none", boxSizing: "border-box", WebkitAppearance: "none" }} placeholder="Password" type={showPass ? "text" : "password"} value={passInput} onChange={(e) => { setPassInput(e.target.value); setAuthError(""); }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
          <button onClick={() => setShowPass((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}><EyeIcon open={showPass} /></button>
        </div>
        {authError && <div style={{ color: "#ff3b30", fontSize: 14, fontWeight: 600, textAlign: "center", padding: "8px", background: "rgba(255,59,48,0.1)", borderRadius: 10 }}>{authError}</div>}
        <button style={{ padding: "16px", borderRadius: 14, border: "none", background: nameInput.trim() && passInput ? "#0a84ff" : "#2c2c2e", color: nameInput.trim() && passInput ? "#fff" : "#8e8e93", fontSize: 17, fontWeight: 700, cursor: "pointer", marginTop: 2 }} onClick={handleLogin}>Enter Dashboard</button>
      </div>
    </div>
  );

  // ── Main View ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: T.bg, color: T.fg, fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif", paddingBottom: 48, maxWidth: 480, margin: "0 auto", position: "relative" }} onTouchStart={onTS} onTouchEnd={onTE}>

      {sheet && <BottomSheet spot={sheet} onOccupy={occupy} onRelease={release} onClose={() => setSheet(null)} />}
      {toast && <div style={{ position: "fixed", top: 56, left: "50%", transform: "translateX(-50%)", padding: "10px 22px", borderRadius: 100, background: toast.color, color: "#fff", fontWeight: 700, fontSize: 14, zIndex: 99, whiteSpace: "nowrap", pointerEvents: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 0" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.fg }}>Light&amp;Magic</div>
          <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>Park Live</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? (pulse ? "#aaa" : "#34c759") : "#ff3b30", transition: "background 0.4s", boxShadow: connected && !pulse ? "0 0 7px #34c75977" : "none" }} />
          <span style={{ fontSize: 10, color: T.sub, letterSpacing: "1px" }}>{connected ? "LIVE" : "OFFLINE"}</span>
        </div>
      </div>

      {/* All floors summary */}
      <div style={{ margin: "10px 14px 0", padding: "7px 12px", borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: T.sub }}>All floors combined</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: totalFree === 0 ? "#ff3b30" : totalFree <= 6 ? "#ff9500" : "#34c759" }}>{totalFree} / {totalAll} free</span>
      </div>

      {/* Guard session bar */}
      {isGuard && (
        <div style={{ margin: "8px 14px 0", padding: "9px 14px", borderRadius: 12, background: "rgba(10,132,255,0.1)", border: "1px solid rgba(10,132,255,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: T.sub }}>Guard session — all floors</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.fg }}>🛡️ {guardName}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            <div style={{ fontSize: 10, color: "#ff9500", fontWeight: 600 }}>🕛 {resetIn}</div>
            <button onClick={() => setGuardSession(null)} style={{ fontSize: 11, color: "#ff3b30", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}>Log out</button>
          </div>
        </div>
      )}

      {/* Floor tabs */}
      <div style={{ display: "flex", gap: 6, padding: "10px 14px 0", overflowX: "auto", scrollbarWidth: "none" }}>
        {FLOORS.map((fl, i) => {
          const s = floorData[fl.fbKey] || mkSpots(fl.spotIds);
          const f = fl.totalSpots - Object.values(s).filter((x) => x.occupied).length;
          const c = f === 0 ? "#ff3b30" : f <= 3 ? "#ff9500" : "#34c759", active = i === floorIdx;
          return (
            <button key={fl.id} onClick={() => setFloorIdx(i)} style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${active ? c + "88" : T.border}`, background: active ? c + "18" : T.card, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, transition: "all 0.2s", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: active ? c : T.sub }}>{fl.shortLabel}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: c }}>{f} free</span>
            </button>
          );
        })}
      </div>

      {/* Status hero */}
      <div style={{ margin: "10px 14px 0", borderRadius: 22, background: sbg, border: `1.5px solid ${sc}2e`, padding: "16px 18px", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", right: -20, top: -20, width: 110, height: 110, borderRadius: "50%", background: `${sc}09` }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: sc, marginBottom: 6, opacity: 0.8 }}>{floor.label.toUpperCase()}</div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
          <div>
            <div style={{ fontSize: 60, fontWeight: 900, lineHeight: 1, letterSpacing: "-2px", color: sc }}>{free}</div>
            <div style={{ fontSize: 13, color: T.sub, marginTop: 3 }}>{free === 1 ? "space available" : "spaces available"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{free === 0 ? "🔴" : free <= 3 ? "🟠" : "🟢"}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: sc, padding: "4px 10px", borderRadius: 100, background: `${sc}18`, border: `1px solid ${sc}44` }}>{free === 0 ? "NO SPACES" : free <= 3 ? "ALMOST FULL" : "SPACES OPEN"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
          {floor.spotIds.map((id) => <div key={id} style={{ flex: 1, height: 4, borderRadius: 100, background: spots[id]?.occupied ? "#ff3b30" : "#34c759", transition: "background 0.3s" }} />)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: T.sub }}>{occupied} taken</span>
          <span style={{ fontSize: 10, color: T.sub }}>{floor.totalSpots} total</span>
        </div>
      </div>

      {free === 0 && <div style={{ margin: "8px 14px 0", borderRadius: 12, background: "rgba(255,59,48,0.1)", border: "1.5px solid rgba(255,59,48,0.25)", padding: "11px", textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 700, color: "#ff3b30" }}>🚫 This floor is full — check other floors</div></div>}
      {isGuard && <div style={{ margin: "6px 14px 0", borderRadius: 10, background: "rgba(10,132,255,0.09)", border: "1px solid rgba(10,132,255,0.18)", padding: "8px 14px", fontSize: 12, color: "#0a84ff", textAlign: "center", fontWeight: 500 }}>Tap any bay to mark occupied or release</div>}

      {/* Map label + pillar legend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 6px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.sub, letterSpacing: "1.5px", textTransform: "uppercase" }}>Parking Map</div>
        <div style={{ fontSize: 9, color: "rgba(255,200,50,0.7)", fontWeight: 600 }}>🟡 P__ = Pillar landmark</div>
      </div>

      <FloorMap floor={floor} spots={spots} isGuard={isGuard} onTapSpot={(sp) => setSheet(sp)} />

      {/* Swipe dots */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14 }}>
        {FLOORS.map((_, i) => <div key={i} onClick={() => setFloorIdx(i)} style={{ width: i === floorIdx ? 18 : 6, height: 6, borderRadius: 100, background: i === floorIdx ? sc : T.border, cursor: "pointer", transition: "all 0.3s" }} />)}
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: T.sub, marginTop: 5, opacity: 0.5, paddingBottom: 20 }}>← swipe or tap tabs to change floor →</div>

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: T.sub, opacity: 0.5 }}>{connected ? "Live sync via Firebase" : "Reconnecting…"}</span>
      </div>

      {!isGuard && (
        <div style={{ textAlign: "center", paddingBottom: 24, marginTop: 8 }}>
          <button onClick={() => setShowLogin(true)} style={{ background: "none", border: "none", color: T.sub, fontSize: 13, cursor: "pointer", opacity: 0.45, padding: "8px 16px" }}>Security Guard Login</button>
        </div>
      )}
    </div>
  );
}
