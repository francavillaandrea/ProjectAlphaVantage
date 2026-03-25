/**
 * StockVision — script.js
 * ──────────────────────────────────────────────────────
 * Progetto AlphaVantage · Classe IV INF B · ITIS Vallauri
 *
 * Architettura:
 *  - CONFIG: costanti globali (URL, API key)
 *  - UTILS:  funzioni helper (toast, formatNumbers, ecc.)
 *  - THEME:  gestione dark/light mode
 *  - INIT:   caricamento iniziale aziende da json-server
 *  - QUOTE:  sezione GLOBAL_QUOTE
 *  - SEARCH: sezione SYMBOL_SEARCH (ricerca incrementale lato client)
 *  - CHART:  sezione grafici (Chart.js, line/bar, salvataggio PNG)
 *  - OVERVIEW: sezione company overview
 *  - MAP:    geo-visualizzazione sede (Leaflet + Nominatim geocoding)
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════ */
const CONFIG = {
  // json-server locale (default: porta 3000)
  JSON_SERVER: 'http://localhost:3000',

  // La tua API key AlphaVantage (sostituisci con la tua!)
  AV_KEY: 'demo',
  AV_BASE: 'https://www.alphavantage.co/query',
};


/* ═══════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════ */

/**
 * Mostra una notifica toast.
 * @param {string} msg     - Testo del messaggio
 * @param {'success'|'error'|'warning'} type - Tipo
 */
function showToast(msg, type = 'success') {
  const toastEl = document.getElementById('liveToast');
  const msgEl   = document.getElementById('toastMessage');

  // Rimuovi classi precedenti e aggiungi quella corretta
  toastEl.classList.remove('success', 'error', 'warning');
  toastEl.classList.add(type);

  // Icona in base al tipo
  const icons = { success: '✓', error: '✗', warning: '⚠' };
  msgEl.innerHTML = `<span style="margin-right:.5rem">${icons[type] || ''}</span>${msg}`;

  const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3500 });
  toast.show();
}

/**
 * Formatta un numero con separatori delle migliaia.
 * @param {string|number} val
 * @returns {string}
 */
