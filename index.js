 "use strict"
const API_KEY = "xxxxxx" //Da generare su https://www.alphavantage.co/support/#api-key
const ALPHA_URL = "https://www.alphavantage.co/query"
const LOCAL_URL = "http://localhost:3000"
// in myAxios impostare _URL = ""

getGlobalQuotes("IBM");

function getGlobalQuotes(farm) {
   let promise = ajax.sendRequest("GET", ALPHA_URL, {
		"function": "GLOBAL_QUOTE",
		"symbol": farm,
		"apikey": API_KEY
	})
    promise.catch(ajax.errore)
    promise.then((httpResponse)=>{
	    if(httpResponse["data"]["Global Quote"]){
			createHeaders()
			createBody(httpResponse["data"]["Global Quote"])
		}
		else
			alert(httpResponse["data"]["Information"])
    })
}
	
function createHeaders(){
	const HEADERS = ["Symbol", "Last Trade", "Volume", "Open", "Day's High", 
      "Day's Low", "Last Trade Day", "Previous Close", "Change", "% Change" ]
	const headersRow = document.querySelector(".header")
	for (let header of HEADERS){
		const td = document.createElement("td")
		td.textContent=header;
		headersRow.append(td)
	}
}
function createBody(quote){
	console.log(quote)
	symbol.textContent=quote["01. symbol"]
	lastTrade.textContent=quote["05. price"]
	volume.textContent=quote["06. volume"]
	openValue.textContent=quote["02. open"]
	daysHigh.textContent=quote["03. high"]
	daysLow.textContent=quote["04. low"]
	lastTradeDay.textContent=quote["07. latest trading day"]
	previousClose.textContent=quote["08. previous close"]
	change.textContent=quote["09. change"]
	changePercent.textContent=quote["10. change percent"]
}


search.querySelector("input").addEventListener("keyup", function(){
	if(this.value.length <2)
		return
    let promise = ajax.sendRequest("GET", ALPHA_URL, {
		"function": "SYMBOL_SEARCH",
		"keywords": this.value,
		"apikey": "demo"
	})
    promise.catch(ajax.errore)
    promise.then((httpResponse)=>{
		console.log(httpResponse["data"])	
	})
})

search.querySelector("button").addEventListener("click", function(){
    let promise = ajax.sendRequest("GET", ALPHA_URL, {
		"function": "OVERVIEW",
		"symbol": "IBM",
		"apikey": "demo"
	})
    promise.catch(ajax.errore)
    promise.then((httpResponse)=>{
		console.log(httpResponse["data"])	
	})
})
