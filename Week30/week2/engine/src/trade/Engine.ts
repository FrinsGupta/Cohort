import { CREATE_ORDER, MessageFromApi, CANCEL_ORDER, GET_OPEN_ORDERS, GET_DEPTH } from "../types/fromApi";
import { Orderbook, Fill, Order } from "./Orderbook";
import { RedisManager } from "../RedisManager";
import { TRADE_ADDED, ORDER_UPDATE } from "../types";
import fs from "fs";

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

  constructor() {
    let snapshot = null;
    try {
      if (process.env.WITH_SNAPSHOT) {
        snapshot = fs.readFileSync("./snapshot.json");
      }
    } catch (e) {
      console.log("No snapshot found");
    }

    if (snapshot) {
      const snapshotSnapshot = JSON.parse(snapshot.toString());
      this.orderbooks = snapshotSnapshot.orderbooks.map((o: Orderbook) => {
        return new Orderbook(o.baseAsset, o.bids, o.asks, o.lastTradeId, o.currentPrice);
      });
      this.balances = new Map(snapshotSnapshot.balances);
    } else {
      this.orderbooks = [new Orderbook(`BTC`, [], [], 0, 0)];
    }
  }
  public process({ message, clientId }: { message: MessageFromApi; clientId: string }) {
    switch (message.type) {
      case CREATE_ORDER:
        try {
          const { executedQty, fills, orderId } = this.createOrder(
            message.data.market,
            message.data.price,
            message.data.quantity,
            message.data.side,
            message.data.userId
          );
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_PLACED",
            payload: {
              orderId,
              executedQty,
              fills,
            },
          });
        } catch (error) {
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: "",
              executedQty: 0,
              remainingQty: 0,
            },
          });
        }
        break;

      case CANCEL_ORDER:
        try {
          const orderId: string = message.data.orderId;
          const market: string = message.data.market;

          this.cancelOrder(orderId, market);

          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: orderId,
              executedQty: 0,
              remainingQty: 0,
            },
          });
        } catch (e) {}
        break;

      case GET_OPEN_ORDERS:
        try {
          const orderbook = this.orderbooks.find((o) => o.ticker() === message.data.market);
          if (!orderbook) {
            throw new Error("No orderbook found");
          }
          const openOrders = orderbook.getOpenOrders(message.data.userId);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "OPEN_ORDERS",
            payload: openOrders,
          });
        } catch (error) {
          console.log(error);
        }
        break;

      case GET_DEPTH:
        try {
          const orderbook = this.orderbooks.find((o) => o.ticker() === message.data.market);
          if (!orderbook) {
            throw new Error("No orderbook found");
          }
          const { bids, asks } = orderbook.getDepth();

          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: {
              bids,
              asks,
            },
          });
        } catch (e) {
          console.log(e);
        }
    }
  }

  public createOrder(price: string, qty: string, market: string, side: "buy" | "sell", userId: string) {
    const orderbook = this.orderbooks.find((o) => o.ticker() === market);

    if (!orderbook) {
      throw new Error("No orderbook found");
    }
    const baseAsset = market.split("_")[0];
    const quoteAsset = market.split("_")[1];

    const order: Order = {
      price: Number(price),
      quantity: Number(qty),
      orderId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      filled: 0,
      side: side,
      userId: userId,
    };

    this.checkAndLockFund(baseAsset, quoteAsset, userId, price, qty, side);
    const { executedQty, fills } = orderbook.addOrder(order);
    this.createDbTrades(fills, market, userId);
    this.updateDbOrders(order, executedQty, fills, market);
    this.publishWsDepthUpdates(fills, price, side, market);
    this.publishWsTrades(fills, userId, market);
    return { executedQty, fills, orderId: order.orderId };
  }

  cancelOrder(orderId: string, market: string) {
    const orderbook = this.orderbooks.find((o) => o.ticker() === market);
    if (!orderbook) {
      throw new Error("Orderbook not found");
    }

    const order =
      orderbook.asks.find((x) => x.orderId === orderId) || orderbook.bids.find((x) => x.orderId === orderId);
    const baseAsset = market.split("_")[0];
    const quoteAsset = market.split("_")[1];

    if (!order) {
      console.log("No order found");
      throw new Error("No order Found");
    }
    if (order.side === "buy") {
      const price = orderbook.cancelBids(order);
      if (price) {
        //@ts-ignore
        this.balances.get(order.userId)?.[quoteAsset].available += price * (order.quantity - order.filled);
        //@ts-ignore
        this.balances.get(order.userId)?.[quoteAsset].locked -= price * (order.quantity - order.filled);
        this.updatedDepthOnOrderCancel(price.toString(), market);
      }
    } else {
      const price = orderbook.cancelAsks(order);
      if (price) {
        //@ts-ignore
        this.balances.get(order.userId)?.[baseAsset]?.available += order.quantity - order.filled;
        //@ts-ignore
        this.balances.get(order.userId)?.[baseAsset]?.locked -= order.quantity - order.filled;
        this.updatedDepthOnOrderCancel(price.toString(), market);
      }
    }
  }

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
        //@ts-ignore
        this.balances.get(userId)?.[quoteAsset]?.locked -= Number(fill.price) * Number(fill.qty);
        //@ts-ignore
        this.balances.get(fill.otherUserId)?.[quoteAsset]?.available += Number(fill.price) * Number(fill.qty);

        // Updating baseAsset
        //@ts-ignore
        this.balances.get(userId)?.[baseAsset]?.available += Number(fill.qty);
        //@ts-ignore
        this.balances.get(fill.otherUserId)?.[baseAsset]?.locked -= Number(fill.qty);
      });
    } else {
      fills.forEach((fill) => {
        // Updaing quoteAsset
        //@ts-ignore
        this.balances.get(userId)?.[quoteAsset]?.available += Number(fill.price);
        //@ts-ignore
        this.balances.get(fill.otherUserId)?.[quoteAsset]?.locked -= Number(fill.price);

        //Updating baseAsset
        //@ts-ignore
        this.balances.get(userId)?.[baseAsset]?.locked -= Number(fill.qty);
        //@ts-ignore
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
        data: {
          a: updatedAsks ? [updatedAsks] : [],
          b: updatedBids,
          e: "depth",
        },
      });
    }
  }
}
