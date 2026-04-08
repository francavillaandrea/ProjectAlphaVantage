"use strict";

/*
   myCharts.js
   Una classe per ogni tipo di grafico.
   Ogni classe espone un unico metodo:
       build(canvas, voci, titolo, symbol) → Chart
   Tutte leggono il tema corrente dal body per i colori.
*/

function getChartTheme() {
    const isDark = document.body.classList.contains("dark-mode");
    return {
        isDark,
        gridColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)",
        textColor: isDark ? "#8b93a8" : "#4a5168",
        titleColor: isDark ? "#f0f4ff" : "#0d1117",
        bgColor: isDark ? "#1a1f2e" : "#ffffff",
        accentColor: getComputedStyle(document.documentElement)
            .getPropertyValue("--accent").trim() || "#dc3545",
        upColor: "#00c97a",
        downColor: "#ff4d6d",
    };
}

// Distrugge il grafico precedente se esiste
function destroyChart(chartInstance) {
    if (chartInstance) {
        chartInstance.destroy();
    }
}

// Estrae labels e valori di chiusura dalle voci [data, candela]
function estraiLabelValues(voci) {
    const labels = [], values = [], colors = [];
    for (let [data, candela] of voci) {
        labels.push(data.substring(0, 7));
        const close = parseFloat(candela["4. close"]);
        const open = parseFloat(candela["1. open"]);
        values.push(close);
        colors.push(close >= open ? "rgba(0,201,122,0.80)" : "rgba(255,77,109,0.80)");
    }
    return { labels, values, colors };
}

// Opzioni assi comuni (x/y con griglia tema)
function axisOptions(theme) {
    return {
        x: {
            ticks: { color: theme.textColor, font: { family: "JetBrains Mono, monospace", size: 10 } },
            grid: { color: theme.gridColor }
        },
        y: {
            ticks: {
                color: theme.textColor,
                font: { family: "JetBrains Mono, monospace", size: 10 },
                callback: v => "$" + v.toFixed(0)
            },
            grid: { color: theme.gridColor }
        }
    };
}

function pluginOptions(theme, titolo) {
    return {
        title: {
            display: true,
            text: titolo,
            color: theme.titleColor,
            font: { size: 15, weight: "bold", family: "Syne, sans-serif" }
        },
        legend: { display: false },
        tooltip: {
            backgroundColor: theme.bgColor,
            titleColor: theme.titleColor,
            bodyColor: theme.textColor,
            borderColor: "rgba(128,128,128,0.2)",
            borderWidth: 1,
            padding: 10,
        }
    };
}


/*
   1. LINE CHART

*/
class LineChartBuilder {
    build(canvas, voci, titolo, symbol, chartPrecedente) {
        destroyChart(chartPrecedente);
        const theme = getChartTheme();
        const { labels, values } = estraiLabelValues(voci);

        return new Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: symbol,
                    data: values,
                    borderColor: theme.accentColor,
                    backgroundColor: theme.accentColor + "22",
                    borderWidth: 2,
                    pointRadius: values.length > 60 ? 0 : 3,
                    pointHoverRadius: 5,
                    tension: 0.35,
                    fill: false,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: pluginOptions(theme, titolo),
                scales: axisOptions(theme),
            }
        });
    }
}


/*
   2. BAR CHART  (colore verde/rosso per candela)

*/
class BarChartBuilder {
    build(canvas, voci, titolo, symbol, chartPrecedente) {
        destroyChart(chartPrecedente);
        const theme = getChartTheme();
        const { labels, values, colors } = estraiLabelValues(voci);

        return new Chart(canvas, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: symbol,
                    data: values,
                    backgroundColor: colors,
                    borderColor: "transparent",
                    borderWidth: 0,
                    borderRadius: 3,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: pluginOptions(theme, titolo),
                scales: axisOptions(theme),
            }
        });
    }
}


/*
   3. AREA CHART  (line con fill gradiente)

*/
class AreaChartBuilder {
    build(canvas, voci, titolo, symbol, chartPrecedente) {
        destroyChart(chartPrecedente);
        const theme = getChartTheme();
        const { labels, values } = estraiLabelValues(voci);

        // Gradiente verticale
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 400);
        gradient.addColorStop(0, theme.accentColor + "55");
        gradient.addColorStop(1, theme.accentColor + "00");

        return new Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: symbol,
                    data: values,
                    borderColor: theme.accentColor,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: values.length > 60 ? 0 : 2,
                    pointHoverRadius: 5,
                    tension: 0.4,
                    fill: true,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: pluginOptions(theme, titolo),
                scales: axisOptions(theme),
            }
        });
    }
}


