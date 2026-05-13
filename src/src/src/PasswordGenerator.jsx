import { useState, useCallback, useEffect, useRef } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS   = "0123456789";
const SYMBOLS   = "!@#$%^&*()_+-=[]{}|;:,.<>?";

const STORAGE_KEY  = "pwgen_history";
const SETTINGS_KEY = "pwgen_settings";
const VAULT_KEY    = "pwgen_vault";
const THEME_KEY    = "pwgen_theme";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generatePassword({ length, useUpper, useLower, useNumbers, useSymbols, excludeAmbiguous }) {
  let charset = "";
  if (useUpper)   charset += UPPERCASE;
  if (useLower)   charset += LOWERCASE;
  if (useNumbers) charset += NUMBERS;
  if (useSymbols) charset += SYMBOLS;
  if (excludeAmbiguous) charset = charset.replace(/[Il1O0]/g, "");
  if (!charset) return "";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (n) => charset[n % charset.length]).join("");
}

function getStrength(password) {
  if (!password) return { label: "", score: 0, color: "transparent" };
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { label: "Weak",        score, color: "#ff4d4d" };
  if (score <= 4) return { label: "Moderate",    score, color: "#ffa31a" };
  if (score <= 5) return { label: "Strong",      score, color: "#4dff91" };
  return              { label: "Very Strong", score, color: "#00e5ff" };
}

const defaultSettings = {
  length: 16, useUpper: true, useLower: true,
  useNumbers: true, useSymbols: false, excludeAmbiguous: false,
};

// ─── Theme tokens ─────────────────────────────────────────────────────────────
function getTheme(dark) {
  return dark ? {
    bg:            "#050d12",
    cardBg:        "linear-gradient(145deg,#0a1a24,#0d2030)",
    cardBorder:    "#1a3040",
    displayBg:     "#040c12",
    displayBorder: "#1a3040",
    text:          "#e8f4f8",
    muted:         "#4a7a90",
    faint:         "#2a4050",
    vaultBg:       "#040c12",
    vaultBorder:   "#1a3040",
    vaultRowBg:    "#071218",
    vaultRowBorder:"#1a2830",
    toggleBg:      "#040c12",
    toggleBorder:  "#1a3040",
    toggleOnBg:    "#001a20",
    toggleOnBorder:"#00e5ff",
    inputBg:       "#040c12",
    inputBorder:   "#1a3040",
    inputColor:    "#e8f4f8",
    warnBg:        "#1a0a00",
    warnBorder:    "#ff4d4d30",
    warnColor:     "#ff4d4d",
    accent:        "#00e5ff",
    gridColor:     "rgba(0,229,255,0.03)",
    shadow:        "0 0 60px rgba(0,229,255,0.06)",
    footerColor:   "#1e3040",
    themeBtnBg:    "#0a1a24",
    themeBtnBorder:"#1a3040",
    themeBtnColor: "#4a7a90",
    genBtnBg:      "linear-gradient(135deg,#003344,#004455)",
    vaultSaveBg:   "#001a20",
  } : {
    bg:            "#f0f4f8",
    cardBg:        "linear-gradient(145deg,#ffffff,#f7fafc)",
    cardBorder:    "#d1dde8",
    displayBg:     "#eef2f7",
    displayBorder: "#c8d8e8",
    text:          "#1a2a3a",
    muted:         "#5a7a9a",
    faint:         "#aabccc",
    vaultBg:       "#eef2f7",
    vaultBorder:   "#c8d8e8",
    vaultRowBg:    "#f7fafc",
    vaultRowBorder:"#d1dde8",
    toggleBg:      "#eef2f7",
    toggleBorder:  "#c8d8e8",
    toggleOnBg:    "#dff4fb",
    toggleOnBorder:"#0099bb",
    inputBg:       "#ffffff",
    inputBorder:   "#c8d8e8",
    inputColor:    "#1a2a3a",
    warnBg:        "#fff5f5",
    warnBorder:    "#ffcccc",
    warnColor:     "#cc3333",
    accent:        "#0099bb",
    gridColor:     "rgba(0,153,187,0.04)",
    shadow:        "0 4px 40px rgba(0,100,160,0.08)",
    footerColor:   "#aabccc",
    themeBtnBg:    "#eef2f7",
    themeBtnBorder:"#c8d8e8",
    themeBtnColor: "#5a7a9a",
    genBtnBg:      "linear-gradient(135deg,#dff4fb,#c8eaf5)",
    vaultSaveBg:   "#dff4fb",
  };
}

