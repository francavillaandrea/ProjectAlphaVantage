"use strict";

// ═══════════════════════════════════════════════════════════
//  CONFIGURAZIONE
// ═══════════════════════════════════════════════════════════

const AV_KEY      = "demo";               // sostituisci con la tua API key
const AV_BASE     = "https://www.alphavantage.co/query";
const JSON_SERVER = "http://localhost:3000";

// ═══════════════════════════════════════════════════════════
//  STATO
// ═══════════════════════════════════════════════════════════

let listaAziende        = [];   // { symbol, name }
let listaOverview       = [];   // array overview
let chart               = null; // istanza Chart.js
let datiGraficoCorrente = [];   // voci per export CSV
let currentSymbol       = "";   // simbolo ultimo grafico

// ═══════════════════════════════════════════════════════════
//  SORGENTE DATI — selettore navbar
//  "local"  → tutto da json-server
//  "live"   → chiamate dirette ad AlphaVantage
// ═══════════════════════════════════════════════════════════

function getSorgente() {
    return dataSource.value;   // "local" | "live"
}

// Aggiorna la badge hero quando l'utente cambia sorgente
dataSource.addEventListener("change", function () {
    const isLive = getSorgente() === "live";
    statSource.textContent = isLive ? "AlphaVantage" : "Locale";
    showToast(isLive
        ? "Sorgente: AlphaVantage live (attenzione al limite 25 req/giorno)"
        : "Sorgente: JSON locale (json-server)",
        "warning");
});

// ═══════════════════════════════════════════════════════════
//  TEMA DARK / LIGHT
// ═══════════════════════════════════════════════════════════

function applicaTema(tema) {
    if (tema === "dark") {
        document.body.classList.remove("light-mode");
        document.body.classList.add("dark-mode");
        themeIcon.className = "bi bi-sun-fill";
    } else {
        document.body.classList.remove("dark-mode");
        document.body.classList.add("light-mode");
        themeIcon.className = "bi bi-moon-fill";
    }
    localStorage.setItem("sv_theme", tema);
}

const temaDefault = localStorage.getItem("sv_theme")
    || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
applicaTema(temaDefault);

themeToggle.addEventListener("click", function () {
    const corrente = document.body.classList.contains("dark-mode") ? "dark" : "light";
    applicaTema(corrente === "dark" ? "light" : "dark");
});

// ═══════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════

function showToast(messaggio, tipo = "success") {
    liveToast.classList.remove("success", "error", "warning");
    liveToast.classList.add(tipo);
    const icone = { success: "✓", error: "✗", warning: "⚠" };
    toastMessage.textContent = (icone[tipo] || "") + " " + messaggio;
    bootstrap.Toast.getOrCreateInstance(liveToast, { delay: 3200 }).show();
}

// ═══════════════════════════════════════════════════════════
//  AVVIO PAGINA
// ═══════════════════════════════════════════════════════════

avvioPagina();

async function avvioPagina() {
    await caricaAziende();
    await caricaOverview();
    showToast("Dati caricati correttamente.", "success");
}

// ═══════════════════════════════════════════════════════════
//  SEZIONE 1 — SYMBOL_SEARCH
//  Carica sempre dal json-server locale (Best Practice PDF):
//  i dati anagrafici cambiano raramente.
// ═══════════════════════════════════════════════════════════

async function caricaAziende() {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/symbolsearch").catch(ajax.errore);
    if (!httpResponse) return;

    // Il JSON usa "1. symbol" e "2. name"
    listaAziende = httpResponse.data.map(az => ({
        symbol: az["1. symbol"],
        name:   az["2. name"]
    }));

    popolaSelect(companySelect);
    popolaSelect(chartSymbol);
    popolaSelect(overviewSymbol);
    popolaSelect(mapSymbol);

    statAziende.textContent = listaAziende.length;
}

