# ◈ StockVision — AlphaVantage Dashboard
**Classe IV INF B · ITIS G. Vallauri, Fossano**

---

## Struttura Progetto

```
stockvision/
├── index.html      ← Struttura HTML (Bootstrap 5, Leaflet, Chart.js)
├── style.css       ← Stile (Dark/Light mode, responsive, animazioni)
├── script.js       ← Logica applicativa (quote, search, chart, map)
├── db.json         ← Database locale per json-server
└── README.md       ← Questo file
```

---

## Avvio Rapido

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

>  Se json-server non è attivo, l'app funziona comunque con **dati demo** incorporati.

---

## API Key AlphaVantage

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

## Tecnologie Usate

- **Bootstrap 5.3** — Layout responsive, componenti UI
- **Chart.js 4.4** — Grafici line/bar con animazioni
- **Leaflet 1.9** — Mappa interattiva OpenStreetMap
- **Nominatim API** — Geocoding gratuito (OpenStreetMap)
- **AlphaVantage API** — Dati finanziari live
- **json-server** — Backend REST locale simulato
- **Google Fonts** — Syne + JetBrains Mono

---

# Migliorie

- Theme Switcher: la tabella delle quotazioni nel tema scuro rimane bianca con testo bianco, e non si vede nulla.
- da sistemare anche i dati della tabella delle quotazioni perche sono tutti o nan o undefined
- La ricerca incremenrtale la metterei all'inizio.
- Miglioare estetica mappa e grafici
- Mettere Grafici a candela
- Downlod CSV
- Range grafico e anni grafico
- change se è in profit verde altrimenti rosso

