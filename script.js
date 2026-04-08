"use strict";

//Configurazione

const AV_KEY        = "DLVWWJ2XCVMFNXJQ";
const AV_BASE       = "https://www.alphavantage.co/query";
const LOGO_DEV_KEY  = "	pk_e_5XOf_5SMag8q335oqC6Q";
const LOGO_DEV_BASE = "https://img.logo.dev/ticker/";
const JSON_SERVER   = "http://localhost:3000";

let listaAziende        = [];   // caricata da json-server 
let listaOverview       = [];
let chart               = null;
let datiGraficoCorrente = [];
let currentSymbol       = "";

function getSorgente() {
    return dataSource.value;
}

dataSource.addEventListener("change", function () {
    const isLive = getSorgente() == "live";
    statSource.textContent = isLive ? "AlphaVantage" : "Locale";
    showToast(isLive
        ? "Sorgente: AlphaVantage live — la ricerca usa SYMBOL_SEARCH in tempo reale"
        : "Sorgente: JSON locale (json-server)", "warning");

    // Svuota i risultati di ricerca e le select quando cambia sorgente
    searchResults.innerHTML = "";
    searchInput.value       = "";

    if (isLive) {
        // In modalità live le select vengono popolate dopo la prima ricerca;
        // per ora le svuotiamo mostrando solo il placeholder
        svuotaSelect();
    } else {
        // Torna alla lista locale già caricata in memoria
        popolaSelectDaLista(listaAziende);
    }
});
// Cambio Tema
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

function showToast(messaggio, tipo = "success") {
    liveToast.classList.remove("success", "error", "warning");
    liveToast.classList.add(tipo);
    const icone = { success: "✓", error: "✗", warning: "⚠" };
    toastMessage.textContent = (icone[tipo] || "") + " " + messaggio;
    bootstrap.Toast.getOrCreateInstance(liveToast, { delay: 3200 }).show();
}

avvioPagina();

// Fetch Dati

async function avvioPagina() {
    await caricaAziende();
    await caricaOverview();
    showToast("Dati caricati correttamente.", "success");
}

// Caricamento iniziale sempre da json-server
// (le select vengono sempre precaricate con i dati locali)
async function caricaAziende() {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/symbolsearch").catch(console.error);
    if (!httpResponse) return;

    listaAziende = httpResponse.data.map(az => ({
        symbol: az["1. symbol"],
        name:   az["2. name"]
    }));

    popolaSelectDaLista(listaAziende);
    statAziende.textContent = listaAziende.length;
}

//Popola tutte le select da un array { symbol, name }
function popolaSelectDaLista(lista) {
    [companySelect, chartSymbol, overviewSymbol, mapSymbol].forEach(sel => popolaSelect(sel, lista));
}

function popolaSelect(selectEl, lista) {
    selectEl.innerHTML = '<option value="">— Seleziona —</option>';
    for (let az of lista) {
        const opt = document.createElement("option");
        opt.value       = az.symbol;
        opt.textContent = az.symbol + " — " + az.name;
        selectEl.appendChild(opt);
    }
}

// Svuota le select (usato quando si passa a sorgente live prima di una ricerca)
function svuotaSelect() {
    [companySelect, chartSymbol, overviewSymbol, mapSymbol].forEach(sel => {
        sel.innerHTML = '<option value="">— Cerca un\'azienda sopra —</option>';
    });
    statAziende.textContent = "—";
}

// Ricerca incrementale
// Locale: filtra listaAziende in memoria
// Live:   chiama SYMBOL_SEARCH di AlphaVantage
searchInput.addEventListener("keyup", function () {
    const query = searchInput.value.trim();
    if (query.length >= 2) {
        if (getSorgente() == "live") {
            cercaAziendeAV(query);
        } else {
            cercaAziendeLocale(query);
        }
    } else {
        searchResults.innerHTML = "";
    }
});

// Ricerca locale (filtro lato client come da Best Practice PDF)
function cercaAziendeLocale(query) {
    const q = query.toLowerCase();
    const risultati = listaAziende.filter(az =>
        az.symbol.toLowerCase().includes(q) || az.name.toLowerCase().includes(q)
    );
    renderRisultatiRicerca(risultati, query);
}