function popolaSelect(selectEl) {
    selectEl.innerHTML = '<option value="">— Seleziona —</option>';
    for (let az of listaAziende) {
        const opt = document.createElement("option");
        opt.value       = az.symbol;
        opt.textContent = az.symbol + " — " + az.name;
        selectEl.appendChild(opt);
    }
}

// Ricerca incrementale: keyup, almeno 2 caratteri, filtro lato client
searchInput.addEventListener("keyup", function () {
    const query = searchInput.value.trim();
    if (query.length >= 2) {
        cercaAziende(query);
    } else {
        searchResults.innerHTML = "";
    }
});

function cercaAziende(query) {
    const q = query.toLowerCase();
    const risultati = listaAziende.filter(az =>
        az.symbol.toLowerCase().includes(q) || az.name.toLowerCase().includes(q)
    );

    if (risultati.length === 0) {
        searchResults.innerHTML = '<p class="no-results">Nessuna azienda trovata per "' + query + '"</p>';
        return;
    }

    const re = new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");

    searchResults.innerHTML = risultati.map(az => {
        const symHl  = az.symbol.replace(re, "<mark>$1</mark>");
        const nameHl = az.name.replace(re, "<mark>$1</mark>");
        return `
            <div class="search-result-card"
                 role="button" tabindex="0"
                 onclick="selezionaDaRicerca('${az.symbol}')"
                 onkeydown="if(event.key==='Enter') selezionaDaRicerca('${az.symbol}')">
                <div class="result-symbol">${symHl}</div>
                <div class="result-name">${nameHl}</div>
            </div>`;
    }).join("");
}

function selezionaDaRicerca(symbol) {
    companySelect.value  = symbol;
    chartSymbol.value    = symbol;
    overviewSymbol.value = symbol;
    mapSymbol.value      = symbol;
    section_quote.scrollIntoView({ behavior: "smooth" });
    caricaQuotazione(symbol);
}

// ═══════════════════════════════════════════════════════════
//  SEZIONE 2 — GLOBAL_QUOTE
//  Routing in base alla sorgente selezionata
// ═══════════════════════════════════════════════════════════

btnQuote.addEventListener("click", function () {
    const symbol = companySelect.value;
    if (!symbol) { showToast("Seleziona prima un'azienda!", "warning"); return; }
    caricaQuotazione(symbol);
});

// Update Live: forza AlphaVantage indipendentemente dal selettore
btnUpdateQuote.addEventListener("click", function () {
    const symbol = companySelect.value;
    if (!symbol) { showToast("Seleziona prima un'azienda!", "warning"); return; }
    caricaQuotazioneAV(symbol);
});

async function caricaQuotazione(symbol) {
    if (getSorgente() === "live") {
        await caricaQuotazioneAV(symbol);
    } else {
        await caricaQuotazioneLocale(symbol);
    }
}

// ── Da json-server locale ──────────────────────────────────
async function caricaQuotazioneLocale(symbol) {
    quoteLoading.style.display      = "flex";
    quoteTableWrapper.style.display = "none";

    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/globalquote").catch(ajax.errore);
    quoteLoading.style.display = "none";
    if (!httpResponse) return;

    // Filtro lato client (json-server non supporta query su campi con spazi)
    const raw = httpResponse.data.find(q => q.symbol.toUpperCase() === symbol.toUpperCase());
    if (!raw) {
        showToast("Quotazione non trovata in locale per " + symbol, "warning");
        return;
    }

    visualizzaQuotazione(normalizzaQuote(raw));
}

// ── Da AlphaVantage live ───────────────────────────────────
async function caricaQuotazioneAV(symbol) {
    quoteLoading.style.display      = "flex";
    quoteTableWrapper.style.display = "none";

    const url = AV_BASE + "?function=GLOBAL_QUOTE&symbol=" + symbol + "&apikey=" + AV_KEY;
    const httpResponse = await ajax.sendRequest("GET", url).catch(ajax.errore);
    quoteLoading.style.display = "none";
    if (!httpResponse) return;

    const rawQuote = httpResponse.data["Global Quote"];
    if (!rawQuote || !rawQuote["01. symbol"]) {
        showToast("Nessun dato da AlphaVantage. Controlla la API key o il limite giornaliero.", "error");
        return;
    }

    visualizzaQuotazione(normalizzaQuote(rawQuote));
    showToast("Quotazione live aggiornata per " + symbol + "!", "success");
}

