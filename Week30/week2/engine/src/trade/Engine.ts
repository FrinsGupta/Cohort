import { CREATE_ORDER, MessageFromApi } from "../types/fromApi";
import { Orderbook, Fill, Order } from "./Orderbook";
import { RedisManager } from "../RedisManager";
import { TRADE_ADDED, ORDER_UPDATE } from "../types";

export const BASE_CURRENCY = "INR";
interface UserBalance {
  [key: string]: {
    available: number;
    locked: number;
  };
}
export class Engine {
  private orderbooks: Orderbook[] = [];
  private balances: Map<string, UserBalance> = new Map();
  public process({ message, clientId }: { message: MessageFromApi; clientId: string }) {
    switch (message.type) {
      case CREATE_ORDER:
        try {
        } catch (error) {}
        break;
    }
  }

  public createOrder(price: string, qty: number, market: string, side: "buy" | "sell", userId: string) {}

  checkAndLockFund(
    baseAsset: string,
    quoteAsset: string,
    userId: string,
    price: string,
    quantity: string,
    side: "buy" | "sell"
  ) {
    if (side == "buy") {
      if ((this.balances.get(userId)?.[quoteAsset]?.available || 0) <= Number(price) * Number(quantity)) {
        throw new Error("Insufficient funds");
      }
      //@ts-ignore
      this.balances.get(userId)?.[quoteAsset].available -= Number(price) * Number(quantity);
      //@ts-ignore
      this.balances.get(userId)?.[quoteAsset].locked += Number(price) * Number(quantity);
    } else {
      if ((this.balances.get(userId)?.[baseAsset]?.available || 0) >= Number(quantity)) {
        throw new Error("Insufficient funds");
      }
      //@ts-ignore
      this.balances.get(userId)?.[baseAsset]?.available -= Number(quantity);
      //@ts-ignore
      this.balances.get(userId)?.[baseAsset]?.locked += Number(quantity);
    }
  }

  updateBalance(baseAsset: string, quoteAsset: string, userId: string, side: "buy" | "sell", fills: Fill[]) {
    if (side === "buy") {
      fills.forEach((fill) => {
        // Updating quoteAsset
        this.balances.get(userId)?.[quoteAsset]?.locked -= Number(fill.price) * Number(fill.qty);
        this.balances.get(fill.otherUserId)?.[quoteAsset]?.available += Number(fill.price) * Number(fill.qty);

        // Updating baseAsset
        this.balances.get(userId)?.[baseAsset]?.available += Number(fill.qty);
        this.balances.get(fill.otherUserId)?.[baseAsset]?.locked -= Number(fill.qty);
      });
    } else {
      fills.forEach((fill) => {
        // Updaing quoteAsset
        this.balances.get(userId)?.[quoteAsset]?.available += Number(fill.price);
        this.balances.get(fill.otherUserId)?.[quoteAsset]?.locked -= Number(fill.price);

        //Updating baseAsset
        this.balances.get(userId)?.[baseAsset]?.locked -= Number(fill.qty);
        this.balances.get(fill.otherUserId)?.[baseAsset]?.available += Number(fill.qty);
      });
    }
  }

  updateDbOrders(order: Order, executedQty: number, fills: Fill[], market: string) {
    RedisManager.getInstance().pushMessage({
      type: ORDER_UPDATE,
      data: {
        orderId: order.orderId,
        executedQty: executedQty,
        market: market,
        price: order.price.toString(),
        quantity: order.quantity.toString(),
        side: order.side,
      },
    });

    fills.forEach((fill) => {
      RedisManager.getInstance().pushMessage({
        type: ORDER_UPDATE,
        data: {
          orderId: fill.markerOrderId,
          executedQty: fill.qty,
        },
      });
    });
  }

  createDbTrades(fills: Fill[], market: string, userId: string) {
    // storing each trades(fills) into db
    fills.forEach((fill) => {
      RedisManager.getInstance().pushMessage({
        type: TRADE_ADDED,
        data: {
          market: market,
          id: fill.tradeId.toString(),
          isBuyerMaker: fill.otherUserId === userId, // TODO: Is this right?
          price: fill.price,
          quantity: fill.qty.toString(),
          quoteQuantity: (fill.qty * Number(fill.price)).toString(),
          timestamp: Date.now(),
        },
      });
    });
  }

  updatedDepthOnOrderCancel(price: string, market: string) {
    const orderbook = this.orderbooks.find((o) => o.ticker() === market);

    if (!orderbook) {
      return;
    }

    const depth = orderbook.getDepth();

    const updatedAsks = depth?.asks.filter((x) => x[0] === price);
    const updatedBids = depth?.bids.filter((x) => x[0] === price);

    RedisManager.getInstance().publishMessage(`depth@${market}`, {
      stream: `depth@${market}`,
      data: {
        a: updatedAsks.length ? updatedAsks : [[price, "0"]],
        b: updatedBids.length ? updatedBids : [[price, "0"]],
        e: "depth",
      },
    });
  }

  publishWsTrades(fills: Fill[], userId: string, market: string) {
    fills.forEach((fill) => {
      RedisManager.getInstance().publishMessage(`trade@${market}`, {
        stream: `trade@${market}`,
        data: {
          e: "trade",
          t: fill.tradeId,
          m: fill.otherUserId === userId, // TODO: Is this right?
          p: fill.price,
          q: fill.qty.toString(),
          s: market,
        },
      });
    });
  }
  publishWsDepthUpdates(fills: Fill[], price: string, side: "buy" | "sell", market: string) {
    const orderbook = this.orderbooks.find((o) => o.ticker() === market);

    if (!orderbook) {
      return;
    }

    const FillsPriceArray = fills.map((fill) => fill.price);

    if (side === "buy") {
      const updatedAsks = orderbook.getDepth().asks.filter((x) => FillsPriceArray.includes(x[0].toString()));
      const updatedBids = orderbook.getDepth().bids.find((x) => x[0] === price);

      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          a: updatedAsks,
          b: updatedBids ? [updatedBids] : [],
          e: "depth",
        },
      });
    } else {
      const updatedBids = orderbook.getDepth().bids.filter((x) => FillsPriceArray.includes(x[0].toString()));
      const updatedAsks = orderbook.getDepth().asks.find((x) => x[0] === price);

      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {},
      });
    }
  }
}
