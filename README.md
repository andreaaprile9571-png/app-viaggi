# Evenkeel

App per viaggi di gruppo: documenti, prenotazioni e spese condivise in un posto solo.

App per gestire documenti, prenotazioni e spese condivise di un viaggio di gruppo.
Android (APK con Capacitor) e web app installabile su iPhone (PWA).

## Installare l'app

**Android:** apri la pagina [Releases](../../releases) dal telefono, scarica l'ultimo file `viaggi-di-gruppo-N.apk`,
aprilo e consenti l'installazione da questa fonte. Ogni push su `main` compila un nuovo APK (GitHub Actions → *Android APK*).

**iPhone:** apri `https://andreaaprile9571-png.github.io/app-viaggi/` con **Safari** → Condividi → **Aggiungi alla schermata Home**.
Le notifiche e l'offline funzionano solo dall'icona sulla Home.

## Architettura

| Parte | Tecnologia |
| --- | --- |
| Interfaccia | React 19 + Vite + TypeScript, PWA (vite-plugin-pwa) |
| App Android | Capacitor 8 (cartella `android/`), APK compilato da GitHub Actions |
| Backend | Supabase, progetto `app-viaggi`, regione eu-central-1 (Francoforte) |
| Database | Postgres con regole di accesso per riga (RLS): `supabase/migrations/001_init.sql` |
| File | Storage privato `trip-files`, percorsi `<viaggio>/docs/…` e `<viaggio>/receipts/…` |
| Calendario | Edge Function `calendar` (feed ICS con token segreto) |
| Web app | GitHub Pages (`.github/workflows/pages.yml`); `netlify.toml` pronto se si torna su Netlify |
| Integrazioni gratuite | Open-Meteo (meteo, ricerca luoghi), Frankfurter/BCE (cambi), link Maps/Apple Mappe, WhatsApp, PayPal.me |
| Lettura scontrini | Tesseract.js sul dispositivo (nessuna foto inviata a terzi) |

## Sviluppo

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # web app in dist/
npx cap sync android # copia dist/ nel progetto Android
```

Variabili in `.env` (la chiave Supabase è "publishable": è fatta per stare nel client; la sicurezza la fanno le regole RLS).

## Configurazioni da fare a mano

1. **Supabase › Authentication › URL Configuration:** Site URL `https://andreaaprile9571-png.github.io/app-viaggi/`
   e la stessa voce tra i Redirect URLs (serve ai link di conferma email e di reset password).
2. **Supabase › Authentication › Providers › Email:** per la beta disattiva *Confirm email*, oppure configura un SMTP
   (es. Resend): il server email integrato di Supabase invia solo a pochi indirizzi e con limiti orari.
3. **GitHub › Settings › Pages › Source:** *GitHub Actions*.
4. **GitHub › Settings › Secrets and variables › Actions › Variables (facoltativo):** `CONTACT_EMAIL`, `PUBLIC_URL`.

## Cosa manca rispetto all'MVP completo

- Ricezione di file da "Condividi" di Android direttamente nell'app (per ora: Scegli file → l'app di Drive/Dropbox/File).
- APK firmato per il Play Store (ora è firmato in modalità debug, adatto all'installazione diretta).
- Revisione legale di Privacy e Termini (le pagine nell'app sono una sintesi per la beta).