function formatNum(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/**
 * Formatta un grande numero (volume) in forma abbreviata.
 * @param {string|number} val
 * @returns {string}
 */
function formatVolume(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return val;
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

/**
 * Restituisce la classe CSS in base al segno del cambio.
 * @param {string|number} val
 * @returns {string} 'positive' | 'negative' | ''
 */
function changeClass(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '';
  return n >= 0 ? 'positive' : 'negative';
}

/**
 * Genera dati "demo" per il grafico, simulando prezzi storici
 * a partire dall'ultimo prezzo della quotazione locale.
 * In un progetto reale questi arriverebbero da TIME_SERIES_DAILY/WEEKLY/MONTHLY.
 * @param {number} basePrice
 * @param {number} days
 * @returns {{ labels: string[], prices: number[] }}
 */
function generateDemoTimeSeries(basePrice, days) {
  const labels = [];
  const prices = [];
  const today  = new Date();
  let price    = basePrice * (0.75 + Math.random() * 0.3); // punto di partenza

  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // salta weekend
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    labels.push(d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
    // variazione casuale tra -3% e +3%
    price *= 1 + (Math.random() - 0.48) * 0.06;
    prices.push(parseFloat(price.toFixed(2)));
  }

  // Forza l'ultimo punto al prezzo attuale
  if (prices.length > 0) prices[prices.length - 1] = parseFloat(basePrice);

  return { labels, prices };
}


/* ═══════════════════════════════════════════════════════
   DARK / LIGHT MODE
═══════════════════════════════════════════════════════ */

const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon      = document.getElementById('themeIcon');

/**
 * Applica il tema e aggiorna l'icona del toggle.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    themeIcon.className = 'bi bi-sun-fill';
  } else {
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    themeIcon.className = 'bi bi-moon-fill';
  }
  localStorage.setItem('sv_theme', theme);

  // Aggiorna grafico esistente se presente
  if (currentChart) redrawChart();
}

// Carica preferenza salvata
const savedTheme = localStorage.getItem('sv_theme') || 'dark';
applyTheme(savedTheme);

// Toggle al click
themeToggleBtn.addEventListener('click', () => {
  const isLight = document.body.classList.contains('light-mode');
  applyTheme(isLight ? 'dark' : 'light');
});


/* ═══════════════════════════════════════════════════════
   INIT — Caricamento aziende da json-server
═══════════════════════════════════════════════════════ */

/** Array globale delle aziende caricato da json-server */
let aziende = [];

/** Cache delle quotazioni caricate */
const quoteCache = {};

/**
 * Carica l'elenco aziende da json-server e popola tutte le select.
 * Se json-server non è raggiungibile, usa dati di fallback.
 */
async function loadAziende() {
  try {
    const res = await fetch(`${CONFIG.JSON_SERVER}/aziende`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    aziende = await res.json();
  } catch (err) {
    console.warn('⚠ json-server non raggiungibile, uso dati demo:', err.message);
    // Dati di fallback se json-server è offline
    aziende = [
      { id: 1,  symbol: 'AAPL',  name: 'Apple Inc' },
      { id: 2,  symbol: 'MSFT',  name: 'Microsoft Corporation' },
      { id: 3,  symbol: 'GOOGL', name: 'Alphabet Inc' },
      { id: 4,  symbol: 'AMZN',  name: 'Amazon.com Inc' },
      { id: 5,  symbol: 'TSLA',  name: 'Tesla Inc' },
      { id: 6,  symbol: 'NVDA',  name: 'NVIDIA Corporation' },
      { id: 7,  symbol: 'IBM',   name: 'International Business Machines Corp' },
      { id: 8,  symbol: 'SNE',   name: 'Sony Group Corporation' },
      { id: 9,  symbol: 'BABA',  name: 'Alibaba Group Holding' },
      { id: 10, symbol: 'XIACF', name: 'Xiaomi Corporation' },
      { id: 11, symbol: 'META',  name: 'Meta Platforms Inc' },
      { id: 12, symbol: 'NFLX',  name: 'Netflix Inc' },
      { id: 13, symbol: 'INTC',  name: 'Intel Corporation' },
      { id: 14, symbol: 'AMD',   name: 'Advanced Micro Devices Inc' },
      { id: 15, symbol: 'ORCL',  name: 'Oracle Corporation' },
    ];
    showToast('json-server non trovato: usando dati demo locali', 'warning');
  }

  // Popola tutte le <select>
  populateSelect('companySelect', aziende, '— Scegli un\'azienda —');
  populateSelect('chartSymbol',   aziende, '— Seleziona —');
  populateSelect('overviewSymbol',aziende, '— Seleziona —');
  populateSelect('mapSymbol',     aziende, '— Seleziona —');

  // Aggiorna stat hero
  document.getElementById('statAziende').textContent = aziende.length;
}

/**
 * Popola una <select> con l'elenco delle aziende.
 * @param {string} selectId   - ID dell'elemento <select>
 * @param {Array}  list       - Array delle aziende
 * @param {string} placeholder- Testo primo option
 */
function populateSelect(selectId, list, placeholder) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  list.forEach(az => {
    const opt = document.createElement('option');
    opt.value       = az.symbol;
    opt.textContent = `${az.symbol} — ${az.name}`;
    sel.appendChild(opt);
  });
}


/* ═══════════════════════════════════════════════════════
   SEZIONE 1 — GLOBAL_QUOTE
═══════════════════════════════════════════════════════ */

document.getElementById('btnQuote').addEventListener('click', loadQuote);
document.getElementById('btnUpdateQuote').addEventListener('click', updateQuoteFromAV);

/**
 * Carica la quotazione dal DB locale (json-server).
 */
async function loadQuote() {
  const symbol = document.getElementById('companySelect').value;
  if (!symbol) { showToast('Seleziona un\'azienda prima!', 'warning'); return; }

  const loading = document.getElementById('quoteLoading');
  loading.style.display = 'flex';

  try {
    let quoteData;

    // Prima cerca nella cache
    if (quoteCache[symbol]) {
      quoteData = quoteCache[symbol];
    } else {
      // Tenta json-server
      try {
        const res = await fetch(`${CONFIG.JSON_SERVER}/GLOBAL_QUOTE`);
        if (!res.ok) throw new Error('json-server offline');
        const quotes = await res.json();
        // Filtra per simbolo (ricerca lato client)
        quoteData = quotes.find(q => q.symbol.toUpperCase() === symbol.toUpperCase());
        if (quoteData) quoteCache[symbol] = quoteData;
      } catch {
        quoteData = null;
      }
    }

    if (!quoteData) {
      // Genera dati demo se non trovati
      quoteData = generateDemoQuote(symbol);
      showToast(`Dati demo per ${symbol} (avvia json-server per dati reali)`, 'warning');
    }

    renderQuoteTable(quoteData);
  } catch (err) {
    showToast(`Errore nel caricamento: ${err.message}`, 'error');
  } finally {
    loading.style.display = 'none';
  }
}

/**
 * Genera dati di quotazione demo per un simbolo non trovato nel DB.
 * @param {string} symbol
 * @returns {Object}
 */
function generateDemoQuote(symbol) {
  const base = 100 + Math.random() * 400;
  const chg  = (Math.random() - 0.5) * 10;
  return {
    symbol,
    open:            (base - 1).toFixed(4),
    high:            (base + 2).toFixed(4),
    low:             (base - 3).toFixed(4),
    price:           base.toFixed(4),
    volume:          Math.floor(Math.random() * 50_000_000).toString(),
    latestTradingDay: new Date().toISOString().split('T')[0],
    previousClose:   (base - chg).toFixed(4),
    change:          chg.toFixed(4),
    changePercent:   ((chg / (base - chg)) * 100).toFixed(4) + '%',
  };
}

/**
 * Esegue una chiamata live ad AlphaVantage e aggiorna il DB locale.
 */
async function updateQuoteFromAV() {
  const symbol = document.getElementById('companySelect').value;
  if (!symbol) { showToast('Seleziona prima un\'azienda!', 'warning'); return; }

  const loading = document.getElementById('quoteLoading');
  loading.style.display = 'flex';

  try {
    const url = `${CONFIG.AV_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${CONFIG.AV_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const q = json['Global Quote'];
    if (!q || !q['01. symbol']) throw new Error('Nessun dato ricevuto (verifica API key o limite raggiunto)');

    // Normalizza
    const quoteData = {
      symbol:           q['01. symbol'],
      open:             q['02. open'],
      high:             q['03. high'],
      low:              q['04. low'],
      price:            q['05. price'],
      volume:           q['06. volume'],
      latestTradingDay: q['07. latest trading day'],
      previousClose:    q['08. previous close'],
      change:           q['09. change'],
      changePercent:    q['10. change percent'],
    };

    quoteCache[symbol] = quoteData;
    renderQuoteTable(quoteData);
    showToast(`✓ Dati live di ${symbol} aggiornati!`, 'success');
  } catch (err) {
    showToast(`Errore AlphaVantage: ${err.message}`, 'error');
  } finally {
    loading.style.display = 'none';
  }
}

/**
 * Renderizza i dati di quotazione nella tabella HTML.
 * @param {Object} q - Oggetto quotazione
 */
function renderQuoteTable(q) {
  const wrapper = document.getElementById('quoteTableWrapper');
  const tbody   = document.getElementById('quoteTableBody');

  const chgClass = changeClass(q.change);
  const chgSign  = parseFloat(q.change) >= 0 ? '+' : '';

  tbody.innerHTML = `
    <tr class="slide-in">
      <td><span class="symbol-badge">${q.symbol}</span></td>
      <td>$${formatNum(q.open)}</td>
      <td>$${formatNum(q.high)}</td>
      <td>$${formatNum(q.low)}</td>
      <td style="font-weight:700">$${formatNum(q.price)}</td>
      <td>${formatVolume(q.volume)}</td>
      <td>$${formatNum(q.previousClose)}</td>
      <td class="${chgClass}">${chgSign}${formatNum(q.change)}</td>
      <td class="${chgClass}">${chgSign}${parseFloat(q.changePercent).toFixed(2)}%</td>
    </tr>
  `;

  wrapper.style.display = 'block';
}


/* ═══════════════════════════════════════════════════════
   SEZIONE 2 — SYMBOL_SEARCH (ricerca incrementale)
═══════════════════════════════════════════════════════ */

const searchInput = document.getElementById('searchInput');

// Evento keyup: attiva la ricerca con almeno 2 caratteri
searchInput.addEventListener('keyup', () => {
  const query = searchInput.value.trim();
  if (query.length >= 2) {
    performSearch(query);
  } else {
    document.getElementById('searchResults').innerHTML = '';
  }
});

/**
 * Filtra le aziende lato client (simulazione SYMBOL_SEARCH locale).
 * Come indicato nel PDF, json-server non supporta la ricerca full-text
 * nativa, quindi si carica l'intero array e si filtra in JS.
 * @param {string} query
 */
function performSearch(query) {
  const q       = query.toLowerCase();
  const results = aziende.filter(
    az => az.name.toLowerCase().includes(q) || az.symbol.toLowerCase().includes(q)
  );
  renderSearchResults(results, query);
}

/**
 * Renderizza le card dei risultati di ricerca.
 * @param {Array}  results
 * @param {string} query
 */
function renderSearchResults(results, query) {
  const container = document.getElementById('searchResults');

  if (results.length === 0) {
    container.innerHTML = `<p class="no-results"><i class="bi bi-search me-2"></i>Nessuna azienda trovata per "<strong>${query}</strong>"</p>`;
    return;
  }

  // Evidenzia il testo trovato
  const highlight = (text) => {
    const re = new RegExp(`(${query})`, 'gi');
    return text.replace(re, `<mark style="background:var(--accent-dim);color:var(--accent);border-radius:3px;padding:0 2px;">$1</mark>`);
  };

  container.innerHTML = results.map(az => `
    <div class="search-result-card slide-in"
         role="button"
         tabindex="0"
         aria-label="Seleziona ${az.name}"
         onclick="selectFromSearch('${az.symbol}')"
         onkeydown="if(event.key==='Enter')selectFromSearch('${az.symbol}')">
      <div class="result-symbol">${highlight(az.symbol)}</div>
      <div class="result-name">${highlight(az.name)}</div>
    </div>
  `).join('');
}

/**
 * Seleziona un'azienda dai risultati di ricerca e carica la quotazione.
 * @param {string} symbol
 */
function selectFromSearch(symbol) {
  // Imposta il simbolo nella select principale e carica la quotazione
  const sel = document.getElementById('companySelect');
  sel.value = symbol;

  // Scorri alla sezione quotazione
  document.getElementById('section-quote').scrollIntoView({ behavior: 'smooth' });
  showToast(`Azienda ${symbol} selezionata`, 'success');
  loadQuote();
}


/* ═══════════════════════════════════════════════════════
   SEZIONE 3 — GRAFICI STORICI
═══════════════════════════════════════════════════════ */

let currentChart = null;   // Istanza Chart.js attiva
let lastChartData = null;  // Ultimi dati usati per ridisegnare al cambio tema

document.getElementById('btnChart').addEventListener('click', loadChart);

/**
 * Carica e genera il grafico per l'azienda selezionata.
 */
async function loadChart() {
  const symbol  = document.getElementById('chartSymbol').value;
  const period  = parseInt(document.getElementById('chartPeriod').value, 10);
  const type    = document.getElementById('chartType').value;

  if (!symbol) { showToast('Seleziona un\'azienda per il grafico!', 'warning'); return; }

  // Cerca il prezzo base dalla quotazione locale o usa 150 come fallback
  let basePrice = 150;
  try {
    const res    = await fetch(`${CONFIG.JSON_SERVER}/GLOBAL_QUOTE`);
    const quotes = await res.json();
    const found  = quotes.find(q => q.symbol.toUpperCase() === symbol.toUpperCase());
    if (found) basePrice = parseFloat(found.price);
  } catch { /* usa fallback */ }

  const { labels, prices } = generateDemoTimeSeries(basePrice, period);
  lastChartData = { symbol, type, labels, prices };
  renderChart(symbol, type, labels, prices);
}

/**
 * Renderizza (o aggiorna) il grafico Chart.js.
 */
function renderChart(symbol, type, labels, prices) {
  const isDark   = document.body.classList.contains('dark-mode');
  const accentColor = isDark ? '#00e5a0' : '#0066cc';
  const gridColor   = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const textColor   = isDark ? '#8b93a8' : '#4a5168';

  document.getElementById('chartPlaceholder').style.display = 'none';
  document.getElementById('chartBox').style.display = 'block';
  document.getElementById('chartTitle').textContent =
    `${symbol} — Ultimi ${labels.length} giorni di trading`;

  const ctx = document.getElementById('stockChart').getContext('2d');

  // Distruggi il grafico precedente se esiste
  if (currentChart) currentChart.destroy();

  currentChart = new Chart(ctx, {
    type: type,   // 'line' o 'bar'
    data: {
      labels,
      datasets: [{
        label: `${symbol} Prezzo di Chiusura ($)`,
        data:  prices,
        borderColor:     accentColor,
        backgroundColor: type === 'bar'
          ? accentColor + '66'  // bar: 40% opacity
          : function(ctx) {     // line: gradiente
              const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 360);
              g.addColorStop(0, accentColor + '40');
              g.addColorStop(1, accentColor + '00');
              return g;
            },
        borderWidth: type === 'bar' ? 0 : 2,
        pointRadius:      type === 'line' ? 3 : 0,
        pointHoverRadius: 5,
        pointBackgroundColor: accentColor,
        fill: type === 'line',
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 600, easing: 'easeInOutQuart' },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: textColor,
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            boxWidth: 12,
          }
        },
        tooltip: {
          backgroundColor: isDark ? '#191d26' : '#ffffff',
          titleColor:  accentColor,
          bodyColor:   isDark ? '#f0f4ff' : '#0d1117',
          borderColor: accentColor + '40',
          borderWidth: 1,
          padding: 10,
          titleFont: { family: "'Syne', sans-serif", weight: 700 },
          bodyFont:  { family: "'JetBrains Mono', monospace" },
          callbacks: {
            label: ctx => ` $${formatNum(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid:  { color: gridColor },
          ticks: {
            color: textColor,
            font:  { family: "'JetBrains Mono', monospace", size: 10 },
            maxTicksLimit: 10,
          }
        },
        y: {
          grid:  { color: gridColor },
          ticks: {
            color: textColor,
            font:  { family: "'JetBrains Mono', monospace", size: 10 },
            callback: v => `$${v.toFixed(0)}`
          }
        }
      }
    }
  });
}

