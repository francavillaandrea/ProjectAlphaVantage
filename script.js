"use strict";

// ═══════════════════════════════════════════════════════════
//  CONFIGURAZIONE GLOBALE
// ═══════════════════════════════════════════════════════════

const AV_KEY      = "demo";  // <-- inserisci qui la tua API key AlphaVantage
const AV_BASE     = "https://www.alphavantage.co/query";
const JSON_SERVER = "http://localhost:3000";

// ═══════════════════════════════════════════════════════════
//  STATO DELL'APPLICAZIONE
// ═══════════════════════════════════════════════════════════

let listaAziende  = [];   // array caricato da json-server /aziende
let listaOverview = [];   // array caricato da json-server /OVERVIEW
let chart         = null; // istanza Chart.js attiva
let currentSymbol = "";   // simbolo dell'ultimo grafico generato

// ═══════════════════════════════════════════════════════════
//  DARK / LIGHT MODE
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

// Carica il tema salvato in localStorage (default: light)
// Se l'utente ha già scelto un tema lo rispetta, altrimenti usa quello del sistema
const temaDefault = localStorage.getItem("sv_theme")
    || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
applicaTema(temaDefault);

themeToggle.addEventListener("click", function () {
    const temaAttuale = document.body.classList.contains("dark-mode") ? "dark" : "light";
    applicaTema(temaAttuale === "dark" ? "light" : "dark");
});

// ═══════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

function showToast(messaggio, tipo = "success") {
    liveToast.classList.remove("success", "error", "warning");
    liveToast.classList.add(tipo);

    const icone = { success: "✓", error: "✗", warning: "⚠" };
    toastMessage.textContent = (icone[tipo] || "") + " " + messaggio;

    const toast = bootstrap.Toast.getOrCreateInstance(liveToast, { delay: 3000 });
    toast.show();
}

// ═══════════════════════════════════════════════════════════
//  AVVIO PAGINA
// ═══════════════════════════════════════════════════════════

avvioPagina();

// Le funzioni che richiamano funzioni asincrone DEVONO essere anch'esse asincrone
async function avvioPagina() {
    // 1. Carica le aziende da json-server e popola tutte le combo box
    await caricaAziende();

    // 2. Carica le overview in memoria (per la mappa e la sezione overview)
    await caricaOverview();

    showToast("Dati locali caricati correttamente.", "success");
}

// ═══════════════════════════════════════════════════════════
//  SEZIONE 1 — CARICAMENTO AZIENDE (json-server)
// ═══════════════════════════════════════════════════════════

