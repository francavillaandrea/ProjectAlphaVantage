"use strict";

const CONFIG = {
    alphaVantageKey: localStorage.getItem("stockvision-alpha-key") || "demo",
    alphaVantageBaseUrl: "https://www.alphavantage.co/query",
    nominatimBaseUrl: "https://nominatim.openstreetmap.org/search",
    offlineCacheUrl: "./data/db2026.json",
    localCompaniesUrl: "./data/db2026.json",
    themeStorageKey: "stockvision-theme",
};

const state = {
    companies: [],
    companiesBySymbol: new Map(),
    offlineCache: null,
    currentQuoteSymbol: "",
    currentChartSymbol: "",
    chart: null,
    map: null,
    mapTileLayer: null,
    mapMarker: null,
    bootstrappedToast: null,
    requestSeq: 0,
};

const els = {
    body: document.body,
    themeToggle: document.getElementById("themeToggle"),
    themeIcon: document.getElementById("themeIcon"),
    companySelect: document.getElementById("companySelect"),
    btnQuote: document.getElementById("btnQuote"),
    btnUpdateQuote: document.getElementById("btnUpdateQuote"),
    quoteLoading: document.getElementById("quoteLoading"),
    quoteTableWrapper: document.getElementById("quoteTableWrapper"),
    quoteTableBody: document.getElementById("quoteTableBody"),
    searchInput: document.getElementById("searchInput"),
    searchResults: document.getElementById("searchResults"),
    chartSymbol: document.getElementById("chartSymbol"),
    chartPeriod: document.getElementById("chartPeriod"),
    chartType: document.getElementById("chartType"),
    btnChart: document.getElementById("btnChart"),
    chartBox: document.getElementById("chartBox"),
    chartPlaceholder: document.getElementById("chartPlaceholder"),
    chartTitle: document.getElementById("chartTitle"),
    btnSaveChart: document.getElementById("btnSaveChart"),
    stockChart: document.getElementById("stockChart"),
    overviewSymbol: document.getElementById("overviewSymbol"),
    btnOverview: document.getElementById("btnOverview"),
    overviewCard: document.getElementById("overviewCard"),
    mapSymbol: document.getElementById("mapSymbol"),
    btnMap: document.getElementById("btnMap"),
    mapContainer: document.getElementById("mapContainer"),
    mapAddressBadge: document.getElementById("mapAddressBadge"),
    statAziende: document.getElementById("statAziende"),
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function debounce(fn, wait = 180) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function getTheme() {
    return document.body.classList.contains("dark-mode") ? "dark" : "light";
}

function setTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    document.body.classList.toggle("light-mode", !isDark);
    localStorage.setItem(CONFIG.themeStorageKey, theme);
    els.themeIcon.className = isDark ? "bi bi-sun-fill" : "bi bi-moon-fill";
    if (state.map) {
        refreshMapTiles();
    }
    if (state.chart) {
        refreshChartTheme();
    }
}

function toggleTheme() {
    setTheme(getTheme() === "dark" ? "light" : "dark");
}

function ensureToast() {
    if (!state.bootstrappedToast && window.bootstrap?.Toast) {
        const toastEl = document.getElementById("liveToast");
        state.bootstrappedToast = bootstrap.Toast.getOrCreateInstance(toastEl, {
            delay: 2600,
        });
    }
    return state.bootstrappedToast;
}

function showToast(message, type = "success") {
    const toastEl = document.getElementById("liveToast");
    const body = document.getElementById("toastMessage");
    if (!toastEl || !body) return;
    toastEl.classList.remove("success", "error", "warning");
    toastEl.classList.add(type);
    body.textContent = message;
    const toast = ensureToast();
    if (toast) {
        toast.show();
    }
}

function setLoading(isLoading) {
    els.quoteLoading.style.display = isLoading ? "flex" : "none";
}

async function requestJson(url) {
    if (/^https?:\/\//i.test(url)) {
        const response = await ajax.sendRequest("GET", url);
        return response.data;
    }
    const response = await fetch(url, {
        headers: { Accept: "application/json" },
    });
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
}

async function loadLocalJson(url) {
    try {
        return await requestJson(url);
    } catch (error) {
        return null;
    }
}