/**
 * Ridisegna il grafico attuale mantenendo i dati (usato al cambio tema).
 */
function redrawChart() {
  if (!lastChartData) return;
  const { symbol, type, labels, prices } = lastChartData;
  renderChart(symbol, type, labels, prices);
}

/* Salva grafico come PNG */
document.getElementById('btnSaveChart').addEventListener('click', () => {
  if (!currentChart) return;
  const a    = document.createElement('a');
  a.href     = currentChart.toBase64Image('image/png', 1.0);
  const sym  = document.getElementById('chartSymbol').value || 'chart';
  a.download = `stockvision_${sym}_${new Date().toISOString().split('T')[0]}.png`;
  a.click();
  showToast('Grafico salvato come PNG!', 'success');
});


/* ═══════════════════════════════════════════════════════
   SEZIONE 4 — COMPANY OVERVIEW
═══════════════════════════════════════════════════════ */

document.getElementById('btnOverview').addEventListener('click', loadOverview);

/**
 * Carica i dati overview dal DB locale.
 */
async function loadOverview() {
  const symbol = document.getElementById('overviewSymbol').value;
  if (!symbol) { showToast('Seleziona un\'azienda per l\'overview!', 'warning'); return; }

  let overviewData = null;

  try {
    const res  = await fetch(`${CONFIG.JSON_SERVER}/OVERVIEW`);
    if (!res.ok) throw new Error('json-server offline');
    const list = await res.json();
    overviewData = list.find(o => o.Symbol.toUpperCase() === symbol.toUpperCase());
  } catch { /* fallback */ }

  if (!overviewData) {
    // Genera dati demo
    const az = aziende.find(a => a.symbol === symbol) || { name: symbol };
    overviewData = {
      Symbol:       symbol,
      Name:         az.name,
      Description:  `${az.name} è una delle aziende leader nel settore tecnologico globale, con presenza in numerosi mercati internazionali.`,
      Address:      '1 TECH STREET, SAN FRANCISCO, CA, US',
      OfficialSite: `https://www.google.com/search?q=${encodeURIComponent(az.name)}`,
      Sector:       'Technology',
      MarketCap:    'N/A',
    };
    showToast('Dati demo — avvia json-server per dati reali', 'warning');
  }

  renderOverviewCard(overviewData);

  // Aggiorna anche la select della mappa
  document.getElementById('mapSymbol').value = symbol;
}

