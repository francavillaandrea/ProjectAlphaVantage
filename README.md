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
json-server ./data/db.json
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
- **Nominatim API** — Geocoding gratuito (OpenStreetMap)
- **AlphaVantage API** — Dati finanziari live
- **json-server** — Backend REST locale simulato
- **Google Fonts** — Syne + JetBrains Mono

# Migliorie
- il CSV deve essere su colonne diverse
- il change deve essere verde se positivo rosso se negatiuvo anche nella tabella