function deriveCompaniesFromCache(cache) {
    const bySymbol = new Map();
    const add = (symbol, name) => {
        if (!symbol) return;
        const normalized = String(symbol).trim().toUpperCase();
        if (!bySymbol.has(normalized)) {
            bySymbol.set(normalized, {
                symbol: normalized,
                name: name || normalized,
            });
        }
    };

    (cache?.GLOBAL_QUOTE || []).forEach((item) => {
        add(item.symbol || item["01. symbol"], item.symbol || item["01. symbol"]);
    });
    (cache?.OVERVIEW || []).forEach((item) => {
        add(item.Symbol, item.Name);
    });
    (cache?.SYMBOL_SEARCH || []).forEach((item) => {
        add(item["1. symbol"], item["2. name"]);
    });

    return Array.from(bySymbol.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function loadCompaniesFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.companies)) return payload.companies;
    return [];
}

async function loadCompanies() {
    const candidates = [
        CONFIG.localCompaniesUrl,
        "http://localhost:3000/companies",
    ];

    for (const url of candidates) {
        const payload = await loadLocalJson(url);
        const companies = loadCompaniesFromPayload(payload);
        if (companies.length) {
            return companies;
        }
    }

    if (!state.offlineCache) {
        state.offlineCache = await loadLocalJson(CONFIG.offlineCacheUrl);
    }
    return deriveCompaniesFromCache(state.offlineCache);
}

function setCompanies(companies) {
    state.companies = companies
        .map((item) => ({
            symbol: String(item.symbol || item.Symbol || item["1. symbol"] || "").trim().toUpperCase(),
            name: String(item.name || item.Name || item["2. name"] || item.symbol || item.Symbol || "").trim(),
        }))
        .filter((item) => item.symbol)
        .sort((a, b) => a.name.localeCompare(b.name));

    state.companiesBySymbol = new Map(state.companies.map((item) => [item.symbol, item]));
    els.statAziende.textContent = String(state.companies.length);
}

function buildSelectOptions() {
    const options = state.companies
        .map((company) => `<option value="${escapeHtml(company.symbol)}">${escapeHtml(company.symbol)} - ${escapeHtml(company.name)}</option>`)
        .join("");

    const placeholder = '<option value="">— Seleziona —</option>';
    [els.companySelect, els.chartSymbol, els.overviewSymbol, els.mapSymbol].forEach((select) => {
        if (!select) return;
        select.innerHTML = placeholder + options;
    });
}

function syncSelectValues(symbol, sourceId = "") {
    [els.companySelect, els.chartSymbol, els.overviewSymbol, els.mapSymbol].forEach((select) => {
        if (!select || select.id === sourceId) return;
        select.value = symbol;
    });
}

function highlightMatch(text, query) {
    const safeText = escapeHtml(text);
    if (!query) return safeText;
    const pattern = new RegExp(`(${escapeRegExp(query)})`, "ig");
    return safeText.replace(pattern, "<mark>$1</mark>");
}

function renderSearchResults(query) {
    const normalizedQuery = normalizeText(query);
    if (normalizedQuery.length < 2) {
        els.searchResults.innerHTML = '<p class="no-results">Digita almeno 2 caratteri per cercare tra le aziende.</p>';
        return;
    }

    const results = state.companies.filter((company) => {
        const haystack = `${company.symbol} ${company.name}`;
        return normalizeText(haystack).includes(normalizedQuery);
    });

    if (!results.length) {
        els.searchResults.innerHTML = '<p class="no-results">Nessun risultato trovato.</p>';
        return;
    }

    els.searchResults.innerHTML = results
        .map((company) => `
      <article class="search-result-card" role="button" tabindex="0" data-symbol="${escapeHtml(company.symbol)}">
        <div class="result-symbol">${highlightMatch(company.symbol, query)}</div>
        <div class="result-name">${highlightMatch(company.name, query)}</div>
      </article>
    `)
        .join("");
}