// Normalizza entrambi i formati: {"02. open": ...} e {"open": ...}
function normalizzaQuote(raw) {
    return {
        symbol:           raw["01. symbol"]            || raw.symbol            || "—",
        open:             raw["02. open"]               || raw.open              || "—",
        high:             raw["03. high"]               || raw.high              || "—",
        low:              raw["04. low"]                || raw.low               || "—",
        price:            raw["05. price"]              || raw.price             || "—",
        volume:           raw["06. volume"]             || raw.volume            || "0",
        latestTradingDay: raw["07. latest trading day"] || raw.latestTradingDay  || "—",
        previousClose:    raw["08. previous close"]     || raw.previousClose     || "—",
        change:           raw["09. change"]             || raw.change            || "0",
        changePercent:    raw["10. change percent"]     || raw.changePercent     || "0%",
    };
}

function visualizzaQuotazione(quote) {
    const changeVal    = parseFloat(quote.change) || 0;
    const classeChange = changeVal >= 0 ? "positive" : "negative";
    const segno        = changeVal >= 0 ? "+" : "";
    const vol          = parseInt(String(quote.volume).replace(/[^0-9]/g, "")) || 0;

    quoteTableBody.innerHTML = `
        <tr>
            <td><span class="symbol-badge">${quote.symbol}</span></td>
            <td>$${quote.open}</td>
            <td>$${quote.high}</td>
            <td>$${quote.low}</td>
            <td><strong>$${quote.price}</strong></td>
            <td>${vol.toLocaleString("it-IT")}</td>
            <td>$${quote.previousClose}</td>
            <td class="${classeChange}">${segno}${quote.change}</td>
            <td class="${classeChange}">${segno}${parseFloat(quote.changePercent).toFixed(2)}%</td>
        </tr>`;

    quoteTableWrapper.style.display = "block";
}

// ═══════════════════════════════════════════════════════════
//  SEZIONE 3 — GRAFICI STORICI
//  Line / Bar / Candlestick · Range in mesi · PNG · CSV
// ═══════════════════════════════════════════════════════════

btnChart.addEventListener("click", function () {
    const symbol = chartSymbol.value;
    if (!symbol) { showToast("Seleziona prima un'azienda!", "warning"); return; }
    generaGrafico(symbol);
});

btnSaveChart.addEventListener("click", function () {
    if (!chart) { showToast("Genera prima un grafico!", "warning"); return; }
    myBarChart.setWhiteBackground(stockChart);
    const link    = document.createElement("a");
    link.href     = stockChart.toDataURL("image/png");
    link.download = "stockvision-" + (currentSymbol || "chart") + ".png";
    link.click();
    showToast("Grafico salvato come PNG.", "success");
});

btnDownloadCsv.addEventListener("click", function () {
    if (!datiGraficoCorrente.length) { showToast("Genera prima un grafico!", "warning"); return; }
    scaricaCsv();
});

async function generaGrafico(symbol) {
    const mesi      = parseInt(chartPeriod.value);  // 9999 = tutto
    const tipoChart = chartType.value;              // line | bar | candlestick

    let voci = [];

    if (getSorgente() === "live") {
        voci = await caricaSerieAV(symbol, mesi);
    } else {
        voci = await caricaSerieLocale(symbol, mesi);
    }

    if (!voci || voci.length === 0) {
        showToast("Dati storici non trovati per " + symbol, "warning");
        return;
    }

    datiGraficoCorrente = voci;
    currentSymbol       = symbol;

    const periodoLabel = chartPeriod.options[chartPeriod.selectedIndex].text;
    const titolo       = symbol + " — " + periodoLabel;

    chartPlaceholder.style.display = "none";
    chartBox.style.display         = "block";
    chartTitle.textContent         = titolo;

    if (tipoChart === "candlestick") {
        disegnaCandlestick(symbol, voci, titolo);
    } else {
        disegnaLineBar(symbol, voci, titolo, tipoChart);
    }

    showToast("Grafico generato per " + symbol + ".", "success");
}