async function caricaAziende() {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/symbolsearch").catch(ajax.errore);

    if (!httpResponse) return;

    // Il JSON usa "1. symbol" e "2. name" — normalizziamo in symbol/name
    listaAziende = httpResponse.data.map(az => ({
        symbol: az["1. symbol"],
        name:   az["2. name"]
    }));

    // Popola tutte le combo box della pagina
    popolaSelect(companySelect);
    popolaSelect(chartSymbol);
    popolaSelect(overviewSymbol);
    popolaSelect(mapSymbol);

    // Aggiorna la statistica nell'hero
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

// ═══════════════════════════════════════════════════════════
//  SEZIONE 2 — GLOBAL_QUOTE
//  Carica la quotazione dal DB locale (json-server).
//  Il pulsante "Update" la aggiorna direttamente da AlphaVantage.
// ═══════════════════════════════════════════════════════════

btnQuote.addEventListener("click", function () {
    const symbol = companySelect.value;
    if (!symbol) {
        showToast("Seleziona prima un'azienda!", "warning");
        return;
    }
    caricaQuotazioneLocale(symbol);
});

btnUpdateQuote.addEventListener("click", function () {
    const symbol = companySelect.value;
    if (!symbol) {
        showToast("Seleziona prima un'azienda!", "warning");
        return;
    }
    aggiornaQuotazioneLive(symbol);
});

// Caricamento della quotazione dal DB locale (json-server /GLOBAL_QUOTE)
async function caricaQuotazioneLocale(symbol) {
    quoteLoading.style.display      = "flex";
    quoteTableWrapper.style.display = "none";

    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/globalquote")
                                   .catch(ajax.errore);

    quoteLoading.style.display = "none";

    if (!httpResponse) return;

    // Filtro lato client (Best Practice dal PDF: json-server non supporta la ricerca)
    const quote = httpResponse.data.find(q => q.symbol.toUpperCase() === symbol.toUpperCase());

    if (!quote) {
        showToast("Quotazione non trovata nel DB locale per " + symbol, "warning");
        return;
    }

    visualizzaQuotazione(quote);
}

// Aggiornamento live da AlphaVantage (pulsante Update)
async function aggiornaQuotazioneLive(symbol) {
    quoteLoading.style.display      = "flex";
    quoteTableWrapper.style.display = "none";

    const url = AV_BASE + "?function=GLOBAL_QUOTE&symbol=" + symbol + "&apikey=" + AV_KEY;
    const httpResponse = await ajax.sendRequest("GET", url).catch(ajax.errore);

    quoteLoading.style.display = "none";

    if (!httpResponse) return;

    const rawQuote = httpResponse.data["Global Quote"];
    if (!rawQuote || !rawQuote["01. symbol"]) {
        showToast("Nessun dato da AlphaVantage. Verifica la API key o il limite giornaliero.", "error");
        return;
    }

    // Normalizza la risposta di AlphaVantage nel formato del DB locale
    const quote = {
        symbol:           rawQuote["01. symbol"],
        open:             rawQuote["02. open"],
        high:             rawQuote["03. high"],
        low:              rawQuote["04. low"],
        price:            rawQuote["05. price"],
        volume:           rawQuote["06. volume"],
        latestTradingDay: rawQuote["07. latest trading day"],
        previousClose:    rawQuote["08. previous close"],
        change:           rawQuote["09. change"],
        changePercent:    rawQuote["10. change percent"],
    };

    visualizzaQuotazione(quote);
    showToast("Quotazione live aggiornata per " + symbol + "!", "success");
}

function visualizzaQuotazione(quote) {
    const changePositivo = parseFloat(quote.change) >= 0;
    const classeChange   = changePositivo ? "positive" : "negative";

    quoteTableBody.innerHTML = `
        <tr>
            <td><span class="symbol-badge">${quote.symbol}</span></td>
            <td>$${quote.open}</td>
            <td>$${quote.high}</td>
            <td>$${quote.low}</td>
            <td><strong>$${quote.price}</strong></td>
            <td>${parseInt(quote.volume).toLocaleString("it-IT")}</td>
            <td>$${quote.previousClose}</td>
            <td class="${classeChange}">${changePositivo ? "+" : ""}${quote.change}</td>
            <td class="${classeChange}">${changePositivo ? "+" : ""}${parseFloat(quote.changePercent).toFixed(2)}%</td>
        </tr>
    `;
    quoteTableWrapper.style.display = "block";
}

// ═══════════════════════════════════════════════════════════
//  SEZIONE 3 — SYMBOL_SEARCH (ricerca incrementale)
//  Come indicato nel PDF, json-server non supporta la ricerca
//  full-text: si filtra l'array completo lato client.
// ═══════════════════════════════════════════════════════════

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

    // Filtro lato client su simbolo e nome
    const risultati = listaAziende.filter(az =>
        az.symbol.toLowerCase().includes(q) || az.name.toLowerCase().includes(q)
    );

    if (risultati.length === 0) {
        searchResults.innerHTML = '<p class="no-results">Nessuna azienda trovata per "' + query + '"</p>';
        return;
    }

    // Evidenzia il testo trovato nella card
    const re = new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");

    searchResults.innerHTML = risultati.map(az => {
        const symHl  = az.symbol.replace(re, "<mark>$1</mark>");
        const nameHl = az.name.replace(re, "<mark>$1</mark>");
        return `
            <div class="search-result-card"
                 role="button" tabindex="0"
                 data-symbol="${az.symbol}"
                 onclick="selezionaDaRicerca('${az.symbol}')"
                 onkeydown="if(event.key==='Enter') selezionaDaRicerca('${az.symbol}')">
                <div class="result-symbol">${symHl}</div>
                <div class="result-name">${nameHl}</div>
            </div>
        `;
    }).join("");
}