function renderQuoteTable(quote) {
    if (!quote) {
        els.quoteTableWrapper.style.display = "none";
        els.quoteTableBody.innerHTML = "";
        return;
    }

    const changeClass = Number.parseFloat(quote.change) >= 0 ? "positive" : "negative";
    els.quoteTableBody.innerHTML = `
    <tr>
      <td><span class="symbol-badge">${escapeHtml(quote.symbol)}</span></td>
      <td>${escapeHtml(quote.open)}</td>
      <td>${escapeHtml(quote.high)}</td>
      <td>${escapeHtml(quote.low)}</td>
      <td>${escapeHtml(quote.price)}</td>
      <td>${escapeHtml(quote.volume)}</td>
      <td>${escapeHtml(quote.previousClose)}</td>
      <td class="${changeClass}">${escapeHtml(quote.change)}</td>
      <td class="${changeClass}">${escapeHtml(quote.changePercent)}</td>
    </tr>
  `;
    els.quoteTableWrapper.style.display = "block";
}

function normalizeGlobalQuote(raw) {
    const source = raw?.["Global Quote"] || raw?.GLOBAL_QUOTE || raw;
    if (!source) return null;
    return {
        symbol: source["01. symbol"] || source.symbol || source.Symbol || "",
        open: source["02. open"] || source["1. open"] || source.open || "",
        high: source["03. high"] || source["2. high"] || source.high || "",
        low: source["04. low"] || source["3. low"] || source.low || "",
        price: source["05. price"] || source["4. close"] || source.price || "",
        volume: source["06. volume"] || source["5. volume"] || source.volume || "",
        latestTradingDay: source["07. latest trading day"] || source["latest trading day"] || source.latestTradingDay || "",
        previousClose: source["08. previous close"] || source["previous close"] || source.previousClose || "",
        change: source["09. change"] || source.change || "",
        changePercent: source["10. change percent"] || source["change percent"] || source.changePercent || "",
    };
}

function lookupOfflineQuote(symbol) {
    const cached = state.offlineCache?.GLOBAL_QUOTE?.find((item) => {
        return normalizeText(item.symbol || item["01. symbol"]) === normalizeText(symbol);
    });
    return cached ? normalizeGlobalQuote(cached) : null;
}

async function fetchLiveQuote(symbol) {
    const url = `${CONFIG.alphaVantageBaseUrl}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(CONFIG.alphaVantageKey)}`;
    const response = await ajax.sendRequest("GET", url);
    const payload = response.data;
    if (payload?.Note || payload?.Information || payload?.Error_Message) {
        throw new Error(payload.Note || payload.Information || payload.Error_Message);
    }
    return normalizeGlobalQuote(payload);
}

async function getQuote(symbol, { forceLive = false } = {}) {
    const useLive = forceLive || (CONFIG.alphaVantageKey && CONFIG.alphaVantageKey !== "demo");
    if (useLive) {
        try {
            const liveQuote = await fetchLiveQuote(symbol);
            if (liveQuote) return liveQuote;
        } catch (error) {
            console.warn("Live quote failed, falling back to local cache:", error);
        }
    }
    return lookupOfflineQuote(symbol);
}

async function loadQuote(symbol, { forceLive = false } = {}) {
    if (!symbol) {
        showToast("Seleziona un'azienda prima di caricare la quotazione.", "warning");
        return;
    }

    const seq = ++state.requestSeq;
    state.currentQuoteSymbol = symbol;
    setLoading(true);
    try {
        const quote = await getQuote(symbol, { forceLive });
        if (seq !== state.requestSeq) return;
        if (!quote) {
            throw new Error("Dati quotazione non disponibili.");
        }
        renderQuoteTable(quote);
        showToast(`Quotazione caricata per ${symbol}.`, "success");
    } catch (error) {
        renderQuoteTable(null);
        showToast("Impossibile caricare la quotazione.", "error");
    } finally {
        if (seq === state.requestSeq) {
            setLoading(false);
        }
    }
}

function normalizeOverview(raw) {
    const source = raw?.["Overview"] || raw?.OVERVIEW || raw;
    if (!source) return null;
    return {
        Symbol: source.Symbol || source.symbol || "",
        Name: source.Name || source.name || "",
        Description: source.Description || source.description || "",
        Address: source.Address || source.address || "",
        OfficialSite: source.OfficialSite || source.OfficialSiteURL || source.WebSite || source.website || "",
        Sector: source.Sector || "",
        Industry: source.Industry || "",
        Country: source.Country || "",
        Exchange: source.Exchange || "",
        MarketCapitalization: source.MarketCapitalization || source.MarketCap || "",
        EBITDA: source.EBITDA || "",
        PERatio: source.PERatio || "",
        DividendYield: source.DividendYield || "",
        FiscalYearEnd: source.FiscalYearEnd || "",
    };
}

