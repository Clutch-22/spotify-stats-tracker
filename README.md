# 🎧 Spotify Stats Tracker

**You shouldn't have to pay someone to show you your own data.**

A free, open-source, privacy-first alternative to paid Spotify stats services. No accounts, no subscriptions, no data collection. Your listening history never leaves your browser.

Services like Must.fm charged $18/year to store your data on their servers — then went defunct, taking everyone's history with them. This tool runs entirely in your browser. There's nothing to sign up for, nothing to pay, and nothing that can disappear.

## What It Does

Drop your Spotify data export files in and instantly see:

- **Total listening time** across your entire Spotify history
- **Top artists and tracks** ranked by play count and listening time
- **Year-by-year breakdown** of your listening hours
- **Monthly trends** showing how your listening evolved over time
- **Time-of-day patterns** revealing when you listen most
- **Platform breakdown** (iOS, desktop, web, etc.)

Supports both Spotify's **basic streaming history** (last 12 months) and **extended streaming history** (your entire account history). Upload one file or many — the tool merges everything automatically.

## How to Get Your Spotify Data

### Basic History (~1 year, available instantly)

1. Go to [spotify.com/account/privacy](https://www.spotify.com/account/privacy/)
2. Under "Download your data," check **Account data**
3. Click **Request data**
4. Confirm via the email Spotify sends you
5. Download when ready (usually a few days)

### Extended History (your full history, back to day one)

1. Go to [spotify.com/account/privacy](https://www.spotify.com/account/privacy/)
2. Under "Download your data," check **Extended streaming history**
3. Click **Request data**
4. Confirm via the email Spotify sends you
5. Wait for delivery (1–30 days, usually under a week)

The extended history is worth the wait. It includes every stream since you created your account.

## Getting Started

```bash
git clone https://github.com/Clutch-22/spotify-stats-tracker.git
cd spotify-stats-tracker
npm install
npm run dev
```

Open `http://localhost:5173` and drop your `Streaming_History_Audio_*.json` files in.

## Privacy

This tool processes everything locally in your browser using JavaScript. No data is sent to any server. No analytics. No tracking. No cookies. You can verify this yourself — the source code is right here.

## Tech Stack

- React 18
- Recharts
- Vite

## License

MIT — do whatever you want with it.
