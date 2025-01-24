import { createClient, RedisClientType } from "redis";
import { MessageToApi } from "./types/toApi";
import { TRADE_ADDED, ORDER_UPDATE } from "./types";
import { WsMessage } from "./types/toWs";

type DbMessage =
  | {
      type: typeof TRADE_ADDED;
      data: {
        id: string;
        isBuyerMaker: boolean;
        price: string;
        quantity: string;
        quoteQuantity: string;
        timestamp: number;
        market: string;
      };
    }
  | {
      type: typeof ORDER_UPDATE;
      data: {
        orderId: string;
        executedQty: number;
        market?: string;
        price?: string;
        quantity?: string;
        side?: "buy" | "sell";
      };
    };

export class RedisManager {
  private static instance: RedisManager;
  private redisClient: RedisClientType;

  private constructor() {
    this.redisClient = createClient();
    this.redisClient.connect();
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }

  public pushMessage(message: DbMessage) {
    this.redisClient.lPush("db_processor", JSON.stringify(message));
  }
  public sendToApi(clientId: string, message: MessageToApi) {
    this.redisClient.publish(clientId, JSON.stringify(message));
  }

  public publishMessage(channel: string, message: WsMessage) {
    this.redisClient.publish(channel, JSON.stringify(message));
  }
}