function lookupOfflineOverview(symbol) {
    const cached = state.offlineCache?.OVERVIEW?.find((item) => {
        return normalizeText(item.Symbol) === normalizeText(symbol);
    });
    return cached ? normalizeOverview(cached) : null;
}

async function fetchLiveOverview(symbol) {
    const url = `${CONFIG.alphaVantageBaseUrl}?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(CONFIG.alphaVantageKey)}`;
    const response = await ajax.sendRequest("GET", url);
    const payload = response.data;
    if (payload?.Note || payload?.Information || payload?.Error_Message) {
        throw new Error(payload.Note || payload.Information || payload.Error_Message);
    }
    return normalizeOverview(payload);
}

async function getOverview(symbol) {
    const useLive = CONFIG.alphaVantageKey && CONFIG.alphaVantageKey !== "demo";
    if (useLive) {
        try {
            const liveOverview = await fetchLiveOverview(symbol);
            if (liveOverview) return liveOverview;
        } catch (error) {
            console.warn("Live overview failed, falling back to local cache:", error);
        }
    }
    return lookupOfflineOverview(symbol);
}

function statItem(label, value) {
    return `
    <div class="overview-stat">
      <span class="overview-stat-label">${escapeHtml(label)}</span>
      <span class="overview-stat-val">${escapeHtml(value || "N/D")}</span>
    </div>
  `;
}

function renderOverview(overview) {
    if (!overview) {
        els.overviewCard.innerHTML = '<p class="no-results">Seleziona un’azienda per visualizzare l’overview.</p>';
        els.overviewCard.style.display = "block";
        return;
    }

    const symbol = overview.Symbol || "";
    const company = state.companiesBySymbol.get(symbol) || { name: overview.Name || symbol };
    const site = overview.OfficialSite;
    const stats = [
        ["Sector", overview.Sector],
        ["Industry", overview.Industry],
        ["Country", overview.Country],
        ["Exchange", overview.Exchange],
        ["Market Cap", overview.MarketCapitalization],
        ["P/E", overview.PERatio],
        ["EBITDA", overview.EBITDA],
        ["Dividend Yield", overview.DividendYield],
        ["Fiscal Year End", overview.FiscalYearEnd],
    ];

    els.overviewCard.innerHTML = `
    <article class="overview-card">
      <div class="overview-header">
        <div class="overview-logo"><i class="bi bi-building"></i></div>
        <div>
          <h3 class="overview-title">${escapeHtml(company.name || overview.Name || symbol)}</h3>
          <div class="overview-symbol">${escapeHtml(symbol)}</div>
        </div>
      </div>

      <div class="overview-meta">
        <div class="overview-meta-item"><i class="bi bi-geo-alt me-1"></i><span>${escapeHtml(overview.Address || "N/D")}</span></div>
        ${site
            ? `<div class="overview-meta-item"><i class="bi bi-link-45deg me-1"></i><a href="${escapeHtml(site)}" target="_blank" rel="noopener noreferrer">${escapeHtml(site)}</a></div>`
            : ""
        }
      </div>

      <p class="overview-desc">${escapeHtml(overview.Description || "Descrizione non disponibile.")}</p>

      <div class="overview-stats-grid">
        ${stats.map(([label, value]) => statItem(label, value)).join("")}
      </div>
    </article>
  `;
    els.overviewCard.style.display = "block";
}

async function loadOverview(symbol) {
    if (!symbol) {
        showToast("Seleziona un'azienda prima di caricare l'overview.", "warning");
        return;
    }
    try {
        const overview = await getOverview(symbol);
        if (!overview) throw new Error("Overview non disponibile.");
        renderOverview(overview);
        showToast(`Overview caricata per ${symbol}.`, "success");
    } catch (error) {
        renderOverview(null);
        showToast("Impossibile caricare l'overview.", "error");
    }
}

function formatChartDate(dateString) {
    const date = new Date(dateString);
    return Number.isNaN(date.getTime())
        ? dateString
        : new Intl.DateTimeFormat("it-IT", {
            day: "2-digit",
            month: "short",
        }).format(date);
}

function extractSeriesData(rawSeries, limit) {
    if (!rawSeries) return [];
    return Object.entries(rawSeries)
        .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
        .slice(-limit)
        .map(([date, values]) => ({
            date,
            close: Number.parseFloat(values["4. close"] || values.close || values["5. adjusted close"] || values["4. close "]) || 0,
        }));
}

