"use strict";

class Ajax {

	// Properties
	_URL = ""

	// Methods
	// method può essere GET oppure POST
	// url = rappresenta la risorsa da richiederre al server (es /api)
	// parameters = contiene i parametri della richiesta scritti in formato JSON
	// In caso di chiamata GET, sarà sendRequest a convertire questi parametri in url-encoded 
	// e accodarli alla URL
	sendRequest(method, url, parameters = {}) {
		let options = {
			"baseURL": this._URL,            // indirizzo del server
			"url": url,                    // risorsa da richiedere
			"method": method.toUpperCase(), // metodo da usare per la richiesta
			"headers": { "Accept": "application/json" }, // consigliata
			"responseType": "json",         // indica il formato dei dati che andremo a ricevere
			"timeout": 5000,                // tempo max di attesa della risposta (5 sec)
		}

		if (method.toUpperCase() == "GET") {
			// definisco il Content-Type dell'urlencoded
			options.headers["Content-Type"] = "application/x-www-form-urlenconded;charset=utf-8"
			// prende i parameters, li converte in urlencoded e li accoda alla url
			options.params = parameters;
		}
		else { // POST
			// nel caso delle chiamate diverse da GET, i parametri saranno passati in JSON
			options.headers["Content-Type"] = "application/json;charset=utf-8"
			// scrive i parametri nel body della http Request
			options.data = parameters
		}
		let promise = axios(options)  // axios restituisce una promise
		return promise;
	}

	errore(err) {
		if (!err.response)
			alert("Connection Refused or Server timeout");
		// 200 significa che lato server NON ci sono stati errori, però il risultato 
		// è stato restituito come JSON non valido, per il client va in errore durante il parsing
		else if (err.response.status == 200)
			alert("Formato dei dati non corretto : " + err.response.data);
		else
			alert("Server Error: " + err.response.status + " - " + err.response.data)
	}

}

let ajax = new Ajax()