/*
   4. CANDLESTICK  (richiede chartjs-chart-financial)

*/
class CandlestickChartBuilder {
    build(canvas, voci, titolo, symbol, chartPrecedente) {
        destroyChart(chartPrecedente);
        const theme = getChartTheme();

        const dataPoints = voci.map(([data, c]) => ({
            x: new Date(data).getTime(),
            o: parseFloat(c["1. open"]),
            h: parseFloat(c["2. high"]),
            l: parseFloat(c["3. low"]),
            c: parseFloat(c["4. close"]),
        }));

        return new Chart(canvas, {
            type: "candlestick",
            data: {
                datasets: [{
                    label: symbol,
                    data: dataPoints,
                    color: { up: theme.upColor, down: theme.downColor, unchanged: "#aaa" },
                    borderColor: { up: theme.upColor, down: theme.downColor, unchanged: "#aaa" },
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: {
                    ...pluginOptions(theme, titolo),
                    tooltip: {
                        backgroundColor: theme.bgColor,
                        titleColor: theme.titleColor,
                        bodyColor: theme.textColor,
                        borderColor: "rgba(128,128,128,0.2)",
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: ctx => {
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
                        ticks: {
                            color: theme.textColor, maxRotation: 0,
                            font: { family: "JetBrains Mono, monospace", size: 10 }
                        },
                        grid: { color: theme.gridColor }
                    },
                    y: {
                        ticks: {
                            color: theme.textColor,
                            font: { family: "JetBrains Mono, monospace", size: 10 },
                            callback: v => "$" + v.toFixed(0)
                        },
                        grid: { color: theme.gridColor }
                    }
                }
            }
        });
    }
}


/*
   5. RADAR CHART  (ultimi N mesi come assi radiali)
*/
class RadarChartBuilder {
    build(canvas, voci, titolo, symbol, chartPrecedente) {
        destroyChart(chartPrecedente);
        const theme = getChartTheme();
        const { labels, values } = estraiLabelValues(voci);

        return new Chart(canvas, {
            type: "radar",
            data: {
                labels,
                datasets: [{
                    label: symbol,
                    data: values,
                    borderColor: theme.accentColor,
                    backgroundColor: theme.accentColor + "22",
                    pointBackgroundColor: theme.accentColor,
                    pointRadius: 3,
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: pluginOptions(theme, titolo),
                scales: {
                    r: {
                        ticks: {
                            color: theme.textColor,
                            font: { family: "JetBrains Mono, monospace", size: 9 },
                            callback: v => "$" + v.toFixed(0),
                            backdropColor: "transparent"
                        },
                        grid: { color: theme.gridColor },
                        angleLines: { color: theme.gridColor },
                        pointLabels: {
                            color: theme.textColor,
                            font: { family: "JetBrains Mono, monospace", size: 9 }
                        }
                    }
                }
            }
        });
    }
}


/*
6. DOUGHNUT CHART  (distribuzione % dei prezzi di chiusura)
*/
class DoughnutChartBuilder {
    build(canvas, voci, titolo, symbol, chartPrecedente) {
        destroyChart(chartPrecedente);
        const theme = getChartTheme();
        const { labels, values } = estraiLabelValues(voci);

        // Palette di colori sfumati dall'accent
        const palette = values.map((_, i) => {
            const hue = (i / values.length) * 360;
            return `hsla(${hue}, 70%, 55%, 0.85)`;
        });

        return new Chart(canvas, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    label: symbol,
                    data: values,
                    backgroundColor: palette,
                    borderColor: theme.bgColor,
                    borderWidth: 2,
                    hoverOffset: 8,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: {
                    ...pluginOptions(theme, titolo),
                    legend: {
                        display: true,
                        position: "right",
                        labels: {
                            color: theme.textColor,
                            font: { family: "JetBrains Mono, monospace", size: 10 },
                            boxWidth: 14,
                            padding: 10,
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => " " + ctx.label + ": $" + ctx.parsed.toFixed(2)
                        }
                    }
                }
            }
        });
    }
}


/*
   FACTORY — restituisce il builder corretto
*/
const ChartFactory = {
    line: new LineChartBuilder(),
    bar: new BarChartBuilder(),
    area: new AreaChartBuilder(),
    candlestick: new CandlestickChartBuilder(),
    radar: new RadarChartBuilder(),
    doughnut: new DoughnutChartBuilder(),

    build(tipo, canvas, voci, titolo, symbol, chartPrecedente) {
        const builder = this[tipo];
        if (!builder) {
            console.error("Tipo grafico non supportato:", tipo);
            return null;
        }
        return builder.build(canvas, voci, titolo, symbol, chartPrecedente);
    }
};
