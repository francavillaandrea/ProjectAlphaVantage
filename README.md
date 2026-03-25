# ◈ StockVision — AlphaVantage Dashboard
**Progetto Scolastico · Classe IV INF B · ITIS G. Vallauri, Fossano**

---

## 📁 Struttura Progetto

```
stockvision/
├── index.html      ← Struttura HTML (Bootstrap 5, Leaflet, Chart.js)
├── style.css       ← Stile (Dark/Light mode, responsive, animazioni)
├── script.js       ← Logica applicativa (quote, search, chart, map)
├── db.json         ← Database locale per json-server
└── README.md       ← Questo file
```

---

## 🚀 Avvio Rapido

### 1. Installa json-server (una volta sola)
```bash
npm install -g json-server
```

### 2. Avvia il backend locale
Dalla cartella del progetto:
```bash
json-server --watch db.json --port 3000
```

### 3. Apri il progetto
Apri `index.html` nel browser (o usa Live Server in VSCode).

> ⚠️ Se json-server non è attivo, l'app funziona comunque con **dati demo** incorporati.

---

## 🔑 API Key AlphaVantage

1. Registrati su https://www.alphavantage.co/support/#api-key
2. In `script.js`, sostituisci:
   ```js
   AV_KEY: 'demo',
   ```
   con la tua chiave personale:
   ```js
   AV_KEY: 'LA_TUA_API_KEY',
   ```

---

## ✅ Requisiti Soddisfatti (dal PDF)

| # | Requisito | Stato |
|---|-----------|-------|
| 1 | Bootstrap responsive + mobile-first | ✅ |
| 2 | db.json con 20+ aziende (simbolo + nome) | ✅ |
| 2 | Combo box caricata da json-server + GLOBAL_QUOTE | ✅ |
| 3 | SYMBOL_SEARCH incrementale (≥2 chars, onkeyup, lato client) | ✅ |
| 4 | OVERVIEW con nome, indirizzo, sito web | ✅ |
| 5 | Grafici storici con selezione periodo e tipo (line/bar) | ✅ |
| 6 | Pulsante salvataggio grafico come PNG | ✅ |
| 7 | Geo-visualizzazione sede su mappa (Leaflet + Nominatim) | ✅ |
| BP | Best practice: DB locale, pulsante Update live | ✅ |
| BP | Ricerca incrementale filtrata lato client | ✅ |

---

## ✨ Funzioni Extra (oltre la traccia)

| Funzione | Descrizione |
|----------|-------------|
| 🌙 **Dark/Light Mode** | Toggle con icona, preferenza salvata in localStorage |
| 🔔 **Toast Notifications** | Feedback visivo per ogni azione (successo/errore/warning) |
| 📍 **Geocoding automatico** | Nominatim (OpenStreetMap) converte l'indirizzo in coordinate |
| 🗺️ **Mappa Leaflet interattiva** | Marker animato con popup, tile invertite in dark mode |
| 📊 **Grafici responsivi** | Chart.js con gradiente, tooltip personalizzati, tema-aware |
| 🔍 **Ricerca con highlight** | Il testo trovato viene evidenziato nei risultati |
| ♿ **Accessibilità** | aria-label, aria-live, ruoli ARIA, focus visibile, contrasti WCAG |
| 📱 **Mobile-first** | Layout perfetto da 320px a 4K |
| 🎨 **UI "wow"** | Font Syne + JetBrains Mono, griglia animata, glow effects |
| ❓ **FAQ Accordion** | Sezione informativa con accordion Bootstrap |
| 🔄 **Fallback intelligente** | Dati demo se json-server è offline |
| 🔆 **Navbar sticky** | Con highlight automatico della sezione attiva |

---

## 📚 Tecnologie Usate

- **Bootstrap 5.3** — Layout responsive, componenti UI
- **Chart.js 4.4** — Grafici line/bar con animazioni
- **Leaflet 1.9** — Mappa interattiva OpenStreetMap
- **Nominatim API** — Geocoding gratuito (OpenStreetMap)
- **AlphaVantage API** — Dati finanziari live
- **json-server** — Backend REST locale simulato
- **Google Fonts** — Syne + JetBrains Mono

---

## 💡 Architettura JS

Il codice è organizzato in moduli logici commentati:
- `CONFIG` — URL e chiavi API
- `UTILS` — Funzioni helper (formatNum, toast, ecc.)
- `THEME` — Gestione dark/light mode
- `INIT` — Caricamento iniziale da json-server
- `QUOTE` — Sezione GLOBAL_QUOTE
- `SEARCH` — Ricerca incrementale SYMBOL_SEARCH
- `CHART` — Grafici Chart.js con salvataggio PNG
- `OVERVIEW` — Scheda aziendale
- `MAP` — Geo-localizzazione con Leaflet
