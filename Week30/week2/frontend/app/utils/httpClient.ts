import axios from "axios";
import { Depth, KLine, Ticker, Trade } from "./types";
import { log } from "console";

// const BASE_URL = "https://exchange-proxy.100xdevs.com/api/v1";
const BASE_URL = "http://localhost:3001/api/v1";
// const BASE_URL = "http://localhost:3005/api/v1";

export async function getTicker(market: string): Promise<Ticker> {
    const tickers = await getTickers();
    const ticker = tickers.find(t => t.symbol === market);
    if (!ticker) {
        throw new Error(`No ticker found for ${market}`);
    }
    // console.log(ticker);
    return ticker;
}

export async function getTickers(): Promise<Ticker[]> {
    const response = await axios.get(`${BASE_URL}/tickers`);
    return response.data;
}


export async function getDepth(market: string): Promise<Depth> {
    const response = await axios.get(`${BASE_URL}/depth?symbol=${market}`);
    return response.data;
}
export async function getTrades(market: string) {
    const response = await axios.get(`${BASE_URL}/trades?symbol=${market}`);    
    return response.data;
}

export async function getKlines(market: string, interval: string, startTime: number, endTime: number): Promise<KLine[]> {
    const response = await axios.get(`${BASE_URL}/klines?symbol=${market}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`);
    const data: KLine[] = response.data;
    console.log(data);
    return data.sort((x, y) => (Number(x.end) < Number(y.end) ? -1 : 1));
}

export async function createOrder(market: string, price: string, quantity: string, side: 'buy'| 'sell', userId: string) {
    const response = await axios.post(`${BASE_URL}/order`, { market, price, quantity, side, userId });
    return response.data;
 }
