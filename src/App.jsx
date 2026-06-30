import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";

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
      ts: e.ts, artist: e.master_metadata_album_artist_name,
      track: e.master_metadata_track_name, album: e.master_metadata_album_album_name,
      ms: e.ms_played, platform: e.platform || "unknown",
      skipped: e.skipped || false, isMusic: !!e.master_metadata_track_name,
    }));
  }
  if (sample.endTime && sample.msPlayed !== undefined) {
    return raw.map(e => ({
      ts: e.endTime.replace(" ", "T") + ":00Z", artist: e.artistName,
      track: e.trackName, ms: e.msPlayed, album: null,
      platform: "unknown", skipped: false, isMusic: true,
    }));
  }
  return null;
}

function filterByTime(entries, filter) {
  if (filter === "all") return entries;
  const now = new Date();
  const cutoff = new Date(now);
  if (filter === "week") cutoff.setDate(now.getDate() - 7);
  else if (filter === "month") cutoff.setDate(now.getDate() - 30);
  else if (filter === "year") cutoff.setFullYear(now.getFullYear() - 1);
  return entries.filter(e => new Date(e.ts) >= cutoff);
}

function computeSummary(entries) {
  const totalMs = entries.reduce((s, e) => s + e.ms, 0);
  const artists = new Set(), tracks = new Set();
  const yearly = {}, hourly = Array(24).fill(0), platforms = {};
  entries.forEach(e => {
    if (e.artist) artists.add(e.artist);
    if (e.track) tracks.add(`${e.track}|||${e.artist}`);
    const d = new Date(e.ts);
    const yr = d.getUTCFullYear();
    yearly[yr] = (yearly[yr] || 0) + e.ms;
    hourly[d.getUTCHours()] += e.ms;
    const p = (e.platform || "unknown").split(" ")[0].toLowerCase();
    const plat = p.includes("ios") ? "iOS" : p.includes("android") ? "Android" :
      p.includes("os x") || p.includes("macos") ? "macOS" :
      p.includes("windows") ? "Windows" : p.includes("web") ? "Web" : "Other";
    platforms[plat] = (platforms[plat] || 0) + e.ms;
  });
  const yearlyData = Object.entries(yearly).sort((a, b) => +a[0] - +b[0])
    .map(([year, ms]) => ({ year, hours: Math.round(msToH(ms)), ms }));
  const hourlyData = hourly.map((ms, h) => ({
    hour: h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`,
    hours: Math.round(msToH(ms) * 10) / 10
  }));
  const platformData = Object.entries(platforms).sort((a, b) => b[1] - a[1])
    .map(([name, ms]) => ({ name, ms, pct: Math.round(ms / totalMs * 100) }));
  const dates = entries.map(e => new Date(e.ts));
  return {
    totalMs, totalEntries: entries.length,
    uniqueArtists: artists.size, uniqueTracks: tracks.size,
    yearlyData, hourlyData, platformData,
    from: new Date(Math.min(...dates)), to: new Date(Math.max(...dates)),
  };
}

function computeTopArtists(entries) {
  const artists = {};
  entries.forEach(e => { if (e.artist) artists[e.artist] = (artists[e.artist] || 0) + e.ms; });
  return Object.entries(artists).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([name, ms], i) => ({ name, ms, rank: i + 1 }));
}

function computeTopTracks(entries, sortBy) {
  const tracks = {};
  entries.forEach(e => {
    if (e.track && e.artist) {
      const k = `${e.track}|||${e.artist}`;
      if (!tracks[k]) tracks[k] = { name: e.track, artist: e.artist, ms: 0, plays: 0 };
      tracks[k].ms += e.ms;
      tracks[k].plays += 1;
    }
  });
  return Object.values(tracks)
    .sort((a, b) => sortBy === "hours" ? b.ms - a.ms : b.plays - a.plays)
    .slice(0, 20).map((t, i) => ({ ...t, rank: i + 1 }));
}

function computeChartData(entries, filter) {
  const filtered = filterByTime(entries, filter);
  if (filter === "week" || filter === "month") {
    const daily = {};
    filtered.forEach(e => {
      const d = new Date(e.ts);
      const dk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      daily[dk] = (daily[dk] || 0) + e.ms;
    });
    return Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0])).map(([d, ms]) => {
      const parts = d.split("-");
      const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const label = filter === "week" ? dow[new Date(d + "T00:00:00Z").getUTCDay()] : `${+parts[1]}/${+parts[2]}`;
      return { label, hours: Math.round(msToH(ms) * 10) / 10 };
    });
  }
  const monthly = {};
  filtered.forEach(e => {
    const d = new Date(e.ts);
    const mk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthly[mk] = (monthly[mk] || 0) + e.ms;
  });
  let data = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]));
  if (filter === "year") data = data.slice(-12);
  return data.map(([m, ms]) => {
    const [y, mo] = m.split("-");
    const labels = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    return { label: `${labels[+mo - 1]}'${y.slice(2)}`, hours: Math.round(msToH(ms) * 10) / 10 };
  });
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

function Toggle({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {options.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          background: value === k ? GREEN : "transparent",
          color: value === k ? "#000" : DIM,
          border: `1px solid ${value === k ? GREEN : BORDER}`,
          borderRadius: 4, padding: "3px 10px", fontSize: 11,
          fontWeight: value === k ? 600 : 400, cursor: "pointer",
          transition: "all 0.15s"
        }}>{l}</button>
      ))}
    </div>
  );
}

