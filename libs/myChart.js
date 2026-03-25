"use strict";

// Classe di visualizzazione per un diagramma a barre
// (singolo dataset). Colore e spessore del bordo sono fissi

class MyBarChart {

	#chartOptions = {
		type: "bar",   // pie, doughnut, line, radar
		data: {
			"labels": [],    // chiavi (elenco nazioni)
			"datasets": [{
				//	label riassuntiva di ogni singolo dataset
				//  (se il dataset è uno solo ha senso nasconderla) 			
				"label": "2026",
				"data": [],
				"backgroundColor": [],
				"borderColor": "#555",
				"borderWidth": 1  // default=2  
			}]
		},
		options: {
			// scales Y è relativo solo ai diagrammi a barre
			scales: {
				y: {
					suggestedMax: +1,
					suggestedMin: 0,
					beginAtZero: true
				}
			},
			plugins: {
				title: {
					display: true,
					text: 'Main Title',
					font: {
						size: 20,
						weight: 'bold',
						family: 'Arial'
					},
					color: '#333'
				},
				// visualizzazione e posizione della label di ogni singolo dataset
				// true ha senso per diagrammi a torta o a barre multiple
				legend: {
					display: false,
					//  La label viene comunque visualizzata in corrispondenza
					//  dell'hover sulle singole barre.
					// position: 'top',  // default
				},
			},
			// impostazione del responsive
			responsive: true,
			aspectRatio: true,
			maintainAspectRatio: false,
		}
	}

	setChartOptions(title, keysArray, valuesArray, colorsArray) {
		let max = Math.max(valuesArray)+1;
		let min = Math.min(valuesArray)-1;
		this.#chartOptions.options.plugins.title.text = title
		this.#chartOptions.data.labels = keysArray
		this.#chartOptions.data.datasets[0].data = valuesArray
		this.#chartOptions.data.datasets[0].backgroundColor = colorsArray
		this.#chartOptions.options.scales.y.suggestedMax = max;
		this.#chartOptions.options.scales.y.suggestedMin = min;
	}

	getChartOptions() {
		return this.#chartOptions
	}

	setWhiteBackground(canvas) {
		const ctx = canvas.getContext("2d");
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		ctx.globalCompositeOperation = "destination-over";
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

} // End Class

let myBarChart = new MyBarChart()