// Selezione di un'azienda dai risultati di ricerca:
// sincronizza tutte le select e carica subito la quotazione
function selezionaDaRicerca(symbol) {
    companySelect.value  = symbol;
    chartSymbol.value    = symbol;
    overviewSymbol.value = symbol;
    mapSymbol.value      = symbol;
    section_quote.scrollIntoView({ behavior: "smooth" });
    caricaQuotazioneLocale(symbol);
}

// ═══════════════════════════════════════════════════════════
//  SEZIONE 4 — OVERVIEW
//  Carica i dati aziendali dal DB locale (json-server /OVERVIEW)
// ═══════════════════════════════════════════════════════════

async function caricaOverview() {
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/overview").catch(ajax.errore);
    if (!httpResponse) return;
    listaOverview = httpResponse.data;
}

btnOverview.addEventListener("click", function () {
    const symbol = overviewSymbol.value;
    if (!symbol) {
        showToast("Seleziona prima un'azienda!", "warning");
        return;
    }
    mostraOverview(symbol);
});

function mostraOverview(symbol) {
    // Filtro lato client sull'array già caricato in avvioPagina
    const dati = listaOverview.find(o => o.Symbol.toUpperCase() === symbol.toUpperCase());

    if (!dati) {
        showToast("Overview non trovata nel DB locale per " + symbol, "warning");
        overviewCard.style.display = "none";
        return;
    }

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
                    <a href="${dati.OfficialSite}" target="_blank" rel="noopener noreferrer">
                        ${dati.OfficialSite}
                    </a>
                </div>` : ""}
                ${dati.Sector ? `
                <div class="overview-meta-item">
                    <i class="bi bi-tag me-1"></i>
                    <span>${dati.Sector}</span>
                </div>` : ""}
            </div>
            ${dati.Description ? `<p class="overview-desc">${dati.Description}</p>` : ""}
            <div class="overview-stats-grid">
                ${creaStatCard("Simbolo",   dati.Symbol)}
                ${dati.MarketCap ? creaStatCard("Market Cap", dati.MarketCap) : ""}
                ${dati.Sector    ? creaStatCard("Settore",    dati.Sector)    : ""}
                ${dati.Exchange  ? creaStatCard("Exchange",   dati.Exchange)  : ""}
            </div>
        </article>
    `;
    overviewCard.style.display = "block";
    showToast("Overview caricata per " + symbol + ".", "success");
}

function creaStatCard(label, valore) {
    return `
        <div class="overview-stat">
            <span class="overview-stat-label">${label}</span>
            <span class="overview-stat-val">${valore || "N/D"}</span>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
//  SEZIONE 5 — GRAFICI STORICI (myBarChart + Chart.js)
//  Usa la classe MyBarChart (myChart.js) esattamente come
//  in indexStile.js: setChartOptions() + new Chart()
// ═══════════════════════════════════════════════════════════

btnChart.addEventListener("click", function () {
    const symbol = chartSymbol.value;
    if (!symbol) {
        showToast("Seleziona prima un'azienda!", "warning");
        return;
    }
    generaGrafico(symbol);
});

async function generaGrafico(symbol) {
    const periodo   = parseInt(chartPeriod.value);
    const tipoChart = chartType.value;   // "line" o "bar"

    // Carica la serie storica dal DB locale (json-server /TIME_SERIES_MONTHLY)
    const httpResponse = await ajax.sendRequest("GET", JSON_SERVER + "/timeseries")
                                   .catch(ajax.errore);

    if (!httpResponse) return;

    // Filtra lato client per il simbolo selezionato
    const serieEntry = httpResponse.data.find(
        s => s.symbol.toUpperCase() === symbol.toUpperCase()
    );

    if (!serieEntry || !serieEntry["Monthly Time Series"]) {
        showToast("Dati storici non trovati per " + symbol, "warning");
        return;
    }

    // Ordina dal più vecchio al più recente e prende gli ultimi N periodi
    const rawSerie = serieEntry["Monthly Time Series"];
    const voci = Object.entries(rawSerie)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .slice(-periodo);

    // Prepara i vettori per myBarChart (stesso stile di indexStile.js)
    const labels = [];
    const values = [];
    const colors = [];

    for (let [data, candela] of voci) {
        labels.push(data.substring(0, 7));           // "YYYY-MM"
        values.push(parseFloat(candela["4. close"]));
        colors.push(generaColore());
    }

    const titolo = symbol + " — Prezzi chiusura (" + chartPeriod.options[chartPeriod.selectedIndex].text + ")";

    // Aggiorna le opzioni tramite myBarChart
    myBarChart.setChartOptions(titolo, labels, values, colors);

    // Sovrascrive il tipo scelto dall'utente (line o bar)
    myBarChart.getChartOptions().type = tipoChart;

    chartPlaceholder.style.display = "none";
    chartBox.style.display         = "block";
    chartTitle.textContent         = titolo;
    currentSymbol = symbol;

    if (!chart) {
        // Prima creazione: istanzia Chart.js con le opzioni di myBarChart
        chart = new Chart(stockChart, myBarChart.getChartOptions());
    } else {
        // Aggiornamento: modifica il chart esistente e chiama update()
        chart.config.type                             = tipoChart;
        chart.config.data.labels                      = labels;
        chart.config.data.datasets[0].data            = values;
        chart.config.data.datasets[0].backgroundColor = colors;
        chart.config.options.plugins.title.text       = titolo;
        chart.update();
    }

    showToast("Grafico generato per " + symbol + ".", "success");
}

// Genera un colore RGB casuale (come la funzione random() di indexStile.js)
function generaColore() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgb(${r},${g},${b})`;
}

