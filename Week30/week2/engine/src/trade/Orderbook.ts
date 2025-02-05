import { BASE_CURRENCY } from "./Engine";
export interface Order {
  price: number;
  quantity: number;
  orderId: string;
  filled: number;
  side: "buy" | "sell";
  userId: string;
}

export interface Fill {
  price: string;
  qty: number;
  tradeId: number;
  otherUserId: string;
  markerOrderId: string;
}

export class Orderbook {
  bids: Order[];
  asks: Order[];
  baseAsset: string;
  quoteAsset: string = BASE_CURRENCY;
  lastTradeId: number;
  currentPrice: number;

  constructor(baseAsset: string, bids: Order[], asks: Order[], lastTradeId: number, currentPrice: number) {
    this.asks = asks;
    this.bids = bids;
    this.baseAsset = baseAsset;
    this.lastTradeId = lastTradeId || 0;
    this.currentPrice = currentPrice || 0;
  }

  public ticker() {
    return `${this.baseAsset}_${this.quoteAsset}`;
  }

  addOrder(order: Order): {
    executedQty: number;
    fills: Fill[];
  } {
    if (order.side === "buy") {      
      const { executedQty, fills } = this.matchBid(order);
      // console.log(executedQty);
      
      order.filled = executedQty;
      if (order.quantity === executedQty) {
        return {
          executedQty,
          fills,
        };
      }
      this.bids.push(order);
      return {
        executedQty,
        fills,
      };
    } else {
      const { executedQty, fills } = this.matchAsk(order);
      // console.log(executedQty);

      order.filled = executedQty;
      if (order.quantity === executedQty) {
        return {
          executedQty,
          fills,
        };
      }
      this.asks.push(order);
      return {
        executedQty,
        fills,
      };
    }
  }

  getSnapshot() {
    return {
      baseAsset: this.baseAsset,
      bids: this.bids,
      asks: this.asks,
      lastTradeId: this.lastTradeId,
      currentPrice: this.currentPrice,
    };
  }

  getTicker() {
    return {
      firstPrice: "1",
      high:"22",
      lastPrice: (this.currentPrice).toString(),
      low: "3",
      priceChange: "4",
      priceChangePercent: "5",
      quoteVolume: "6",
      symbol: this.ticker(),
      trades: "8",
      volume: "9",
    };
  }

  matchBid(order: Order): { executedQty: number; fills: Fill[] } {
    let executedQty: number = order.filled
    this.asks.sort((a, b) => a.price - b.price);

    const fills: Fill[] = [];
    for (let i = 0; i < this.asks.length; i++) {
      if (executedQty < order.quantity && this.asks[i].price <= order.price) {
        this.currentPrice = this.asks[i].price; // updating the currentPrice
        const filledQty = Math.min(order.quantity - executedQty, (this.asks[i].quantity - this.asks[i].filled));
        executedQty += filledQty;
        this.asks[i].filled += filledQty;
        fills.push({
          price: this.asks[i].price.toString(),
          qty: filledQty,
          tradeId: this.lastTradeId++,
          otherUserId: this.asks[i].userId,
          markerOrderId: this.asks[i].orderId,
        });
      }
    }
    for (let i = 0; i < this.asks.length; i++) {
      if (this.asks[i].quantity == this.asks[i].filled) {
        this.asks.splice(i, 1);
        i--;
      }
    }
    return {
      executedQty,
      fills,
    };
  }

  matchAsk(order: Order): { executedQty: number; fills: Fill[] } {
    let executedQty: number = order.filled;
    this.bids.sort((a, b) => a.price - b.price).reverse();

    const fills: Fill[] = [];
    for (let i = 0; i < this.bids.length; i++) {
      if (executedQty < order.quantity && order.price <= this.bids[i].price) {
        this.currentPrice = this.bids[i].price; // updating the currentPrice
        const filledQty = Math.min(order.quantity - executedQty, (this.bids[i].quantity - this.bids[i].filled));
        executedQty += filledQty;
        this.bids[i].filled += filledQty;
        fills.push({
          price: this.bids[i].price.toString(),
          qty: filledQty,
          tradeId: this.lastTradeId++,
          otherUserId: this.bids[i].userId,
          markerOrderId: this.bids[i].orderId,
        });
        // console.log(fills);
      }
    }
    for (let i = 0; i < this.bids.length; i++) {
      if (this.bids[i].quantity == this.bids[i].filled) {
        this.bids.splice(i, 1);
        i--;
      }
    }
    return {
      executedQty,
      fills,
    };
  }

  getDepth() {
    const asks: [string, string][] = [];
    const bids: [string, string][] = [];

    const asksObj: { [key: string]: number } = {};
    const bidsObj: { [key: string]: number } = {};

    for (let i = 0; i < this.asks.length; i++) {
      const order = this.asks[i];
      if (!asksObj[order.price]) {
        asksObj[order.price] = 0;
      }
      const remainingQty = Math.max(0, order.quantity - order.filled);
      asksObj[order.price] += remainingQty;
    }

    for (let i = 0; i < this.bids.length; i++) {
      const order = this.bids[i];
      if (!bidsObj[order.price]) {
        bidsObj[order.price] = 0;
      }
      const remainingQty = Math.max(0, order.quantity - order.filled); // return 0 if calculation gives -ve value
      bidsObj[order.price] += remainingQty;
    }

    for (const price in bidsObj) {
      bids.push([price, bidsObj[price].toString()]);
    }

    for (const price in asksObj) {
      asks.push([price, asksObj[price].toString()]);
    }
        
    return {
      asks,
      bids,
    };
  }

  getOpenOrders(userId: string) {
    const openAsks = this.asks.filter((x) => x.userId == userId);
    const openBids = this.bids.filter((x) => x.userId == userId);

    return [...openAsks, ...openBids];
  }

  cancelBids(order: Order) {
    const index = this.bids.findIndex((x) => x.orderId === order.orderId);
    if (index != -1) {
      const price = this.bids[index].price;
      this.bids.splice(index, 1);
      return price;
    }
  }

  cancelAsks(order: Order) {
    const index = this.asks.findIndex((x) => x.userId == order.userId);
    if (index != -1) {
      const price = this.asks[index].price;
      this.asks.splice(index, 1);
      return price;
    }
  }
}
