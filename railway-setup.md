# Railway Deployment Guide

## Schnellstart

1. **Railway Account erstellen** → https://railway.app
2. **Neues Projekt** → "Deploy from GitHub repo" → `BeneKanzlei/test_anus`
3. **PostgreSQL hinzufügen** → "+ New" → "Database" → "Add PostgreSQL"
4. **Umgebungsvariablen setzen** → Projekt → "Variables"

## Wichtige Umgebungsvariablen

### Erforderlich:
- `DATABASE_URL` (wird automatisch von Railway gesetzt)
- `NEXTAUTH_URL` (z.B. `https://deine-app.railway.app`)
- `NEXTAUTH_SECRET` (generiere mit: `openssl rand -base64 32`)
- `ENCRYPTION_KEY` (generiere mit: `openssl rand -hex 32`)
- `NEXT_PUBLIC_HELIUS_API_KEY`
- `NEXT_PUBLIC_MORALIS_API_KEY`
- `DEEPSEEK_API_KEY`

### Optional:
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`
- `NEXT_PUBLIC_PARRY_CORE_PASSWORD`
- `NEXT_PUBLIC_ENABLE_PUMPFUN_API=true`

## Datenbank Setup

Nach dem ersten Deployment:

1. **Via Railway CLI:**
```bash
railway link
railway run npx prisma db push
```

2. **Oder via Railway Dashboard:**
- Öffne "Deploy Logs"
- Klicke auf "Shell" Tab
- Führe aus: `npx prisma db push`

## Build & Deploy

Railway erkennt automatisch:
- Build Command: `prisma generate && next build`
- Start Command: `next start`
- Port: Automatisch (Railway setzt `PORT`)

## Domain Setup

1. Im Railway Dashboard: Projekt → "Settings" → "Domains"
2. "Generate Domain" klicken
3. Oder eigene Domain hinzufügen

## Troubleshooting

- **Build fehlgeschlagen?** → Prüfe "Deploy Logs"
- **Datenbank-Fehler?** → Stelle sicher, dass `DATABASE_URL` gesetzt ist
- **Port-Fehler?** → Railway setzt automatisch `PORT`, sollte funktionieren
