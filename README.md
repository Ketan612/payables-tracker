# Payables Tracker

Payables Tracker is a responsive personal-finance web application backed by Supabase and deployed through Vercel.

## Application modules

- Dashboard and pending overview
- Payables, settlements and shared expenses
- Credit cards and payment allocations
- Cash Book ledger and opening balances
- EMI schedules and reminders
- People and account mapping
- SMS capture, review and admin monitoring

The application uses the existing Supabase authentication, PostgreSQL data model and row-level security policies. Do not expose a Supabase service-role key in browser code.

## Run locally

This repository is a static HTML/CSS/JavaScript application. From the repository root:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. Service workers are supported on localhost and HTTPS origins.

## Progressive Web App

The application can be used in a normal browser or installed as a PWA on supported Android and iOS devices.

- `manifest.json` contains the install metadata.
- `sw.js` caches the static application shell and provides a network-offline fallback.
- `pwa.js` registers the service worker.
- `offline.html` explains when an internet connection is required.

The service worker deliberately does not cache Supabase API/auth responses, financial records, or non-GET requests. Financial writes remain online-only; offline mode must never imply that a payment or transaction was saved.

### Install

- **Android:** Open the HTTPS site in a supported browser and choose Install app / Add to Home screen.
- **iPhone:** Open the site in Safari, choose Share → Add to Home Screen, enable Open as Web App if offered, then tap Add.

PWA installation and browser access use the same application and Supabase user account. The normal browser experience remains supported.

## Development and release

- Repository: `Ketan612/payables-tracker`
- Active development/testing branch: `test/e2e-stabilization`
- Production branch: `main`

Changes should be validated on the test branch and its Vercel preview before any production promotion. Do not make schema or production data changes as part of frontend-only PWA work.
