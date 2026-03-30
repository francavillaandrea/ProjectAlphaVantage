"use strict";

// ═══════════════════════════════════════════════════════════
//  CONFIGURAZIONE
// ═══════════════════════════════════════════════════════════

const AV_KEY      = "demo";   // ← inserisci la tua API key AlphaVantage
const AV_BASE     = "https://www.alphavantage.co/query";
const JSON_SERVER = "http://localhost:3000";

// ═══════════════════════════════════════════════════════════
//  STATO
// ═══════════════════════════════════════════════════════════

let listaAziende        = [];   // { symbol, name }
let listaOverview       = [];   // array overview (con campo Logo)
let chart               = null; // istanza Chart.js corrente
let datiGraficoCorrente = [];   // voci [data, candela] per export CSV
let currentSymbol       = "";   // simbolo dell'ultimo grafico

// ═══════════════════════════════════════════════════════════
//  SORGENTE DATI  ("local" = json-server | "live" = AlphaVantage)
// ═══════════════════════════════════════════════════════════

function getSorgente() {
    return dataSource.value;
}

dataSource.addEventListener("change", function () {
    const isLive = getSorgente() == "live";
    statSource.textContent = isLive ? "AlphaVantage" : "Locale";
    showToast(isLive
        ? "Sorgente: AlphaVantage live (25 req/giorno nel piano free)"
        : "Sorgente: JSON locale (json-server)", "warning");
});

// ═══════════════════════════════════════════════════════════
//  TEMA DARK / LIGHT
// ═══════════════════════════════════════════════════════════