function lookupOfflineSeries(symbol, limit) {
    const entry = state.offlineCache?.TIME_SERIES_MONTHLY?.find((item) => normalizeText(item.symbol) === normalizeText(symbol));
    const rawSeries = entry?.["Monthly Time Series"] || null;
    return extractSeriesData(rawSeries, limit);
}

async function fetchLiveSeries(symbol, periodDays) {
    let functionName = "TIME_SERIES_MONTHLY";
    let seriesKey = "Monthly Time Series";
    let limit = 12;

    if (periodDays <= 30) {
        functionName = "TIME_SERIES_DAILY_ADJUSTED";
        seriesKey = "Time Series (Daily)";
        limit = periodDays;
    } else if (periodDays <= 90) {
        functionName = "TIME_SERIES_WEEKLY";
        seriesKey = "Weekly Time Series";
        limit = Math.ceil(periodDays / 7);
    } else {
        functionName = "TIME_SERIES_MONTHLY";
        seriesKey = "Monthly Time Series";
        limit = Math.max(12, Math.ceil(periodDays / 30));
    }

    const url = `${CONFIG.alphaVantageBaseUrl}?function=${functionName}&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(CONFIG.alphaVantageKey)}`;
    const response = await ajax.sendRequest("GET", url);
    const payload = response.data;
    if (payload?.Note || payload?.Information || payload?.Error_Message) {
        throw new Error(payload.Note || payload.Information || payload.Error_Message);
    }

    const rawSeries = payload?.[seriesKey] || payload?.["Monthly Time Series"] || payload?.["Weekly Time Series"] || payload?.["Time Series (Daily)"];
    return extractSeriesData(rawSeries, limit);
}

async function getSeries(symbol, periodDays) {
    const useLive = CONFIG.alphaVantageKey && CONFIG.alphaVantageKey !== "demo";
    if (useLive) {
        try {
            const liveSeries = await fetchLiveSeries(symbol, periodDays);
            if (liveSeries.length) return liveSeries;
        } catch (error) {
            console.warn("Live time series failed, falling back to local cache:", error);
        }
    }
    const fallbackLimit = periodDays <= 30 ? periodDays : periodDays <= 90 ? Math.ceil(periodDays / 7) : Math.max(12, Math.ceil(periodDays / 30));
    return lookupOfflineSeries(symbol, fallbackLimit);
}

function refreshChartTheme() {
    if (!state.chart) return;
    const colors = getThemeColors();
    state.chart.options.plugins.title.color = colors.text;
    state.chart.options.scales.x.ticks.color = colors.muted;
    state.chart.options.scales.y.ticks.color = colors.muted;
    state.chart.options.scales.x.grid.color = colors.grid;
    state.chart.options.scales.y.grid.color = colors.grid;
    state.chart.options.plugins.legend.labels.color = colors.text;
    state.chart.update();
}

function getThemeColors() {
    const styles = getComputedStyle(document.body);
    return {
        accent: styles.getPropertyValue("--accent").trim() || "#dc3545",
        text: styles.getPropertyValue("--text-primary").trim() || "#000",
        muted: styles.getPropertyValue("--text-secondary").trim() || "#4f4f4f",
        grid: getTheme() === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
        card: styles.getPropertyValue("--bg-card").trim() || "#fffeef",
    };
}

function destroyChart() {
    if (state.chart) {
        state.chart.destroy();
        state.chart = null;
    }
}

