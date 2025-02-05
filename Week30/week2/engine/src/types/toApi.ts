import { Order } from "../trade/Orderbook";
export type MessageToApi =
  | {
      type: "TICKERS";
      payload: {
        firstPrice: string;
        high: string;
        lastPrice: string;
        low: string;
        priceChange: string;
        priceChangePercent: string;
        quoteVolume: string;
        symbol: string;
        trades: string;
        volume: string;
      }[];
    }
  | {
      type: "DEPTH";
      payload: {
        bids: [string, string][];
        asks: [string, string][];
      };
    }
  | {
      type: "ORDER_PLACED";
      payload: {
        orderId: string;
        executedQty: number;
        fills: {
          price: string;
          qty: number;
          tradeId: number;
        }[];
      };
    }
  | {
      type: "ORDER_CANCELLED";
      payload: {
        orderId: string;
        executedQty: number;
        remainingQty: number;
      };
    }
  | {
      type: "OPEN_ORDERS";
      payload: Order[];
    };