/**
 * Renderizza la card overview dell'azienda.
 * @param {Object} d - Dati overview
 */
function renderOverviewCard(d) {
  const card = document.getElementById('overviewCard');

  card.innerHTML = `
    <div class="overview-card">
      <div class="overview-header">
        <div class="overview-logo" aria-hidden="true">
          ${d.Symbol.charAt(0)}
        </div>
        <div>
          <div class="overview-title">${d.Name}</div>
          <div class="overview-symbol">${d.Symbol}</div>
        </div>
      </div>

      <div class="overview-meta">
        ${d.Address ? `
          <div class="overview-meta-item">
            <i class="bi bi-geo-alt" aria-hidden="true"></i>
            <span>${d.Address}</span>
          </div>` : ''}
        ${d.OfficialSite ? `
          <div class="overview-meta-item">
            <i class="bi bi-globe" aria-hidden="true"></i>
            <a href="${d.OfficialSite}" target="_blank" rel="noopener noreferrer">
              ${d.OfficialSite.replace(/^https?:\/\//, '')}
            </a>
          </div>` : ''}
        ${d.Sector ? `
          <div class="overview-meta-item">
            <i class="bi bi-tag" aria-hidden="true"></i>
            <span>${d.Sector}</span>
          </div>` : ''}
      </div>

      ${d.Description ? `
        <p class="overview-desc">${d.Description}</p>` : ''}

      <div class="overview-stats-grid">
        <div class="overview-stat">
          <span class="overview-stat-label">Simbolo</span>
          <span class="overview-stat-val">${d.Symbol}</span>
        </div>
        ${d.MarketCap && d.MarketCap !== 'N/A' ? `
        <div class="overview-stat">
          <span class="overview-stat-label">Market Cap</span>
          <span class="overview-stat-val">${d.MarketCap}</span>
        </div>` : ''}
        ${d.Sector ? `
        <div class="overview-stat">
          <span class="overview-stat-label">Settore</span>
          <span class="overview-stat-val" style="font-size:.9rem">${d.Sector}</span>
        </div>` : ''}
        <div class="overview-stat">
          <span class="overview-stat-label">Mercato</span>
          <span class="overview-stat-val">NYSE</span>
        </div>
      </div>
    </div>
  `;

  card.style.display = 'block';
}


/* ═══════════════════════════════════════════════════════
   SEZIONE 5 — MAPPA (Leaflet + Nominatim)
═══════════════════════════════════════════════════════ */

let leafletMap    = null;
let leafletMarker = null;

document.getElementById('btnMap').addEventListener('click', showOnMap);

/**
 * Carica l'indirizzo dall'overview e lo geo-localizza con Nominatim.
 */
async function showOnMap() {
  const symbol = document.getElementById('mapSymbol').value;
  if (!symbol) { showToast('Seleziona un\'azienda per la mappa!', 'warning'); return; }

  // Recupera l'indirizzo
  let address = null;
  let companyName = symbol;

  try {
    const res  = await fetch(`${CONFIG.JSON_SERVER}/OVERVIEW`);
    const list = await res.json();
    const data = list.find(o => o.Symbol.toUpperCase() === symbol.toUpperCase());
    if (data) {
      address     = data.Address;
      companyName = data.Name;
    }
  } catch { /* usa fallback */ }

  if (!address) {
    // Fallback: coordi di Silicon Valley
    address = '1 Tech Street, San Francisco, CA, US';
    showToast('Indirizzo non trovato nel DB — mostrando posizione di default', 'warning');
  }

  // Geocoding tramite Nominatim (OpenStreetMap, gratuito)
  try {
    const encoded = encodeURIComponent(address);
    const geoRes  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'it' } }
    );
    const geoData = await geoRes.json();

    let lat, lon;
    if (geoData && geoData.length > 0) {
      lat = parseFloat(geoData[0].lat);
      lon = parseFloat(geoData[0].lon);
    } else {
      // Se il geocoding fallisce, usa coordinate di New York
      lat = 40.7128;
      lon = -74.0060;
      showToast('Geocoding non riuscito: mostro posizione approssimativa', 'warning');
    }

    initOrUpdateMap(lat, lon, companyName, address);
  } catch (err) {
    showToast(`Errore mappa: ${err.message}`, 'error');
  }
}