function renderChart(symbol, series, periodLabel, chartType) {
    if (!series.length) {
        throw new Error("Serie storica non disponibile.");
    }

    destroyChart();
    els.chartPlaceholder.style.display = "none";
    els.chartBox.style.display = "block";

    const colors = getThemeColors();
    const labels = series.map((item) => formatChartDate(item.date));
    const values = series.map((item) => item.close);
    const ctx = els.stockChart.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(220, 53, 69, 0.35)");
    gradient.addColorStop(1, "rgba(220, 53, 69, 0.02)");

    state.currentChartSymbol = symbol;
    els.chartTitle.textContent = `${symbol} - ${periodLabel}`;

    state.chart = new Chart(ctx, {
        type: chartType,
        data: {
            labels,
            datasets: [
                {
                    label: `${symbol} Close`,
                    data: values,
                    borderColor: colors.accent,
                    backgroundColor: chartType === "bar" ? gradient : "rgba(220, 53, 69, 0.18)",
                    tension: 0.35,
                    fill: chartType === "line",
                    borderWidth: 2,
                    pointRadius: chartType === "line" ? 3 : 0,
                    pointHoverRadius: 5,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                    labels: {
                        color: colors.text,
                    },
                },
                title: {
                    display: true,
                    text: `${symbol} - ${periodLabel}`,
                    color: colors.text,
                    font: {
                        family: "Syne, sans-serif",
                        size: 18,
                        weight: "bold",
                    },
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: colors.muted,
                        maxRotation: 0,
                        autoSkip: true,
                    },
                    grid: {
                        color: colors.grid,
                    },
                },
                y: {
                    ticks: {
                        color: colors.muted,
                    },
                    grid: {
                        color: colors.grid,
                    },
                },
            },
        },
    });
}

async function loadChart(symbol, periodDays, chartType) {
    if (!symbol) {
        showToast("Seleziona un'azienda prima di generare il grafico.", "warning");
        return;
    }

    try {
        const series = await getSeries(symbol, periodDays);
        if (!series.length) throw new Error("Serie vuota.");
        const periodLabel = els.chartPeriod.options[els.chartPeriod.selectedIndex]?.text || `${periodDays} giorni`;
        renderChart(symbol, series, periodLabel, chartType);
        showToast(`Grafico generato per ${symbol}.`, "success");
    } catch (error) {
        els.chartPlaceholder.style.display = "flex";
        els.chartBox.style.display = "none";
        showToast("Impossibile generare il grafico.", "error");
    }
}

function saveChartAsPng() {
    if (!state.chart) {
        showToast("Genera prima un grafico.", "warning");
        return;
    }

    const sourceCanvas = state.chart.canvas;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = sourceCanvas.width;
    exportCanvas.height = sourceCanvas.height;
    const ctx = exportCanvas.getContext("2d");
    ctx.fillStyle = getThemeColors().card;
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(sourceCanvas, 0, 0);

    const link = document.createElement("a");
    link.href = exportCanvas.toDataURL("image/png");
    link.download = `stockvision-${state.currentChartSymbol || "chart"}.png`;
    link.click();
    showToast("Grafico salvato come PNG.", "success");
}

function getOfflineAddress(symbol) {
    const overview = lookupOfflineOverview(symbol);
    return overview?.Address || "";
}

