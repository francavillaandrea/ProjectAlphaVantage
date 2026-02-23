"use strict";

const API_KEY = "xxxxxx"; // Inserisci la tua API key AlphaVantage
const ALPHA_URL = "https://www.alphavantage.co/query";
const LOCAL_URL = "http://localhost:3000";

const HEADERS = [
    "Symbol",
    "Last Trade",
    "Volume",
    "Open",
    "Day's High",
    "Day's Low",
    "Last Trade Day",
    "Previous Close",
    "Change",
    "% Change"
];

const ui = {
    cmbCompanies: document.getElementById("cmbCompanies"),
    status: document.getElementById("status"),
    searchInput: document.getElementById("txtSearch"),
    searchResults: document.getElementById("searchResults"),
    symbol: document.getElementById("symbol"),
    lastTrade: document.getElementById("lastTrade"),
    volume: document.getElementById("volume"),
    openValue: document.getElementById("openValue"),
    daysHigh: document.getElementById("daysHigh"),
    daysLow: document.getElementById("daysLow"),
    lastTradeDay: document.getElementById("lastTradeDay"),
    previousClose: document.getElementById("previousClose"),
    change: document.getElementById("change"),
    changePercent: document.getElementById("changePercent")
};

let companiesCache = [];

init();

function init() {
    createHeaders();
    bindEvents();
    loadCompanies();
}

function bindEvents() {
    ui.cmbCompanies.addEventListener("change", onCompanyChange);
    ui.searchInput.addEventListener("keyup", onIncrementalSearch);
}

async function loadCompanies() {
    setStatus("Caricamento elenco aziende da json-server...");
    try {
        const response = await ajax.sendRequest("GET", `${LOCAL_URL}/companies`);
        companiesCache = Array.isArray(response.data) ? response.data : [];

        if (companiesCache.length === 0) {
            setStatus("Nessuna azienda presente in db.json");
            return;
        }

        populateCompanySelect(companiesCache);
        setStatus(`Aziende caricate: ${companiesCache.length}`, true);

        ui.cmbCompanies.selectedIndex = 1;
        getGlobalQuote(ui.cmbCompanies.value);
    } catch (err) {
        console.error;
        setStatus("Errore nel caricamento aziende locali");
    }
}

function populateCompanySelect(companies) {
    ui.cmbCompanies.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Seleziona azienda...";
    ui.cmbCompanies.append(placeholder);

    for (const company of companies) {
        const option = document.createElement("option");
        option.value = company.symbol;
        option.textContent = `${company.symbol} - ${company.name}`;
        ui.cmbCompanies.append(option);
    }
}

async function onCompanyChange() {
    const symbol = ui.cmbCompanies.value;
    if (!symbol) {
        clearQuote();
        return;
    }

    await getGlobalQuote(symbol);
}

async function getGlobalQuote(symbol) {
    setStatus(`Richiesta GLOBAL_QUOTE per ${symbol}...`);
    try {
        const response = await ajax.sendRequest("GET", ALPHA_URL, {
            function: "GLOBAL_QUOTE",
            symbol,
            apikey: API_KEY
        });

        const quote = response?.data?.["Global Quote"];
        if (!quote || Object.keys(quote).length === 0) {
            const info = response?.data?.Information || "Risposta vuota da AlphaVantage";
            setStatus(info);
            return;
        }

        fillQuote(quote);
        setStatus(`Quotazione aggiornata: ${symbol}`, true);
    } catch (err) {
        console.error;
        setStatus(`Errore durante la lettura della quotazione di ${symbol}`);
    }
}

function createHeaders() {
    const row = document.querySelector(".header");
    row.innerHTML = "";
    for (const title of HEADERS) {
        const td = document.createElement("td");
        td.textContent = title;
        row.append(td);
    }
}

function fillQuote(quote) {
    ui.symbol.textContent = quote["01. symbol"] || "";
    ui.lastTrade.textContent = quote["05. price"] || "";
    ui.volume.textContent = quote["06. volume"] || "";
    ui.openValue.textContent = quote["02. open"] || "";
    ui.daysHigh.textContent = quote["03. high"] || "";
    ui.daysLow.textContent = quote["04. low"] || "";
    ui.lastTradeDay.textContent = quote["07. latest trading day"] || "";
    ui.previousClose.textContent = quote["08. previous close"] || "";
    ui.change.textContent = quote["09. change"] || "";
    ui.changePercent.textContent = quote["10. change percent"] || "";
}

function clearQuote() {
    ui.symbol.textContent = "";
    ui.lastTrade.textContent = "";
    ui.volume.textContent = "";
    ui.openValue.textContent = "";
    ui.daysHigh.textContent = "";
    ui.daysLow.textContent = "";
    ui.lastTradeDay.textContent = "";
    ui.previousClose.textContent = "";
    ui.change.textContent = "";
    ui.changePercent.textContent = "";
}

async function onIncrementalSearch() {
    const query = ui.searchInput.value.trim();

    if (query.length < 2) {
        ui.searchResults.innerHTML = "";
        return;
    }

    try {
        const response = await ajax.sendRequest("GET", `${LOCAL_URL}/companies`, { q: query });
        const matches = Array.isArray(response.data) ? response.data.slice(0, 12) : [];
        renderSearchResults(matches);
    } catch (err) {
        console.error;
        ui.searchResults.innerHTML = "";
    }
}

function renderSearchResults(matches) {
    ui.searchResults.innerHTML = "";

    if (matches.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Nessun risultato";
        ui.searchResults.append(li);
        return;
    }

    for (const company of matches) {
        const li = document.createElement("li");
        li.textContent = `${company.symbol} - ${company.name}`;
        li.dataset.symbol = company.symbol;
        li.addEventListener("click", () => {
            ui.cmbCompanies.value = company.symbol;
            ui.searchResults.innerHTML = "";
            ui.searchInput.value = `${company.symbol} - ${company.name}`;
            getGlobalQuote(company.symbol);
        });
        ui.searchResults.append(li);
    }
}

function setStatus(message, ok = false) {
    ui.status.textContent = message;
    ui.status.classList.toggle("ok", ok);
}