// ─── App Icon map ─────────────────────────────────────────────────────────────
const APP_ICONS = {
  instagram:"📸", facebook:"📘", twitter:"🐦", x:"🐦",
  google:"🔍", gmail:"📧", github:"🐙", youtube:"▶️",
  netflix:"🎬", amazon:"📦", apple:"🍎", microsoft:"🪟",
  discord:"💬", slack:"💼", spotify:"🎵", tiktok:"🎵",
  linkedin:"💼", whatsapp:"💬", telegram:"✈️", reddit:"🤖",
  twitch:"🎮", paypal:"💳", uber:"🚗", airbnb:"🏠",
  default:"🔐",
};
function getIcon(app) {
  const key = app.toLowerCase().trim();
  return Object.entries(APP_ICONS).find(([k]) => key.includes(k))?.[1] ?? APP_ICONS.default;
}

// ─── Vault Modal ──────────────────────────────────────────────────────────────
function VaultModal({ password, onSave, onClose, t }) {
  const [appName, setAppName] = useState("");
  const [note, setNote]       = useState("");
  const inputRef = useRef();
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = () => {
    if (!appName.trim()) return;
    onSave({ appName: appName.trim(), note: note.trim(), password, ts: Date.now() });
  };

  return (
    <div style={ms.overlay}>
      <div style={{ ...ms.modal, background: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
        <div style={{ ...ms.modalTitle, color: t.text }}>💾 Save to Vault</div>
        <p style={{ ...ms.modalSub, color: t.muted }}>Name the app or site for this password</p>

        <input
          ref={inputRef}
          placeholder="e.g. Instagram, Gmail, GitHub…"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          style={{ ...ms.input, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputColor }}
        />

        <textarea
          placeholder="Optional note (e.g. personal account)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ ...ms.textarea, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputColor }}
          rows={2}
        />

        <div style={{ ...ms.preview, background: t.displayBg, border: `1px solid ${t.displayBorder}` }}>
          <div style={ms.previewRow}>
            <span style={{ color: t.muted, fontSize: 11, fontFamily: "'Space Mono',monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>App</span>
            <span style={{ color: t.text, fontFamily: "'Space Mono',monospace", fontSize: 13 }}>{appName || "—"}</span>
          </div>
          <div style={ms.previewRow}>
            <span style={{ color: t.muted, fontSize: 11, fontFamily: "'Space Mono',monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Password</span>
            <span style={{ color: t.accent, fontFamily: "'Space Mono',monospace", fontSize: 12, wordBreak: "break-all" }}>{password}</span>
          </div>
        </div>

        <div style={ms.btnRow}>
          <button style={{ ...ms.cancelBtn, border: `1px solid ${t.cardBorder}`, color: t.muted }} onClick={onClose}>Cancel</button>
          <button
            style={{ ...ms.saveBtn, background: t.accent, opacity: appName.trim() ? 1 : 0.4 }}
            onClick={handleSave}
            disabled={!appName.trim()}
          >Save to Vault</button>
        </div>
      </div>
    </div>
  );
}

const ms = {
  overlay:    { position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 },
  modal:      { width:"100%", maxWidth:420, borderRadius:14, padding:"28px 24px", boxShadow:"0 20px 60px rgba(0,0,0,0.4)" },
  modalTitle: { fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, marginBottom:6 },
  modalSub:   { fontFamily:"'Space Mono',monospace", fontSize:12, marginBottom:18, lineHeight:1.5 },
  input:      { width:"100%", borderRadius:8, padding:"10px 14px", fontSize:14, fontFamily:"'Space Mono',monospace", outline:"none", marginBottom:10, display:"block" },
  textarea:   { width:"100%", borderRadius:8, padding:"10px 14px", fontSize:13, fontFamily:"'Space Mono',monospace", outline:"none", resize:"none", marginBottom:14, display:"block" },
  preview:    { borderRadius:8, padding:"12px 14px", marginBottom:18 },
  previewRow: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:6 },
  btnRow:     { display:"flex", gap:10 },
  cancelBtn:  { flex:1, background:"transparent", borderRadius:8, padding:"10px", cursor:"pointer", fontFamily:"'Space Mono',monospace", fontSize:13 },
  saveBtn:    { flex:2, border:"none", borderRadius:8, padding:"10px", cursor:"pointer", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, color:"#050d12" },
};

// ─── Vault Panel ──────────────────────────────────────────────────────────────
function VaultPanel({ vault, onDelete, onCopy, t }) {
  const [search, setSearch] = useState("");
  const [reveal, setReveal] = useState({});
  const [copiedTs, setCopiedTs] = useState(null);

  const filtered = vault.filter((e) =>
    e.appName.toLowerCase().includes(search.toLowerCase()) ||
    (e.note && e.note.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCopy = (pw, ts) => {
    onCopy(pw);
    setCopiedTs(ts);
    setTimeout(() => setCopiedTs(null), 1500);
  };

  return (
    <div style={{ ...vp.panel, background: t.vaultBg, border: `1px solid ${t.vaultBorder}` }}>
      <div style={vp.header}>
        <span style={{ color: t.text, fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15 }}>🔐 Password Vault</span>
        <span style={{ color: t.muted, fontFamily:"'Space Mono',monospace", fontSize:11 }}>{vault.length} saved</span>
      </div>

      {vault.length > 0 && (
        <input
          placeholder="Search apps…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...vp.search, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputColor }}
        />
      )}

      {vault.length === 0 ? (
        <div style={{ ...vp.empty, color: t.faint }}>
          No passwords saved yet.<br />
          Go to Generator, create a password,<br />and click "💾 Save to Vault".
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...vp.empty, color: t.faint }}>No results for "{search}"</div>
      ) : (
        <div style={vp.list}>
          {filtered.map((entry) => (
            <div key={entry.ts} style={{ ...vp.row, background: t.vaultRowBg, border: `1px solid ${t.vaultRowBorder}` }}>
              <div style={vp.rowLeft}>
                <span style={vp.icon}>{getIcon(entry.appName)}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ ...vp.appName, color: t.text }}>{entry.appName}</div>
                  {entry.note && <div style={{ ...vp.note, color: t.muted }}>{entry.note}</div>}

                  {/* ── The key display: App - X / Password - Y ── */}
                  <div style={{ ...vp.entryBlock, background: t.displayBg, border: `1px solid ${t.displayBorder}` }}>
                    <div style={vp.entryRow}>
                      <span style={{ ...vp.entryKey, color: t.muted }}>App</span>
                      <span style={{ ...vp.entryVal, color: t.text }}>{entry.appName}</span>
                    </div>
                    <div style={vp.entryRow}>
                      <span style={{ ...vp.entryKey, color: t.muted }}>Password</span>
                      <span
                        style={{ ...vp.entryVal, color: t.accent, cursor:"pointer", userSelect:"none" }}
                        onClick={() => setReveal((r) => ({ ...r, [entry.ts]: !r[entry.ts] }))}
                        title="Click to reveal/hide"
                      >
                        {reveal[entry.ts] ? entry.password : "••••••••••••"}
                        <span style={{ fontSize:10, marginLeft:6, opacity:0.6 }}>{reveal[entry.ts] ? "🙈 hide" : "👁 show"}</span>
                      </span>
                    </div>
                  </div>

                  <div style={{ ...vp.date, color: t.faint }}>{new Date(entry.ts).toLocaleDateString()} {new Date(entry.ts).toLocaleTimeString()}</div>
                </div>
              </div>
              <div style={vp.rowActions}>
                <button
                  style={{ ...vp.actionBtn, color: copiedTs === entry.ts ? "#4dff91" : t.accent, border: `1px solid ${t.vaultBorder}` }}
                  onClick={() => handleCopy(entry.password, entry.ts)}
                  title="Copy password"
                >
                  {copiedTs === entry.ts ? "✓" : "⎘"}
                </button>
                <button
                  style={{ ...vp.actionBtn, color: "#ff6b6b", border: `1px solid ${t.vaultBorder}` }}
                  onClick={() => onDelete(entry.ts)}
                  title="Delete"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const vp = {
  panel:      { borderRadius:12, padding:"18px 16px", marginTop:12 },
  header:     { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 },
  search:     { width:"100%", borderRadius:6, padding:"8px 12px", fontSize:12, fontFamily:"'Space Mono',monospace", outline:"none", marginBottom:10, display:"block" },
  empty:      { fontFamily:"'Space Mono',monospace", fontSize:12, textAlign:"center", padding:"28px 0", lineHeight:2 },
  list:       { display:"flex", flexDirection:"column", gap:10, maxHeight:400, overflowY:"auto" },
  row:        { borderRadius:10, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 },
  rowLeft:    { display:"flex", gap:10, flex:1, minWidth:0 },
  icon:       { fontSize:24, flexShrink:0, marginTop:2 },
  appName:    { fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, marginBottom:4 },
  note:       { fontFamily:"'Space Mono',monospace", fontSize:11, marginBottom:8 },
  entryBlock: { borderRadius:7, padding:"10px 12px", marginBottom:6 },
  entryRow:   { display:"flex", gap:10, alignItems:"flex-start", marginBottom:4 },
  entryKey:   { fontFamily:"'Space Mono',monospace", fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", minWidth:64, flexShrink:0, paddingTop:1 },
  entryVal:   { fontFamily:"'Space Mono',monospace", fontSize:12, wordBreak:"break-all", lineHeight:1.5 },
  date:       { fontFamily:"'Space Mono',monospace", fontSize:10 },
  rowActions: { display:"flex", flexDirection:"column", gap:6, flexShrink:0 },
  actionBtn:  { background:"transparent", borderRadius:6, padding:"5px 9px", cursor:"pointer", fontSize:14, fontFamily:"monospace" },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PasswordGenerator() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) !== "light"; } catch { return true; }
  });

  const [settings, setSettings] = useState(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      return s ? { ...defaultSettings, ...JSON.parse(s) } : defaultSettings;
    } catch { return defaultSettings; }
  });

  const [password, setPassword]   = useState("");
  const [copied, setCopied]       = useState(false);
  const [glitch, setGlitch]       = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("generator");
  const [savedNote, setSavedNote] = useState("");

  const [vault, setVault] = useState(() => {
    try { const v = localStorage.getItem(VAULT_KEY); return v ? JSON.parse(v) : []; }
    catch { return []; }
  });

  const [history, setHistory] = useState(() => {
    try { const h = localStorage.getItem(STORAGE_KEY); return h ? JSON.parse(h) : []; }
    catch { return []; }
  });

  const timerRef = useRef(null);
  const t = getTheme(dark);

  useEffect(() => { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 20))); }, [history]);
  useEffect(() => { localStorage.setItem(VAULT_KEY, JSON.stringify(vault)); }, [vault]);

  const generate = useCallback(() => {
    const pw = generatePassword(settings);
    setPassword(pw);
    setSavedNote("");
    setGlitch(true);
    setTimeout(() => setGlitch(false), 400);
    if (pw) {
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.pw !== pw);
        return [{ pw, ts: Date.now() }, ...filtered].slice(0, 20);
      });
    }
  }, [settings]);

  const copy = useCallback((pw) => {
    const target = pw || password;
    if (!target) return;
    navigator.clipboard.writeText(target).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1800);
    });
  }, [password]);

  const saveToVault = (entry) => {
    setVault((prev) => [entry, ...prev]);
    setSavedNote(`✓ Saved as "${entry.appName}"`);
    setShowModal(false);
  };

  const deleteFromVault = (ts) => setVault((prev) => prev.filter((e) => e.ts !== ts));
  const set = (key, val) => setSettings((s) => ({ ...s, [key]: val }));

  const strength     = getStrength(password);
  const noneSelected = !settings.useUpper && !settings.useLower && !settings.useNumbers && !settings.useSymbols;

  return (
    <div style={{ ...s.root, background: t.bg }}>
      <div style={{ ...s.grid, backgroundImage:`linear-gradient(${t.gridColor} 1px,transparent 1px),linear-gradient(90deg,${t.gridColor} 1px,transparent 1px)` }} aria-hidden />

      <div style={{ ...s.card, background: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.logoRow}>
            <span style={{ fontSize:26, color: t.accent, textShadow: dark ? `0 0 12px ${t.accent}` : "none" }}>⬡</span>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:24, letterSpacing:"0.2em", color: t.text }}>PASSFORGE</span>
            <button
              onClick={() => setDark((d) => !d)}
              style={{ ...s.themeBtn, background: t.themeBtnBg, border:`1px solid ${t.themeBtnBorder}`, color: t.themeBtnColor }}
              title="Toggle theme"
            >{dark ? "☀" : "🌙"}</button>
          </div>
          <p style={{ ...s.subtitle, color: t.muted }}>Cryptographically secure · Locally stored</p>
        </div>

        {/* Tabs */}
        <div style={{ ...s.tabs, borderBottom:`1px solid ${t.cardBorder}` }}>
          {[
            { id:"generator", label:"⚙ Generator" },
            { id:"vault",     label:`🔐 Vault (${vault.length})` },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ ...s.tab, color: activeTab===id ? t.accent : t.muted, borderBottom: activeTab===id ? `2px solid ${t.accent}` : "2px solid transparent" }}
            >{label}</button>
          ))}
        </div>

        {/* ── Generator Tab ── */}
        {activeTab === "generator" && (<>

          {/* Display */}
          <div style={{ ...s.displayBox, background: t.displayBg, border:`1px solid ${t.displayBorder}` }}
            onClick={() => copy()} title="Click to copy">
            <span style={{ ...s.passwordText, animation: glitch ? "glitch 0.35s steps(2) forwards" : "none", color: password ? t.text : t.faint, letterSpacing: password ? "0.06em" : "0.1em" }}>
              {password || "· · · · · · · · · · · · ·"}
            </span>
            <button
              style={{ ...s.copyBtn, border:`1px solid ${copied ? "#4dff91" : t.displayBorder}`, color: copied ? "#4dff91" : t.muted, boxShadow: copied ? "0 0 8px #4dff9140" : "none" }}
              onClick={(e) => { e.stopPropagation(); copy(); }}
            >{copied ? "✓ Copied!" : "Copy"}</button>
          </div>

          {/* Strength */}
          {password && (
            <div style={s.strengthRow}>
              <span style={{ ...s.strengthLabel, color: strength.color }}>{strength.label}</span>
              <div style={s.strengthBar}>
                {[1,2,3,4,5,6].map((i) => (
                  <div key={i} style={{ ...s.strengthSeg, background: i<=strength.score ? strength.color : t.displayBorder, opacity: i<=strength.score ? 1 : 0.3 }} />
                ))}
              </div>
            </div>
          )}

          {/* Save to Vault CTA */}
          {password && (
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <button
                onClick={() => setShowModal(true)}
                style={{ ...s.vaultBtn, background: t.vaultSaveBg, border:`1px solid ${t.accent}`, color: t.accent }}
              >💾 Save to Vault</button>
              {savedNote && <span style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:"#4dff91" }}>{savedNote}</span>}
            </div>
          )}

          {/* Length */}
          <div style={s.section}>
            <div style={s.labelRow}>
              <span style={{ ...s.label, color: t.muted }}>Length</span>
              <span style={{ ...s.lengthBadge, background: t.displayBg, border:`1px solid ${t.accent}`, color: t.accent }}>{settings.length}</span>
            </div>
            <input type="range" min={4} max={64} value={settings.length}
              onChange={(e) => set("length", Number(e.target.value))} style={s.slider} />
            <div style={s.sliderTicks}>
              {[4,16,32,48,64].map((v) => <span key={v} style={{ ...s.tick, color: t.faint }}>{v}</span>)}
            </div>
          </div>

          {/* Char type toggles */}
          <div style={s.section}>
            <span style={{ ...s.label, color: t.muted }}>Character Types</span>
            <div style={s.toggleGrid}>
              {[
                { key:"useUpper",  label:"A–Z", desc:"Uppercase" },
                { key:"useLower",  label:"a–z", desc:"Lowercase" },
                { key:"useNumbers",label:"0–9", desc:"Numbers"   },
                { key:"useSymbols",label:"!@#", desc:"Symbols"   },
              ].map(({ key, label, desc }) => (
                <button key={key} onClick={() => set(key, !settings[key])}
                  style={{ ...s.toggleBtn,
                    background:  settings[key] ? t.toggleOnBg     : t.toggleBg,
                    border:     `1px solid ${settings[key] ? t.toggleOnBorder : t.toggleBorder}`,
                    boxShadow:   settings[key] && dark ? `0 0 10px ${t.accent}20` : "none",
                  }}>
                  <span style={{ ...s.toggleCode, color: t.text }}>{label}</span>
                  <span style={{ ...s.toggleDesc, color: t.muted }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ambiguous */}
          <label style={s.checkRow}>
            <input type="checkbox" checked={settings.excludeAmbiguous}
              onChange={(e) => set("excludeAmbiguous", e.target.checked)}
              style={{ accentColor: t.accent, width:16, height:16, cursor:"pointer" }} />
            <span style={{ fontSize:12, fontFamily:"'Space Mono',monospace", color: t.muted }}>
              Exclude ambiguous chars (I, l, 1, O, 0)
            </span>
          </label>

          {noneSelected && (
            <div style={{ ...s.warn, background: t.warnBg, border:`1px solid ${t.warnBorder}`, color: t.warnColor }}>
              ⚠ Select at least one character type
            </div>
          )}

          {/* Generate */}
          <button style={{ ...s.generateBtn, background: t.genBtnBg, border:`1px solid ${t.accent}` }}
            onClick={generate} disabled={noneSelected}>
            <span style={{ ...s.generateBtnText, color: t.accent, textShadow: dark ? `0 0 10px ${t.accent}80` : "none" }}>
              ⟳ GENERATE PASSWORD
            </span>
          </button>

          {/* History */}
          <details style={{ marginBottom:8 }}>
            <summary style={{ ...s.summary, color: t.muted }}>▸ History ({history.length})</summary>
            <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:180, overflowY:"auto" }}>
              {history.length === 0
                ? <div style={{ fontFamily:"'Space Mono',monospace", fontSize:12, textAlign:"center", padding:"12px 0", color: t.faint }}>No history yet.</div>
                : history.map(({ pw, ts }) => (
                    <div key={ts}
                      style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:6, padding:"8px 12px", cursor:"pointer", background: t.vaultRowBg, border:`1px solid ${t.vaultRowBorder}` }}
                      onClick={() => copy(pw)} title="Click to copy">
                      <span style={{ fontFamily:"'Space Mono',monospace", fontSize:11, wordBreak:"break-all", flex:1, color: t.muted }}>{pw}</span>
                      <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, flexShrink:0, marginLeft:10, color: t.faint }}>{new Date(ts).toLocaleTimeString()}</span>
                    </div>
                  ))
              }
            </div>
          </details>
        </>)}

        {/* ── Vault Tab ── */}
        {activeTab === "vault" && (
          <VaultPanel vault={vault} onDelete={deleteFromVault} onCopy={copy} t={t} />
        )}

        <p style={{ ...s.footer, color: t.footerColor }}>Passwords saved locally in your browser · Never sent to any server</p>
      </div>

      {showModal && (
        <VaultModal password={password} onSave={saveToVault} onClose={() => setShowModal(false)} t={t} />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes glitch {
          0%   { transform:translate(2px,-1px) skewX(-2deg); opacity:.8; }
          25%  { transform:translate(-2px,1px) skewX(2deg); }
          50%  { transform:translate(1px,2px) skewX(-1deg); }
          75%  { transform:translate(-1px,-2px) skewX(1deg); }
          100% { transform:none; opacity:1; }
        }
        input[type=range] { -webkit-appearance:none; appearance:none; height:4px; border-radius:2px; background:#1e3040; outline:none; cursor:pointer; width:100%; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#00e5ff; border:2px solid #050d12; cursor:pointer; box-shadow:0 0 8px #00e5ff88; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#1e3040; border-radius:2px; }
        details summary { list-style:none; cursor:pointer; } details summary::-webkit-details-marker { display:none; }
      `}</style>
    </div>
  );
}

const s = {
  root:           { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px", fontFamily:"'Syne',sans-serif", position:"relative", overflow:"hidden" },
  grid:           { position:"fixed", inset:0, backgroundSize:"40px 40px", pointerEvents:"none", zIndex:0 },
  card:           { position:"relative", zIndex:1, width:"100%", maxWidth:540, borderRadius:16, padding:"28px 24px" },
  header:         { marginBottom:20, textAlign:"center" },
  logoRow:        { display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:4 },
  subtitle:       { fontSize:12, letterSpacing:"0.05em", fontFamily:"'Space Mono',monospace", marginBottom:4 },
  themeBtn:       { fontSize:16, borderRadius:20, padding:"4px 10px", cursor:"pointer", marginLeft:8 },
  tabs:           { display:"flex", marginBottom:20, gap:4 },
  tab:            { flex:1, background:"transparent", border:"none", padding:"10px 0", cursor:"pointer", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, letterSpacing:"0.05em", transition:"color 0.2s" },
  displayBox:     { borderRadius:10, padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, cursor:"pointer", marginBottom:14, transition:"border-color 0.2s" },
  passwordText:   { fontFamily:"'Space Mono',monospace", fontSize:14, wordBreak:"break-all", flex:1, lineHeight:1.6 },
  copyBtn:        { flexShrink:0, background:"transparent", borderRadius:6, padding:"6px 14px", fontSize:12, fontFamily:"'Space Mono',monospace", cursor:"pointer", transition:"all 0.2s", letterSpacing:"0.05em" },
  strengthRow:    { display:"flex", alignItems:"center", gap:12, marginBottom:16 },
  strengthLabel:  { fontFamily:"'Space Mono',monospace", fontSize:12, fontWeight:700, letterSpacing:"0.08em", minWidth:80 },
  strengthBar:    { display:"flex", gap:4, flex:1 },
  strengthSeg:    { flex:1, height:4, borderRadius:2, transition:"all 0.3s" },
  vaultBtn:       { borderRadius:8, padding:"8px 16px", cursor:"pointer", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12, letterSpacing:"0.06em" },
  section:        { marginBottom:20 },
  labelRow:       { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  label:          { fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", fontFamily:"'Space Mono',monospace" },
  lengthBadge:    { fontFamily:"'Space Mono',monospace", fontSize:13, fontWeight:700, padding:"2px 10px", borderRadius:20 },
  slider:         { marginBottom:6 },
  sliderTicks:    { display:"flex", justifyContent:"space-between" },
  tick:           { fontSize:10, fontFamily:"'Space Mono',monospace" },
  toggleGrid:     { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginTop:10 },
  toggleBtn:      { borderRadius:8, padding:"10px 4px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"all 0.2s" },
  toggleCode:     { fontFamily:"'Space Mono',monospace", fontSize:13, fontWeight:700 },
  toggleDesc:     { fontSize:9, letterSpacing:"0.05em", textTransform:"uppercase" },
  checkRow:       { display:"flex", alignItems:"center", gap:10, marginBottom:18, cursor:"pointer" },
  warn:           { borderRadius:6, padding:"8px 14px", fontSize:12, marginBottom:14, fontFamily:"'Space Mono',monospace" },
  generateBtn:    { width:"100%", borderRadius:10, padding:"16px", cursor:"pointer", transition:"all 0.2s", marginBottom:18 },
  generateBtnText:{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, letterSpacing:"0.15em" },
  summary:        { fontFamily:"'Space Mono',monospace", fontSize:12, letterSpacing:"0.05em", marginBottom:8, userSelect:"none", padding:"4px 0" },
  footer:         { textAlign:"center", fontSize:10, fontFamily:"'Space Mono',monospace", letterSpacing:"0.05em", marginTop:16 },
};