// Salva il grafico come immagine PNG (requisito 6 del PDF)
btnSaveChart.addEventListener("click", function () {
    if (!chart) {
        showToast("Genera prima un grafico!", "warning");
        return;
    }
    // Imposta sfondo bianco prima dell'export (metodo di myBarChart)
    myBarChart.setWhiteBackground(stockChart);

    const link    = document.createElement("a");
    link.href     = stockChart.toDataURL("image/png");
    link.download = "stockvision-" + (currentSymbol || "chart") + ".png";
    link.click();

    showToast("Grafico salvato come PNG.", "success");
});

// ═══════════════════════════════════════════════════════════
//  SEZIONE 6 — MAPPA (myMapLibre)
//  Usa myMapLibre.geocode() + myMapLibre.drawMap()
//  + myMapLibre.addMarker() come in indexStile.js
// ═══════════════════════════════════════════════════════════

btnMap.addEventListener("click", function () {
    const symbol = mapSymbol.value;
    if (!symbol) {
        showToast("Seleziona prima un'azienda!", "warning");
        return;
    }
    mostraSedeSuMappa(symbol);
});

async function mostraSedeSuMappa(symbol) {
    // Recupera l'indirizzo dall'overview già caricata in memoria
    const datiOverview = listaOverview.find(o => o.Symbol.toUpperCase() === symbol.toUpperCase());

    if (!datiOverview || !datiOverview.Address) {
        showToast("Indirizzo non disponibile per " + symbol + ". Carica prima l'Overview.", "warning");
        return;
    }

    const indirizzo = datiOverview.Address;

    // Geocoding tramite myMapLibre (MapTiler API)
    const gpsAddress = await myMapLibre.geocode(indirizzo);
    if (!gpsAddress) {
        // La libreria mostra già un alert() se l'indirizzo non è valido
        return;
    }

    // Disegna la mappa (o sposta il centro se già inizializzata)
    await myMapLibre.drawMap(myMapLibre.openMapsStyle, "map", gpsAddress, 13);

    // Aggiunge marker con popup contenente nome aziendale e indirizzo
    const popupHTML = `
        <strong>${datiOverview.Name}</strong><br/>
        <small>${indirizzo}</small>
        ${datiOverview.OfficialSite
            ? `<br/><a href="${datiOverview.OfficialSite}" target="_blank">Sito Ufficiale</a>`
            : ""}
    `;
    await myMapLibre.addMarker(gpsAddress, "", datiOverview.Symbol, popupHTML);

    // Aggiorna il badge indirizzo sotto la mappa
    mapAddressBadge.innerHTML     = '<i class="bi bi-geo-alt-fill me-1"></i>' + indirizzo;
    mapAddressBadge.style.display = "block";

    showToast("Sede di " + symbol + " visualizzata sulla mappa.", "success");
}