// ── Serie storica da json-server ───────────────────────────
async function caricaSerieLocale(symbol, mesi) {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/timeseries").catch(ajax.errore);
    if (!httpResponse) return [];

    const entry = httpResponse.data.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
    if (!entry || !entry["Monthly Time Series"]) return [];

    return estraiVoci(entry["Monthly Time Series"], mesi);
}

// ── Serie storica da AlphaVantage ──────────────────────────
async function caricaSerieAV(symbol, mesi) {
    // Sceglie il servizio in base al range
    let funzione  = "TIME_SERIES_MONTHLY";
    let chiaveSerie = "Monthly Time Series";
    if (mesi <= 3) {
        funzione    = "TIME_SERIES_DAILY";
        chiaveSerie = "Time Series (Daily)";
    } else if (mesi <= 12) {
        funzione    = "TIME_SERIES_WEEKLY";
        chiaveSerie = "Weekly Time Series";
    }

    const url = AV_BASE + "?function=" + funzione + "&symbol=" + symbol + "&apikey=" + AV_KEY;
    const httpResponse = await ajax.sendRequest("GET", url).catch(ajax.errore);
    if (!httpResponse) return [];

    const rawSerie = httpResponse.data[chiaveSerie];
    if (!rawSerie) {
        showToast("Nessuna serie da AlphaVantage. Controlla la API key.", "error");
        return [];
    }
    return estraiVoci(rawSerie, mesi);
}

// Ordina e taglia le voci
function estraiVoci(rawSerie, mesi) {
    let voci = Object.entries(rawSerie)
        .sort(([a], [b]) => new Date(a) - new Date(b));
    if (mesi !== 9999) {
        voci = voci.slice(-mesi);
    }
    return voci;
}

// ── Grafico LINE o BAR ─────────────────────────────────────
function disegnaLineBar(symbol, voci, titolo, tipoChart) {
    const labels = [];
    const values = [];
    const colors = [];

    for (let [data, candela] of voci) {
        labels.push(data.substring(0, 7));
        const close = parseFloat(candela["4. close"]);
        const open  = parseFloat(candela["1. open"]);
        values.push(close);
        // Verde se chiusura ≥ apertura, rosso altrimenti
        colors.push(close >= open ? "rgba(0,201,122,0.80)" : "rgba(255,77,109,0.80)");
    }

    myBarChart.setChartOptions(titolo, labels, values, colors);
    myBarChart.getChartOptions().type = tipoChart;

    if (chart) { chart.destroy(); chart = null; }
    chart = new Chart(stockChart, myBarChart.getChartOptions());
}

