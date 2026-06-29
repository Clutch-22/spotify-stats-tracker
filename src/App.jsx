import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie } from "recharts";

const GREEN = "#1DB954";
const BG = "#121212";
const CARD = "#1a1a1a";
const BORDER = "#2a2a2a";
const TEXT = "#e1e1e1";
const DIM = "#888";

function msToH(ms) { return ms / 3600000; }
function fmt(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d.toLocaleString()}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function detectAndParse(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const sample = raw[0];
  if (sample.ts && sample.ms_played !== undefined) {
    return raw.map(e => ({
      ts: e.ts,
      artist: e.master_metadata_album_artist_name,
      track: e.master_metadata_track_name,
      album: e.master_metadata_album_album_name,
      ms: e.ms_played,
      platform: e.platform || "unknown",
      skipped: e.skipped || false,
      shuffle: e.shuffle || false,
      reason_end: e.reason_end || "",
      isMusic: !!e.master_metadata_track_name,
      isPodcast: !!e.episode_name,
    }));
  }
  if (sample.endTime && sample.msPlayed !== undefined) {
    return raw.map(e => ({
      ts: e.endTime.replace(" ", "T") + ":00Z",
      artist: e.artistName,
      track: e.trackName,
      ms: e.msPlayed,
      album: null,
      platform: "unknown",
      skipped: false,
      shuffle: false,
      reason_end: "",
      isMusic: true,
      isPodcast: false,
    }));
  }
  return null;
}

