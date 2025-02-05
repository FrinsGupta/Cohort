import { log } from "console";
import { Ticker, Trade } from "./types";

export const BASE_URL = "wss://ws.backpack.exchange/"
// export const BASE_URL = "ws://localhost:8080"

export class SignalingManager {
    private ws: WebSocket;
    private static instance: SignalingManager;
    private bufferedMessages: any[] = [];
    private callbacks: any = {};
    private id: number;
    private initialized: boolean = false;

    private constructor() {
        this.ws = new WebSocket(BASE_URL);
        this.bufferedMessages = [];
        this.id = 1;
        this.init();
    }

    public static getInstance() {
        if (!this.instance)  {
            this.instance = new SignalingManager();
        }
        return this.instance;
    }

    init() {
        this.ws.onopen = () => {
            this.initialized = true;
            this.bufferedMessages.forEach(message => {
                this.ws.send(JSON.stringify(message));
            });
            this.bufferedMessages = [];
        }
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            // console.log(this.callbacks);
            
            const type = message?.data?.e;
            // console.log(type);
            
            if (this.callbacks[type]) {
                this.callbacks[type].forEach(({ callback }: any) => {
                    if (type === "ticker") {
                        const newTicker: Partial<Ticker> = {
                            firstPrice: message.data.x,
                            high: message.data.h,
                            lastPrice: message.data.c,
                            low: message.data.l,
                            priceChangePercent: message.data.P,
                            priceChange: message.data.p,
                            quoteVolume: message.data.q,
                            symbol: message.data.s,
                            trades: message.data.n,
                            volume: message.data.v,
                        }
                        // console.log(newTicker);
                        callback(newTicker);
                   }
                   
                    if (type === "trade") {
                        const newTrade: Trade = {
                            id: message.data.t,
                            isBuyerMaker: message.data.m,
                            price: message.data.p,
                            quantity: message.data.q,
                            timestamp: message.data.T,
                        }
                        // console.log(newTrade);
                        callback(newTrade);
                   }
                   if (type === "depth") {
                        // const newTicker: Partial<Ticker> = {
                        //     lastPrice: message.data.c,
                        //     high: message.data.h,
                        //     low: message.data.l,
                        //     volume: message.data.v,
                        //     quoteVolume: message.data.V,
                        //     symbol: message.data.s,
                        // }
                        // console.log(newTicker);
                        // callback(newTicker);
                        const updatedBids = message.data.b;
                        const updatedAsks = message.data.a;
                        // console.log([...updatedBids,...updatedAsks]);
                        // console.log(updatedBids);
                        
                        callback({ bids: updatedBids, asks: updatedAsks });
                    }
                });
            }
        }
    }

    sendMessage(message: any) {
        const messageToSend = {
            ...message,
            id: this.id++
        }
        if (!this.initialized) {
            this.bufferedMessages.push(messageToSend);
            return;
        }
        this.ws.send(JSON.stringify(messageToSend));
    }

    async registerCallback(type: string, callback: any, id: string) {
        this.callbacks[type] = this.callbacks[type] || [];
        this.callbacks[type].push({ callback, id });
        // "ticker" => callback
    }

    async deRegisterCallback(type: string, id: string) {
        if (this.callbacks[type]) {
            const index = this.callbacks[type].findIndex((callback: {id: string}) => callback.id === id);
            if (index !== -1) {
                this.callbacks[type].splice(index, 1);
            }
        }
    }
}