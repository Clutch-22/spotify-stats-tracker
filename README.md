# Spotify Stats Tracker (v 0.1.0)

**Nowadays, you have to pay people to show you your own data. Screw that.**

This repository is the first iteration (v 0.1.0) of a free, open-source, privacy-first alternative to paid Spotify stats services. No accounts, no subscriptions, no data collection, no servers required! Your listening history never leaves your browser, nor your device.

Services like Must.fm charge $18/year to track spotify data – then the code of Spotify's listening history changed, the app's functionality got kneecapped, and people never heard of their hard-spent money again. Pretty scummy, right? Well, _this_ tool runs entirely in your browser. There's nothing to sign up for, nothing to pay, and nothing that can disappear – after all, it only tracks data that _you_ upload to it.

## What It Does

Drop your Spotify data export files in and instantly see:

- **Total listening time** across your entire Spotify history
- **Top artists and tracks** ranked by play count and listening time
- **Year-by-year breakdown** of your listening hours
- **Monthly trends** showing how your listening evolved over time
- **Time-of-day patterns** revealing when you listen most
- **Platform breakdown** (iOS, desktop, web, etc.)

Supports both Spotify's **basic streaming history** (last 12 months) and **extended streaming history** (your entire account history). Upload one file – or many! The tool merges everything automatically.

## How to Get Your Spotify Data

### Basic History (~1 year, available instantly)

1. Go to [spotify.com/account/privacy](https://www.spotify.com/account/privacy/)
2. Under "Download your data," check **Account data**
3. Click **Request data**
4. Confirm via the email Spotify sends you
5. Download when ready (usually a few days)

### Extended History (your full history, regardless of cringe)

1. Go to [spotify.com/account/privacy](https://www.spotify.com/account/privacy/)
2. Under "Download your data," check **Extended streaming history**
3. Click **Request data**
4. Confirm via the email Spotify sends you
5. Wait for delivery (1-30 days, usually under a week)

## Getting Started

```bash
git clone https://github.com/Clutch-22/spotify-stats-tracker.git
cd spotify-stats-tracker
npm install
npm run dev
```

Open `http://localhost:5173` and drop your `Streaming_History_Audio_*.json` files in.

## Privacy

This tool processes everything locally in your browser using JavaScript. No data is sent to any server: no analytics, no tracking, no cookies. You can verify this yourself if you wish — this project is open-source.

## Tech Stack

- React 18
- Recharts
- Vite

## License

Non-Commercial – free for personal use. See LICENSE for details. For commercial licensing, contact clutch22etal@proton.me