function analyze(entries) {
  const music = entries.filter(e => e.isMusic && e.ms > 5000);
  const totalMs = music.reduce((s, e) => s + e.ms, 0);
  const artists = {}, tracks = {}, monthly = {}, hourly = Array(24).fill(0), yearly = {}, platforms = {};

  music.forEach(e => {
    if (e.artist) artists[e.artist] = (artists[e.artist] || 0) + e.ms;
    if (e.track && e.artist) {
      const k = `${e.track}|||${e.artist}`;
      if (!tracks[k]) tracks[k] = { name: e.track, artist: e.artist, ms: 0, plays: 0 };
      tracks[k].ms += e.ms;
      tracks[k].plays += 1;
    }
    const d = new Date(e.ts);
    const yr = d.getUTCFullYear();
    yearly[yr] = (yearly[yr] || 0) + e.ms;
    const mk = `${yr}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthly[mk] = (monthly[mk] || 0) + e.ms;
    hourly[d.getUTCHours()] += e.ms;
    const p = (e.platform || "unknown").split(" ")[0].toLowerCase();
    const plat = p.includes("ios") ? "iOS" : p.includes("android") ? "Android" : p.includes("os x") || p.includes("macos") ? "macOS" : p.includes("windows") ? "Windows" : p.includes("web") ? "Web" : "Other";
    platforms[plat] = (platforms[plat] || 0) + e.ms;
  });

  const topArtists = Object.entries(artists).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, ms], i) => ({ name, ms, rank: i + 1 }));
  const topTracks = Object.values(tracks).sort((a, b) => b.plays - a.plays).slice(0, 20).map((t, i) => ({ ...t, rank: i + 1 }));
  const monthlyData = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0])).map(([m, ms]) => {
    const [y, mo] = m.split("-");
    const labels = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    return { month: `${labels[+mo - 1]}'${y.slice(2)}`, hours: Math.round(msToH(ms) * 10) / 10, fullMonth: m };
  });
  const hourlyData = hourly.map((ms, h) => ({
    hour: h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`,
    hours: Math.round(msToH(ms) * 10) / 10
  }));
  const yearlyData = Object.entries(yearly).sort((a, b) => +a[0] - +b[0]).map(([year, ms]) => ({
    year, hours: Math.round(msToH(ms)), ms
  }));
  const platformData = Object.entries(platforms).sort((a, b) => b[1] - a[1]).map(([name, ms]) => ({ name, ms, pct: Math.round(ms / totalMs * 100) }));
  const skippedCount = entries.filter(e => e.skipped).length;
  const dates = music.map(e => new Date(e.ts));

  return {
    totalMs, totalEntries: music.length, uniqueArtists: Object.keys(artists).length,
    uniqueTracks: Object.keys(tracks).length, topArtists, topTracks, monthlyData,
    hourlyData, yearlyData, platformData, skippedCount, totalRaw: entries.length,
    from: new Date(Math.min(...dates)), to: new Date(Math.max(...dates)),
  };
}

function Tip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#2a2a2a", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
      <div style={{ color: TEXT, fontWeight: 600 }}>{label}</div>
      <div style={{ color: GREEN }}>{payload[0].value} {unit || "hrs"}</div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ background: CARD, borderRadius: 10, padding: "18px 20px", flex: "1 1 130px", minWidth: 130 }}>
      <div style={{ color: DIM, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 5 }}>{label}</div>
      <div style={{ color: GREEN, fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: DIM, fontSize: 11, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("artists");
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState(null);
  const [fileCount, setFileCount] = useState(0);

  const handleFiles = useCallback((files) => {
    setErr(null);
    const fileArr = Array.from(files).filter(f => f.name.endsWith(".json"));
    if (fileArr.length === 0) { setErr("No JSON files found."); return; }
    setFileCount(fileArr.length);
    let allEntries = [];
    let loaded = 0;
    fileArr.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target.result);
          const parsed = detectAndParse(raw);
          if (parsed) allEntries = allEntries.concat(parsed);
        } catch (e) { /* skip bad files */ }
        loaded++;
        if (loaded === fileArr.length) {
          if (allEntries.length === 0) { setErr("No valid streaming history found in those files."); return; }
          setData(analyze(allEntries));
        }
      };
      reader.readAsText(file);
    });
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  if (!data) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter','Helvetica Neue',sans-serif", padding: 24 }}>
        <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
          style={{ border: `2px dashed ${dragOver ? GREEN : BORDER}`, borderRadius: 16, padding: "60px 40px", textAlign: "center", maxWidth: 520, width: "100%", background: dragOver ? "rgba(29,185,84,0.05)" : "transparent" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎧</div>
          <div style={{ color: TEXT, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Spotify Stats Tracker</div>
          <div style={{ color: DIM, fontSize: 14, marginBottom: 6, lineHeight: 1.6 }}>Your data never leaves your browser.</div>
          <div style={{ color: DIM, fontSize: 13, marginBottom: 24 }}>
            Drop your <code style={{ color: GREEN, background: CARD, padding: "2px 6px", borderRadius: 4 }}>Streaming_History_Audio_*.json</code> files here — one or many.
          </div>
          <label style={{ display: "inline-block", background: GREEN, color: "#000", fontWeight: 700, padding: "12px 32px", borderRadius: 24, cursor: "pointer", fontSize: 14 }}>
            Choose Files
            <input type="file" accept=".json" multiple hidden onChange={e => handleFiles(e.target.files)} />
          </label>
          <div style={{ color: DIM, fontSize: 12, marginTop: 16 }}>Supports both basic and extended streaming history formats.</div>
          {err && <div style={{ color: "#e74c3c", marginTop: 12, fontSize: 13 }}>{err}</div>}
        </div>
      </div>
    );
  }

  const s = data;
  const maxA = s.topArtists[0]?.ms || 1;
  const maxT = s.topTracks[0]?.plays || 1;
  const barColors = s.hourlyData.map(d => {
    const max = Math.max(...s.hourlyData.map(x => x.hours));
    const t = max > 0 ? d.hours / max : 0;
    return `rgb(${Math.round(29 + 20 * (1 - t))},${Math.round(185 - 80 * (1 - t))},${Math.round(84 - 30 * (1 - t))})`;
  });

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "'Inter','Helvetica Neue',sans-serif", color: TEXT, padding: "28px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}><span style={{ color: GREEN }}>♫</span> Your Listening History</h1>
            <div style={{ color: DIM, fontSize: 13, marginTop: 3 }}>
              {s.from.toLocaleDateString("en-US", { month: "short", year: "numeric" })} – {s.to.toLocaleDateString("en-US", { month: "short", year: "numeric" })} · {s.totalEntries.toLocaleString()} streams
            </div>
          </div>
          <label style={{ fontSize: 12, color: DIM, cursor: "pointer", padding: "6px 12px", border: `1px solid ${BORDER}`, borderRadius: 6 }}>
            Load different files <input type="file" accept=".json" multiple hidden onChange={e => handleFiles(e.target.files)} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <Stat label="Total Listening" value={fmt(s.totalMs)} sub={`${Math.round(msToH(s.totalMs)).toLocaleString()} hours`} />
          <Stat label="Streams" value={s.totalEntries.toLocaleString()} />
          <Stat label="Artists" value={s.uniqueArtists.toLocaleString()} />
          <Stat label="Tracks" value={s.uniqueTracks.toLocaleString()} />
        </div>

        {/* Year-by-Year */}
        <div style={{ background: CARD, borderRadius: 10, padding: "18px 18px 10px", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Year by Year</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {s.yearlyData.map(y => (
              <div key={y.year} style={{ flex: "1 1 80px", background: BG, borderRadius: 8, padding: "12px 10px", textAlign: "center", minWidth: 72 }}>
                <div style={{ color: DIM, fontSize: 12 }}>{y.year}</div>
                <div style={{ color: GREEN, fontSize: 20, fontWeight: 700 }}>{y.hours.toLocaleString()}</div>
                <div style={{ color: DIM, fontSize: 10 }}>hours</div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trend */}
        <div style={{ background: CARD, borderRadius: 10, padding: "18px 18px 10px", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Listening Over Time</div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={s.monthlyData}>
              <defs><linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity={0.4} /><stop offset="100%" stopColor={GREEN} stopOpacity={0.02} /></linearGradient></defs>
              <XAxis dataKey="month" tick={{ fill: DIM, fontSize: 9 }} axisLine={false} tickLine={false} interval={5} />
              <YAxis tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="hours" stroke={GREEN} strokeWidth={1.5} fill="url(#gF)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* When You Listen + Platform */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ background: CARD, borderRadius: 10, padding: "18px 18px 10px", flex: "2 1 400px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>When You Listen</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={s.hourlyData}>
                <XAxis dataKey="hour" tick={{ fill: DIM, fontSize: 9 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
                  {s.hourlyData.map((_, i) => <Cell key={i} fill={barColors[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: CARD, borderRadius: 10, padding: "18px", flex: "1 1 200px", minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Platform</div>
            {s.platformData.map(p => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                <span style={{ fontSize: 13 }}>{p.name}</span>
                <span style={{ color: GREEN, fontSize: 13, fontWeight: 600 }}>{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
          {[["artists", "Top Artists"], ["tracks", "Top Tracks"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: tab === k ? GREEN : CARD, color: tab === k ? "#000" : DIM,
              border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13,
              fontWeight: tab === k ? 700 : 500, cursor: "pointer"
            }}>{l}</button>
          ))}
        </div>

        <div style={{ background: CARD, borderRadius: 10, overflow: "hidden" }}>
          {tab === "artists" ? s.topArtists.map((a, i) => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: i < s.topArtists.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ color: DIM, fontSize: 13, width: 24, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{a.rank}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: BORDER }}>
                  <div style={{ height: "100%", borderRadius: 2, background: GREEN, width: `${(a.ms / maxA) * 100}%` }} />
                </div>
              </div>
              <span style={{ color: DIM, fontSize: 12, whiteSpace: "nowrap" }}>{fmt(a.ms)}</span>
            </div>
          )) : s.topTracks.map((t, i) => (
            <div key={`${t.name}-${t.artist}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: i < s.topTracks.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ color: DIM, fontSize: 13, width: 24, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.rank}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: DIM }}>{t.artist}</div>
                <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: BORDER }}>
                  <div style={{ height: "100%", borderRadius: 2, background: GREEN, width: `${(t.plays / maxT) * 100}%` }} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ color: DIM, fontSize: 12 }}>{t.plays} plays</span>
                <div style={{ color: DIM, fontSize: 11 }}>{fmt(t.ms)}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", padding: "28px 0 12px", color: DIM, fontSize: 11 }}>
          Built by Cassidy Kirz · Your data never leaves your browser · Streams under 5s excluded
        </div>
      </div>
    </div>
  );
}