// ── Grafico CANDLESTICK ────────────────────────────────────
function disegnaCandlestick(symbol, voci, titolo) {
    const isDark  = document.body.classList.contains("dark-mode");
    const gridCol = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
    const textCol = isDark ? "#8b93a8" : "#4a5168";
    const bgCol   = isDark ? "#1a1f2e"  : "#ffffff";

    const dataPoints = voci.map(([data, candela]) => ({
        x: new Date(data).getTime(),
        o: parseFloat(candela["1. open"]),
        h: parseFloat(candela["2. high"]),
        l: parseFloat(candela["3. low"]),
        c: parseFloat(candela["4. close"]),
    }));

    if (chart) { chart.destroy(); chart = null; }

    chart = new Chart(stockChart, {
        type: "candlestick",
        data: {
            datasets: [{
                label: symbol,
                data: dataPoints,
                color: {
                    up:        "#00c97a",
                    down:      "#ff4d6d",
                    unchanged: "#aaa",
                },
                borderColor: {
                    up:        "#00c97a",
                    down:      "#ff4d6d",
                    unchanged: "#aaa",
                }
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            animation:           { duration: 500 },
            plugins: {
                title: {
                    display: true,
                    text:    titolo,
                    color:   isDark ? "#f0f4ff" : "#0d1117",
                    font:    { size: 15, weight: "bold", family: "Syne, sans-serif" }
                },
                legend: { display: false },
                tooltip: {
                    backgroundColor: bgCol,
                    titleColor:      isDark ? "#f0f4ff" : "#0d1117",
                    bodyColor:       isDark ? "#8b93a8" : "#4a5168",
                    borderColor:     isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                    borderWidth:     1,
                    padding:         10,
                    callbacks: {
                        label: function(ctx) {
                            const d = ctx.raw;
                            return [
                                "  Open:  $" + d.o.toFixed(2),
                                "  High:  $" + d.h.toFixed(2),
                                "  Low:   $" + d.l.toFixed(2),
                                "  Close: $" + d.c.toFixed(2),
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: "time",
                    time: { unit: "month", displayFormats: { month: "MMM yy" } },
                    ticks: { color: textCol, maxRotation: 0, font: { family: "JetBrains Mono, monospace", size: 10 } },
                    grid:  { color: gridCol }
                },
                y: {
                    ticks: {
                        color: textCol,
                        font:  { family: "JetBrains Mono, monospace", size: 10 },
                        callback: v => "$" + v.toFixed(0)
                    },
                    grid: { color: gridCol }
                }
            }
        }
    });
}

// ── Download CSV ───────────────────────────────────────────
function scaricaCsv() {
    const righe = ["Data,Open,High,Low,Close,Volume"];
    for (let [data, candela] of datiGraficoCorrente) {
        righe.push([
            data,
            candela["1. open"],
            candela["2. high"],
            candela["3. low"],
            candela["4. close"],
            candela["5. volume"]
        ].join(","));
    }
    const blob = new Blob([righe.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = "stockvision-" + currentSymbol + ".csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV scaricato.", "success");
}

// ═══════════════════════════════════════════════════════════
//  SEZIONE 4 — OVERVIEW
//  Routing in base alla sorgente selezionata
// ═══════════════════════════════════════════════════════════

async function caricaOverview() {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/overview").catch(ajax.errore);
    if (!httpResponse) return;
    listaOverview = httpResponse.data;
}

btnOverview.addEventListener("click", function () {
    const symbol = overviewSymbol.value;
    if (!symbol) { showToast("Seleziona prima un'azienda!", "warning"); return; }

    if (getSorgente() === "live") {
        caricaOverviewAV(symbol);
    } else {
        mostraOverview(symbol);
    }
});

// ── Overview da json-server locale ────────────────────────
function mostraOverview(symbol) {
    const dati = listaOverview.find(o => o.Symbol.toUpperCase() === symbol.toUpperCase());
    if (!dati) {
        showToast("Overview non trovata in locale per " + symbol, "warning");
        overviewCard.style.display = "none";
        return;
    }
    renderOverviewCard(dati);
}

// ── Overview da AlphaVantage live ─────────────────────────
async function caricaOverviewAV(symbol) {
    const url = AV_BASE + "?function=OVERVIEW&symbol=" + symbol + "&apikey=" + AV_KEY;
    const httpResponse = await ajax.sendRequest("GET", url).catch(ajax.errore);
    if (!httpResponse) return;

    const dati = httpResponse.data;
    if (!dati || !dati.Symbol) {
        showToast("Nessuna overview da AlphaVantage per " + symbol, "error");
        return;
    }
    renderOverviewCard(dati);
    showToast("Overview live caricata per " + symbol + ".", "success");
}

function renderOverviewCard(dati) {
    overviewCard.innerHTML = `
        <article class="overview-card">
            <div class="overview-header">
                <div class="overview-logo"><i class="bi bi-building"></i></div>
                <div>
                    <h3 class="overview-title">${dati.Name}</h3>
                    <div class="overview-symbol">${dati.Symbol}</div>
                </div>
            </div>
            <div class="overview-meta">
                <div class="overview-meta-item">
                    <i class="bi bi-geo-alt me-1"></i>
                    <span>${dati.Address || "N/D"}</span>
                </div>
                ${dati.OfficialSite ? `
                <div class="overview-meta-item">
                    <i class="bi bi-globe me-1"></i>
                    <a href="${dati.OfficialSite}" target="_blank" rel="noopener">${dati.OfficialSite}</a>
                </div>` : ""}
                ${dati.Sector ? `
                <div class="overview-meta-item">
                    <i class="bi bi-tag me-1"></i><span>${dati.Sector}</span>
                </div>` : ""}
            </div>
            ${dati.Description ? `<p class="overview-desc">${dati.Description}</p>` : ""}
            <div class="overview-stats-grid">
                ${creaStatCard("Simbolo",    dati.Symbol)}
                ${dati.MarketCapitalization ? creaStatCard("Market Cap", dati.MarketCapitalization) : ""}
                ${dati.Sector              ? creaStatCard("Settore",    dati.Sector)               : ""}
                ${dati.Exchange            ? creaStatCard("Exchange",   dati.Exchange)             : ""}
                ${dati.PERatio             ? creaStatCard("P/E Ratio",  dati.PERatio)              : ""}
                ${dati.DividendYield       ? creaStatCard("Dividendo",  dati.DividendYield)        : ""}
            </div>
        </article>`;
    overviewCard.style.display = "block";
    showToast("Overview caricata per " + dati.Symbol + ".", "success");
}

function creaStatCard(label, valore) {
    return `
        <div class="overview-stat">
            <span class="overview-stat-label">${label}</span>
            <span class="overview-stat-val">${valore || "N/D"}</span>
        </div>`;
}

// ═══════════════════════════════════════════════════════════
//  SEZIONE 5 — MAPPA (myMapLibre)
//  Usa sempre l'overview locale per l'indirizzo
// ═══════════════════════════════════════════════════════════

btnMap.addEventListener("click", function () {
    const symbol = mapSymbol.value;
    if (!symbol) { showToast("Seleziona prima un'azienda!", "warning"); return; }
    mostraSedeSuMappa(symbol);
});

async function mostraSedeSuMappa(symbol) {
    // Cerca prima nel db locale, poi eventualmente nell'overview live già in memoria
    let datiOverview = listaOverview.find(o => o.Symbol.toUpperCase() === symbol.toUpperCase());

    if (!datiOverview || !datiOverview.Address) {
        showToast("Indirizzo non disponibile per " + symbol + ". Carica prima l'Overview.", "warning");
        return;
    }

    const indirizzo = datiOverview.Address;

    const gpsAddress = await myMapLibre.geocode(indirizzo);
    if (!gpsAddress) return;

    await myMapLibre.drawMap(myMapLibre.openMapsStyle, "map", gpsAddress, 13);

    const popupHTML = `
        <strong>${datiOverview.Name}</strong><br/>
        <small>${indirizzo}</small>
        ${datiOverview.OfficialSite
            ? `<br/><a href="${datiOverview.OfficialSite}" target="_blank">Sito Ufficiale</a>`
            : ""}`;

    await myMapLibre.addMarker(gpsAddress, "", datiOverview.Symbol, popupHTML);

    mapAddressBadge.innerHTML     = '<i class="bi bi-geo-alt-fill me-1"></i>' + indirizzo;
    mapAddressBadge.style.display = "block";

    showToast("Sede di " + symbol + " visualizzata sulla mappa.", "success");
}