// Ricerca live tramite AlphaVantage SYMBOL_SEARCH
// Restituisce tutte le aziende il cui nome/simbolo contiene la keyword.
// Ogni risposta è un array di bestMatch con symbol e name diversi.
async function cercaAziendeAV(query) {
    searchResults.innerHTML = '<p class="no-results">🔍 Ricerca in corso su AlphaVantage…</p>';

    const url = AV_BASE + "?function=SYMBOL_SEARCH&keywords=" + encodeURIComponent(query) + "&apikey=" + AV_KEY;
    const httpResponse = await ajax.sendRequest("GET", url).catch(console.error);
    if (!httpResponse) { searchResults.innerHTML = ""; return; }

    const bestMatches = httpResponse.data["bestMatches"];
    if (!bestMatches || bestMatches.length == 0) {
        searchResults.innerHTML = '<p class="no-results">Nessuna azienda trovata su AlphaVantage per "' + query + '"</p>';
        return;
    }

    // Normalizza nel formato { symbol, name } usato nel resto del codice
    const risultati = bestMatches.map(m => ({
        symbol: m["1. symbol"],
        name:   m["2. name"],
        type:   m["3. type"],
        region: m["4. region"]
    }));

    // Aggiorna le select con i risultati trovati (così l'utente può selezionare)
    popolaSelectDaLista(risultati);
    statAziende.textContent = risultati.length;

    renderRisultatiRicerca(risultati, query);
}

// Renderizza le card dei risultati (comune a locale e live)
function renderRisultatiRicerca(risultati, query) {
    if (risultati.length == 0) {
        searchResults.innerHTML = '<p class="no-results">Nessuna azienda trovata per "' + query + '"</p>';
        return;
    }

    const re = new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");

    searchResults.innerHTML = risultati.map(az => {
        const symHl  = az.symbol.replace(re, "<mark>$1</mark>");
        const nameHl = az.name.replace(re, "<mark>$1</mark>");
        const badge  = az.region ? `<span class="result-region">${az.region}</span>` : "";
        return `
            <div class="search-result-card"
                 role="button" tabindex="0"
                 onclick="selezionaDaRicerca('${az.symbol}')"
                 onkeydown="if(event.key=='Enter') selezionaDaRicerca('${az.symbol}')">
                <div class="result-symbol">${symHl} ${badge}</div>
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

    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/globalquote").catch(console.error);
    quoteLoading.style.display = "none";
    if (!httpResponse) return;

    const raw = httpResponse.data.find(q => q.symbol.toUpperCase() == symbol.toUpperCase());
    if (!raw) { showToast("Quotazione non trovata in locale per " + symbol, "warning"); return; }
    visualizzaQuotazione(normalizzaQuote(raw));
}

async function caricaQuotazioneAV(symbol) {
    quoteLoading.style.display      = "flex";
    quoteTableWrapper.style.display = "none";

    const url = AV_BASE + "?function=GLOBAL_QUOTE&symbol=" + symbol + "&apikey=" + AV_KEY;
    const httpResponse = await ajax.sendRequest("GET", url).catch(console.error);
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

    chart = ChartFactory.build(tipoChart, stockChart, voci, titolo, symbol, chart);

    showToast("Grafico generato per " + symbol + ".", "success");
}

async function caricaSerieLocale(symbol, mesi) {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/timeseries").catch(console.error);
    if (!httpResponse) return [];

    const entry = httpResponse.data.find(s => s.symbol.toUpperCase() == symbol.toUpperCase());
    if (!entry || !entry["Monthly Time Series"]) return [];

    return estraiVoci(entry["Monthly Time Series"], mesi);
}

async function caricaSerieAV(symbol, mesi) {
    let funzione    = "TIME_SERIES_MONTHLY";
    let chiaveSerie = "Monthly Time Series";
    if (mesi <= 3)       { funzione = "TIME_SERIES_DAILY";  chiaveSerie = "Time Series (Daily)"; }
    else if (mesi <= 12) { funzione = "TIME_SERIES_WEEKLY"; chiaveSerie = "Weekly Time Series"; }

    const url = AV_BASE + "?function=" + funzione + "&symbol=" + symbol + "&apikey=" + AV_KEY;
    const httpResponse = await ajax.sendRequest("GET", url).catch(console.error);
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

function scaricaCsv() {
    const SEP  = "\t";
    const CRLF = "\r\n";

    const intestazione = ["Data", "Open", "High", "Low", "Close", "Volume"].join(SEP);
    const righe = datiGraficoCorrente.map(([data, c]) =>
        [data, c["1. open"] || "", c["2. high"] || "", c["3. low"] || "", c["4. close"] || "", c["5. volume"] || ""].join(SEP)
    );

    const blob = new Blob(["\uFEFF" + intestazione + CRLF + righe.join(CRLF)], { type: "text/tab-separated-values;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = "stockvision-" + currentSymbol + ".tsv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV scaricato (TSV — colonne separate in Excel).", "success");
}

async function caricaOverview() {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/overview").catch(console.error);
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
    const httpResponse = await ajax.sendRequest("GET", url).catch(console.error);
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
    const logoUrl = LOGO_DEV_BASE + encodeURIComponent(dati.Symbol)
        + "?token=" + LOGO_DEV_KEY + "&size=200&format=png";

    if (logoContainer) {
        companyLogo.src             = logoUrl;
        companyLogo.alt             = dati.Name + " logo";
        logoContainer.style.display = "flex";
    }

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

    const indirizzo  = datiOverview.Address;
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