function applicaTema(tema) {
    if (tema == "dark") {
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
    applicaTema(corrente == "dark" ? "light" : "dark");
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
//  SEZIONE 1 — SYMBOL_SEARCH (ricerca incrementale lato client)
// ═══════════════════════════════════════════════════════════

async function caricaAziende() {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/symbolsearch").catch(ajax.errore);
    if (!httpResponse) return;

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

    if (risultati.length == 0) {
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
                 onkeydown="if(event.key=='Enter') selezionaDaRicerca('${az.symbol}')">
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
// ═══════════════════════════════════════════════════════════

btnQuote.addEventListener("click", function () {
    const symbol = companySelect.value;
    if (!symbol) { showToast("Seleziona prima un'azienda!", "warning"); return; }
    caricaQuotazione(symbol);
});

btnUpdateQuote.addEventListener("click", function () {
    const symbol = companySelect.value;
    if (!symbol) { showToast("Seleziona prima un'azienda!", "warning"); return; }
    caricaQuotazioneAV(symbol);
});

async function caricaQuotazione(symbol) {
    if (getSorgente() == "live") {
        await caricaQuotazioneAV(symbol);
    } else {
        await caricaQuotazioneLocale(symbol);
    }
}

async function caricaQuotazioneLocale(symbol) {
    quoteLoading.style.display      = "flex";
    quoteTableWrapper.style.display = "none";

    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/globalquote").catch(ajax.errore);
    quoteLoading.style.display = "none";
    if (!httpResponse) return;

    // Filtro lato client (Best Practice PDF)
    const raw = httpResponse.data.find(q => q.symbol.toUpperCase() == symbol.toUpperCase());
    if (!raw) {
        showToast("Quotazione non trovata in locale per " + symbol, "warning");
        return;
    }
    visualizzaQuotazione(normalizzaQuote(raw));
}

async function caricaQuotazioneAV(symbol) {
    quoteLoading.style.display      = "flex";
    quoteTableWrapper.style.display = "none";

    const url = AV_BASE + "?function=GLOBAL_QUOTE&symbol=" + symbol + "&apikey=" + AV_KEY;
    const httpResponse = await ajax.sendRequest("GET", url).catch(ajax.errore);
    quoteLoading.style.display = "none";
    if (!httpResponse) return;

    const rawQuote = httpResponse.data["Global Quote"];
    if (!rawQuote || !rawQuote["01. symbol"]) {
        showToast("Nessun dato da AlphaVantage. Controlla API key o limite giornaliero.", "error");
        return;
    }
    visualizzaQuotazione(normalizzaQuote(rawQuote));
    showToast("Quotazione live aggiornata per " + symbol + "!", "success");
}

// Normalizza i campi "01. symbol" / "open" in entrambi i formati
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
    // FIX: classe CSS verde se positivo, rosso se negativo
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
//  Usa ChartFactory da myCharts.js (una classe per tipo)
//  Tipi: line | bar | area | candlestick | radar | doughnut
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

// FIX CSV: usa \t come separatore → Excel/Calc apre su colonne separate
btnDownloadCsv.addEventListener("click", function () {
    if (!datiGraficoCorrente.length) { showToast("Genera prima un grafico!", "warning"); return; }
    scaricaCsv();
});

async function generaGrafico(symbol) {
    const mesi      = parseInt(chartPeriod.value);
    const tipoChart = chartType.value;

    let voci = getSorgente() == "live"
        ? await caricaSerieAV(symbol, mesi)
        : await caricaSerieLocale(symbol, mesi);

    if (!voci || voci.length == 0) {
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

    // Usa ChartFactory (myCharts.js) — una classe per ogni tipo
    chart = ChartFactory.build(tipoChart, stockChart, voci, titolo, symbol, chart);

    showToast("Grafico generato per " + symbol + ".", "success");
}

async function caricaSerieLocale(symbol, mesi) {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/timeseries").catch(ajax.errore);
    if (!httpResponse) return [];

    const entry = httpResponse.data.find(s => s.symbol.toUpperCase() == symbol.toUpperCase());
    if (!entry || !entry["Monthly Time Series"]) return [];

    return estraiVoci(entry["Monthly Time Series"], mesi);
}

async function caricaSerieAV(symbol, mesi) {
    let funzione    = "TIME_SERIES_MONTHLY";
    let chiaveSerie = "Monthly Time Series";
    if (mesi <= 3)  { funzione = "TIME_SERIES_DAILY";  chiaveSerie = "Time Series (Daily)"; }
    else if (mesi <= 12) { funzione = "TIME_SERIES_WEEKLY"; chiaveSerie = "Weekly Time Series"; }

    const url = AV_BASE + "?function=" + funzione + "&symbol=" + symbol + "&apikey=" + AV_KEY;
    const httpResponse = await ajax.sendRequest("GET", url).catch(ajax.errore);
    if (!httpResponse) return [];

    const rawSerie = httpResponse.data[chiaveSerie];
    if (!rawSerie) { showToast("Nessuna serie da AlphaVantage. Controlla la API key.", "error"); return []; }
    return estraiVoci(rawSerie, mesi);
}

function estraiVoci(rawSerie, mesi) {
    let voci = Object.entries(rawSerie).sort(([a], [b]) => new Date(a) - new Date(b));
    if (mesi != 9999) voci = voci.slice(-mesi);
    return voci;
}

// FIX: CSV con TAB come separatore → colonne separate in Excel/Calc
function scaricaCsv() {
    const SEP  = "\t";
    const CRLF = "\r\n";

    const intestazione = ["Data", "Open", "High", "Low", "Close", "Volume"].join(SEP);
    const righe = datiGraficoCorrente.map(([data, c]) =>
        [
            data,
            c["1. open"]  || "",
            c["2. high"]  || "",
            c["3. low"]   || "",
            c["4. close"] || "",
            c["5. volume"]|| ""
        ].join(SEP)
    );

    // BOM UTF-8 (\uFEFF) per aprire correttamente in Excel italiano
    const contenuto = "\uFEFF" + intestazione + CRLF + righe.join(CRLF);
    const blob = new Blob([contenuto], { type: "text/tab-separated-values;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = "stockvision-" + currentSymbol + ".tsv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV scaricato (formato TSV — si apre su colonne separate in Excel).", "success");
}

// ═══════════════════════════════════════════════════════════
//  SEZIONE 4 — OVERVIEW  +  LOGO AZIENDA
// ═══════════════════════════════════════════════════════════

async function caricaOverview() {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/overview").catch(ajax.errore);
    if (!httpResponse) return;
    listaOverview = httpResponse.data;
}

btnOverview.addEventListener("click", function () {
    const symbol = overviewSymbol.value;
    if (!symbol) { showToast("Seleziona prima un'azienda!", "warning"); return; }

    if (getSorgente() == "live") {
        caricaOverviewAV(symbol);
    } else {
        mostraOverview(symbol);
    }
});

function mostraOverview(symbol) {
    const dati = listaOverview.find(o => o.Symbol.toUpperCase() == symbol.toUpperCase());
    if (!dati) {
        showToast("Overview non trovata in locale per " + symbol, "warning");
        overviewCard.style.display = "none";
        return;
    }
    renderOverviewCard(dati);
}

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
    // ── Logo azienda ──────────────────────────────────────
    // Cerca prima nel db locale (campo Logo), poi fallback su Clearbit
    const datiLocali = listaOverview.find(o => o.Symbol.toUpperCase() == dati.Symbol.toUpperCase());
    const logoUrl    = datiLocali?.Logo
        || "https://logo.clearbit.com/" + (dati.OfficialSite
            ? dati.OfficialSite.replace(/^https?:\/\//, "").split("/")[0]
            : dati.Symbol.toLowerCase() + ".com");

    // Mostra il container logo con immagine e fallback a icona
    if (logoContainer) {
        companyLogo.src               = logoUrl;
        companyLogo.alt               = dati.Name + " logo";
        logoContainer.style.display   = "flex";
    }

    // ── Card overview ─────────────────────────────────────
    overviewCard.innerHTML = `
        <article class="overview-card">
            <div class="overview-header">
                <div class="overview-logo">
                    <img src="${logoUrl}" alt="${dati.Name} logo"
                         class="overview-logo-img"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
                    <i class="bi bi-building" style="display:none"></i>
                </div>
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
                ${creaStatCard("Simbolo",   dati.Symbol)}
                ${dati.MarketCapitalization ? creaStatCard("Market Cap",  dati.MarketCapitalization) : ""}
                ${dati.Sector              ? creaStatCard("Settore",      dati.Sector)               : ""}
                ${dati.Exchange            ? creaStatCard("Exchange",     dati.Exchange)             : ""}
                ${dati.PERatio             ? creaStatCard("P/E Ratio",    dati.PERatio)              : ""}
                ${dati.DividendYield       ? creaStatCard("Dividendo",    dati.DividendYield)        : ""}
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
// ═══════════════════════════════════════════════════════════

btnMap.addEventListener("click", function () {
    const symbol = mapSymbol.value;
    if (!symbol) { showToast("Seleziona prima un'azienda!", "warning"); return; }
    mostraSedeSuMappa(symbol);
});

async function mostraSedeSuMappa(symbol) {
    const datiOverview = listaOverview.find(o => o.Symbol.toUpperCase() == symbol.toUpperCase());

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