async function geocodeAddress(address) {
    const url = `${CONFIG.nominatimBaseUrl}?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
    const response = await ajax.sendRequest("GET", url);
    const feature = response.data?.[0];
    if (!feature) return null;
    return {
        lat: Number.parseFloat(feature.lat),
        lon: Number.parseFloat(feature.lon),
        displayName: feature.display_name || address,
    };
}

function ensureMap() {
    if (state.map) return state.map;

    state.map = L.map("map", {
        zoomControl: true,
        scrollWheelZoom: false,
    }).setView([20, 0], 2);

    refreshMapTiles();
    return state.map;
}

function refreshMapTiles() {
    if (!state.map) return;
    if (state.mapTileLayer) {
        state.map.removeLayer(state.mapTileLayer);
    }

    const isDark = getTheme() === "dark";
    const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    state.mapTileLayer = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(state.map);

    if (state.map) {
        setTimeout(() => state.map.invalidateSize(), 0);
    }
}

async function showCompanyOnMap(symbol) {
    if (!symbol) {
        showToast("Seleziona un'azienda prima di aprire la mappa.", "warning");
        return;
    }

    try {
        ensureMap();
        let overview = await getOverview(symbol);
        if (!overview) {
            overview = lookupOfflineOverview(symbol);
        }
        const address = overview?.Address || getOfflineAddress(symbol);
        if (!address) {
            throw new Error("Indirizzo non disponibile.");
        }

        const geo = await geocodeAddress(address);
        if (!geo) {
            throw new Error("Geocoding fallito.");
        }

        if (state.mapMarker) {
            state.map.removeLayer(state.mapMarker);
        }

        state.map.setView([geo.lat, geo.lon], 13, { animate: true });
        state.mapMarker = L.marker([geo.lat, geo.lon]).addTo(state.map);
        state.mapMarker.bindPopup(`
      <strong>${escapeHtml(overview?.Name || symbol)}</strong><br/>
      ${escapeHtml(geo.displayName)}
    `).openPopup();

        els.mapAddressBadge.textContent = geo.displayName;
        els.mapAddressBadge.style.display = "block";
        showToast(`Mappa aggiornata per ${symbol}.`, "success");
    } catch (error) {
        showToast("Impossibile visualizzare la sede su mappa.", "error");
    }
}

function selectSymbol(symbol, sourceId = "") {
    if (!symbol) return;
    syncSelectValues(symbol, sourceId);
}

function bindEvents() {
    els.themeToggle.addEventListener("click", toggleTheme);

    els.companySelect.addEventListener("change", () => {
        const symbol = els.companySelect.value;
        if (!symbol) return;
        selectSymbol(symbol, "companySelect");
        loadQuote(symbol);
    });

    els.btnQuote.addEventListener("click", () => {
        const symbol = els.companySelect.value;
        if (!symbol) {
            showToast("Seleziona un'azienda prima di caricare la quotazione.", "warning");
            return;
        }
        loadQuote(symbol);
    });

    els.btnUpdateQuote.addEventListener("click", () => {
        const symbol = els.companySelect.value;
        if (!symbol) {
            showToast("Seleziona un'azienda prima di fare l'update.", "warning");
            return;
        }
        loadQuote(symbol, { forceLive: true });
    });

    els.searchInput.addEventListener("keyup", debounce((event) => {
        renderSearchResults(event.target.value);
    }, 120));

    els.searchResults.addEventListener("click", (event) => {
        const card = event.target.closest("[data-symbol]");
        if (!card) return;
        const symbol = card.getAttribute("data-symbol");
        selectSymbol(symbol);
        els.companySelect.value = symbol;
        loadQuote(symbol);
    });

    els.searchResults.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest("[data-symbol]");
        if (!card) return;
        event.preventDefault();
        const symbol = card.getAttribute("data-symbol");
        selectSymbol(symbol);
        els.companySelect.value = symbol;
        loadQuote(symbol);
    });

    els.chartSymbol.addEventListener("change", () => {
        const symbol = els.chartSymbol.value;
        if (!symbol) return;
        selectSymbol(symbol, "chartSymbol");
    });

    els.btnChart.addEventListener("click", () => {
        const symbol = els.chartSymbol.value || els.companySelect.value;
        const periodDays = Number.parseInt(els.chartPeriod.value, 10);
        const chartType = els.chartType.value;
        if (!symbol) {
            showToast("Seleziona un'azienda prima di generare il grafico.", "warning");
            return;
        }
        loadChart(symbol, periodDays, chartType);
    });

    els.btnSaveChart.addEventListener("click", saveChartAsPng);

    els.overviewSymbol.addEventListener("change", () => {
        const symbol = els.overviewSymbol.value;
        if (!symbol) return;
        selectSymbol(symbol, "overviewSymbol");
    });

    els.btnOverview.addEventListener("click", () => {
        const symbol = els.overviewSymbol.value || els.companySelect.value;
        if (!symbol) {
            showToast("Seleziona un'azienda prima di caricare l'overview.", "warning");
            return;
        }
        loadOverview(symbol);
    });

    els.mapSymbol.addEventListener("change", () => {
        const symbol = els.mapSymbol.value;
        if (!symbol) return;
        selectSymbol(symbol, "mapSymbol");
    });

    els.btnMap.addEventListener("click", () => {
        const symbol = els.mapSymbol.value || els.companySelect.value;
        if (!symbol) {
            showToast("Seleziona un'azienda prima di aprire la mappa.", "warning");
            return;
        }
        showCompanyOnMap(symbol);
    });
}

async function init() {
    const savedTheme = localStorage.getItem(CONFIG.themeStorageKey) || "light";
    setTheme(savedTheme);
    bindEvents();

    state.offlineCache = await loadLocalJson(CONFIG.offlineCacheUrl);
    const companies = await loadCompanies();
    setCompanies(companies);
    buildSelectOptions();
    renderSearchResults("");

    showToast("Dati locali caricati correttamente.", "success");
}

init().catch((error) => {
    console.error(error);
    showToast("Errore durante l'inizializzazione dell'app.", "error");
});
