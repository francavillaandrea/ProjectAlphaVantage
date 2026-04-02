# ◈ StockVision — AlphaVantage Dashboard
**Classe IV INF B · IIS G. Vallauri, Fossano**

Una dashboard web interattiva e **completamente responsive** per monitorare i mercati finanziari in tempo reale. Permette di cercare aziende quotate in borsa, visualizzare quotazioni, grafici storici, dati aziendali e geo-localizzare le sedi su mappa.

---

## Funzionalità Principali

- **Ricerca Incrementale**: Cerca aziende per nome o simbolo con highlight dei risultati. In modalità live usa `SYMBOL_SEARCH` di AlphaVantage in tempo reale; in modalità locale filtra lato client.
- **Sorgente Dati Selezionabile**: Switcher in navbar per passare tra **JSON locale** (json-server) e **AlphaVantage live**, senza ricaricare la pagina.
- **Quotazioni in Tempo Reale** (`GLOBAL_QUOTE`): Tabella con open, high, low, price, volume, previous close, change e change% con colori verde/rosso.
- **Grafici Storici**: 6 tipi di grafico selezionabili con range temporale da 6 mesi a tutto lo storico disponibile.
- **Export PNG e TSV**: Salva il grafico come immagine o scarica i dati su file con colonne separate (compatibile Excel/LibreOffice).
- **Company Overview**: Scheda aziendale con descrizione, indirizzo, sito ufficiale e logo recuperato automaticamente da logo.dev.
- **Geo-localizzazione Sede**: Mappa interattiva con marker e popup della sede aziendale tramite geocoding MapTiler.
- **Dark / Light Mode**: Toggle con rilevamento automatico del tema di sistema, preferenza salvata in `localStorage`.

---

## Tecnologie Utilizzate

| Categoria | Tecnologia |
|-----------|-----------|
| **Core** | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black) |
| **Framework UI** | ![Bootstrap](https://img.shields.io/badge/Bootstrap_5-7952B3?logo=bootstrap&logoColor=white) Bootstrap Icons |
| **Librerie JS** | Axios · Chart.js 4 · chartjs-chart-financial · Luxon · MapLibre GL |
| **Librerie Custom** | `myAxios.js` · `myChart.js` · `myCharts.js` · `myMapLibre.js` |
| **Font** | [Syne](https://fonts.google.com/specimen/Syne) (display) · [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (dati) |
| **API Dati** | [AlphaVantage](https://www.alphavantage.co) |
| **API Logo** | [Logo.dev](https://www.logo.dev) (endpoint ticker) |
| **API Mappe** | [MapTiler](https://www.maptiler.com) · [OSRM](https://project-osrm.org) |
| **Backend Locale** | [json-server](https://github.com/typicode/json-server) |

---

## Come Eseguire il Progetto in Locale

### Prerequisiti

- [Node.js](https://nodejs.org) (≥ 16) per json-server
- Un browser moderno (Chrome, Firefox, Edge, Safari)

### Avvio

1. **Clona o scarica la repository:**
   ```bash
   git clone https://github.com/utente/stockvision.git
   cd stockvision
   ```

2. **Installa e avvia json-server:**
   ```bash
   npm install -g json-server
   json-server --watch db.json --port 3000
   ```
   json-server sarà raggiungibile su `http://localhost:3000`.

3. **Apri `index.html`** nel browser (o usa Live Server in VSCode).

> **Nota**: Apri sempre la pagina tramite un server locale (Live Server o json-server stesso) e non direttamente da file system, per evitare errori CORS sulle richieste API.

---

## Struttura del Progetto

```
stockvision/
├── index.html          # Struttura HTML (Bootstrap 5, sezioni, navbar)
├── style.css           # Stile completo (dark/light mode, responsive)
├── script.js           # Logica principale dell'applicazione
├── db.json             # Database locale per json-server
└── libs/
    ├── axios@1.13.min.js
    ├── chart@4.2.0.umd.min.js
    ├── mapLibre/
    │   ├── maplibre-gl.js
    │   └── maplibre-gl.css
    ├── myAxios.js       # Wrapper Axios (classe Ajax)
    ├── myChart.js       # Classe MyBarChart (base Chart.js)
    ├── myCharts.js      # ChartFactory — una classe per ogni tipo di grafico
    └── myMapLibre.js    # Wrapper MapLibre GL (geocoding, marker, routing)
```

---

## Sezioni dell'Applicazione

| # | Sezione | Descrizione |
|---|---------|-------------|
| 01 | **Ricerca Incrementale** | Ricerca live su AlphaVantage o locale su json-server con highlight |
| 02 | **Quotazione** | Tabella dati borsistici giornalieri (GLOBAL_QUOTE) |
| 03 | **Grafici Storici** | 6 tipi di grafico, range 6m–tutto, export PNG e TSV |
| 04 | **Company Overview** | Scheda aziendale con logo, descrizione e statistiche |
| 05 | **Geo-localizzazione** | Sede aziendale su mappa MapLibre con geocoding |

---

## Tipi di Grafico Disponibili

| Tipo | Descrizione |
|------|-------------|
| 📈 **Line** | Linea del prezzo di chiusura |
| 📊 **Bar** | Barre colorate verde/rosso (close ≥ open) |
| 🏔 **Area** | Line chart con gradiente riempito |
| 🕯 **Candlestick** | Grafico OHLC con tooltip dettagliato |
| 🕸 **Radar** | Distribuzione radiale dei valori di chiusura |
| 🍩 **Doughnut** | Distribuzione percentuale con legenda |

---

## Configurazione API

Sostituisci le chiavi nei primi righe di `script.js`:

```js
const AV_KEY       = "TUA_API_KEY_ALPHAVANTAGE"; // https://www.alphavantage.co/support/#api-key
const LOGO_DEV_KEY = "TUA_CHIAVE_LOGO_DEV";      // https://www.logo.dev/dashboard
```

> Il piano free di AlphaVantage consente **25 richieste/giorno** e **5 richieste/minuto**. Per questo motivo la sorgente predefinita è il JSON locale, che non consuma quota.

---

## Design Responsive

| Breakpoint | Comportamento |
|------------|---------------|
| **Mobile (<576px)** | Layout a singola colonna, tabella scrollabile, mappa 300px |
| **Tablet (≥768px)** | Controlli grafico su due righe, card ricerca a griglia |
| **Desktop (≥992px)** | Layout completo a 6 colonne per i controlli grafico |

---

## Crediti

Progetto realizzato per la **Classe IV INF B** · IIS G. Vallauri, Fossano  
Powered by [AlphaVantage](https://www.alphavantage.co) · [Logo.dev](https://www.logo.dev) · [MapTiler](https://www.maptiler.com) · [Chart.js](https://www.chartjs.org) · [MapLibre GL](https://maplibre.org)