/**
 * Inizializza o aggiorna la mappa Leaflet.
 * @param {number} lat
 * @param {number} lon
 * @param {string} name    - Nome dell'azienda
 * @param {string} address - Indirizzo
 */
function initOrUpdateMap(lat, lon, name, address) {
  // Crea la mappa alla prima chiamata
  if (!leafletMap) {
    leafletMap = L.map('map', { zoomControl: true }).setView([lat, lon], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletMap);
  } else {
    leafletMap.setView([lat, lon], 14);
    if (leafletMarker) leafletMap.removeLayer(leafletMarker);
  }

  // Marker personalizzato
  const customIcon = L.divIcon({
    html: `<div style="
      background:var(--accent,#00e5a0);
      width:14px;height:14px;
      border-radius:50%;
      border:3px solid white;
      box-shadow:0 0 12px rgba(0,229,160,0.7);
    "></div>`,
    className: '',
    iconSize:   [14, 14],
    iconAnchor: [7, 7],
  });

  leafletMarker = L.marker([lat, lon], { icon: customIcon })
    .addTo(leafletMap)
    .bindPopup(`
      <strong style="font-family:'Syne',sans-serif">${name}</strong><br/>
      <small>${address}</small>
    `, { maxWidth: 280 })
    .openPopup();

  // Badge indirizzo
  const badge = document.getElementById('mapAddressBadge');
  badge.innerHTML = `<i class="bi bi-geo-alt-fill me-1" style="color:var(--accent)"></i>${address}`;
  badge.style.display = 'block';

  // Invalidate size (necessario se il container era nascosto)
  setTimeout(() => leafletMap.invalidateSize(), 200);

  document.getElementById('section-map').scrollIntoView({ behavior: 'smooth' });
}


/* ═══════════════════════════════════════════════════════
   AVVIO
═══════════════════════════════════════════════════════ */

// Carica le aziende al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
  loadAziende();

  // Navbar: evidenzia la sezione corrente durante lo scroll
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -40% 0px' });

  sections.forEach(s => observer.observe(s));
});