const TIME_OPTIONS = [["all", "All Time"], ["week", "Past Week"], ["month", "Past Month"], ["year", "Past Year"]];

export default function App() {
  const [entries, setEntries] = useState(null);
  const [tab, setTab] = useState("artists");
  const [trackSort, setTrackSort] = useState("plays");
  const [rankFilter, setRankFilter] = useState("all");
  const [chartFilter, setChartFilter] = useState("all");
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState(null);

  const handleFiles = useCallback((files) => {
    setErr(null);
    const fileArr = Array.from(files).filter(f => f.name.endsWith(".json"));
    if (fileArr.length === 0) { setErr("No JSON files found."); return; }
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
          const music = allEntries.filter(e => e.isMusic && e.ms > 5000);
          if (music.length === 0) { setErr("No valid streaming history found."); return; }
          setEntries(music);
        }
      };
      reader.readAsText(file);
    });
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const summary = useMemo(() => entries ? computeSummary(entries) : null, [entries]);
  const rankEntries = useMemo(() => entries ? filterByTime(entries, rankFilter) : [], [entries, rankFilter]);
  const topArtists = useMemo(() => rankEntries.length ? computeTopArtists(rankEntries) : [], [rankEntries]);
  const topTracks = useMemo(() => rankEntries.length ? computeTopTracks(rankEntries, trackSort) : [], [rankEntries, trackSort]);
  const chartData = useMemo(() => entries ? computeChartData(entries, chartFilter) : [], [entries, chartFilter]);

  if (!entries) {
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

  const s = summary;
  const maxA = topArtists[0]?.ms || 1;
  const maxT = trackSort === "plays" ? (topTracks[0]?.plays || 1) : (topTracks[0]?.ms || 1);
  const barColors = s.hourlyData.map(d => {
    const max = Math.max(...s.hourlyData.map(x => x.hours));
    const t = max > 0 ? d.hours / max : 0;
    return `rgb(${Math.round(29 + 20 * (1 - t))},${Math.round(185 - 80 * (1 - t))},${Math.round(84 - 30 * (1 - t))})`;
  });

  const noRankData = rankEntries.length === 0;

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

        {/* Monthly Trend with filter */}
        <div style={{ background: CARD, borderRadius: 10, padding: "18px 18px 10px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Listening Over Time</div>
            <Toggle options={TIME_OPTIONS} value={chartFilter} onChange={setChartFilter} />
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={chartData}>
                <defs><linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity={0.4} /><stop offset="100%" stopColor={GREEN} stopOpacity={0.02} /></linearGradient></defs>
                <XAxis dataKey="label" tick={{ fill: DIM, fontSize: 9 }} axisLine={false} tickLine={false} interval={chartFilter === "week" ? 0 : chartFilter === "month" ? 2 : 5} />
                <YAxis tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="hours" stroke={GREEN} strokeWidth={1.5} fill="url(#gF)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: DIM, fontSize: 13, padding: "40px 0", textAlign: "center" }}>No data for this time range.</div>
          )}
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

        {/* Tabs + Time Filter for rankings */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[["artists", "Top Artists"], ["tracks", "Top Tracks"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                background: tab === k ? GREEN : CARD, color: tab === k ? "#000" : DIM,
                border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13,
                fontWeight: tab === k ? 700 : 500, cursor: "pointer"
              }}>{l}</button>
            ))}
          </div>
          <Toggle options={TIME_OPTIONS} value={rankFilter} onChange={setRankFilter} />
        </div>

        {/* Sort toggle for tracks */}
        {tab === "tracks" && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <Toggle options={[["plays", "By Plays"], ["hours", "By Hours"]]} value={trackSort} onChange={setTrackSort} />
          </div>
        )}

        <div style={{ background: CARD, borderRadius: 10, overflow: "hidden" }}>
          {noRankData ? (
            <div style={{ color: DIM, fontSize: 13, padding: "40px 0", textAlign: "center" }}>No data for this time range.</div>
          ) : tab === "artists" ? topArtists.map((a, i) => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: i < topArtists.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ color: DIM, fontSize: 13, width: 24, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{a.rank}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: BORDER }}>
                  <div style={{ height: "100%", borderRadius: 2, background: GREEN, width: `${(a.ms / maxA) * 100}%` }} />
                </div>
              </div>
              <span style={{ color: DIM, fontSize: 12, whiteSpace: "nowrap" }}>{fmt(a.ms)}</span>
            </div>
          )) : topTracks.map((t, i) => (
            <div key={`${t.name}-${t.artist}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: i < topTracks.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ color: DIM, fontSize: 13, width: 24, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.rank}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: DIM }}>{t.artist}</div>
                <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: BORDER }}>
                  <div style={{ height: "100%", borderRadius: 2, background: GREEN, width: `${(trackSort === "plays" ? t.plays / maxT : t.ms / maxT) * 100}%` }} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ color: trackSort === "plays" ? GREEN : DIM, fontSize: 12, fontWeight: trackSort === "plays" ? 600 : 400 }}>{t.plays} plays</span>
                <div style={{ color: trackSort === "hours" ? GREEN : DIM, fontSize: 11, fontWeight: trackSort === "hours" ? 600 : 400 }}>{fmt(t.ms)}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", padding: "28px 0 12px", color: DIM, fontSize: 11 }}>
          Built by Clutch-22 · Your data never leaves your browser · Streams under 5s excluded
        </div>
      </div>
    </div>
  );
}
