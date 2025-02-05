import { createClient, RedisClientType } from "redis";
import { UserManager } from "./UserManager";

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private redisClient: RedisClientType;
  private subscriptions: Map<string, string[]> = new Map();
  private reverseSubscriptions: Map<string, string[]> = new Map();

  private constructor() {
    this.redisClient = createClient();
    this.redisClient.connect();
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new SubscriptionManager();
    }
    return this.instance;
  }

  public subscribe(id: string, subscription: string) {
    if (this.subscriptions.get(id)?.includes(subscription)) {
      return;
    }
    this.subscriptions.set(
      id,
      (this.subscriptions.get(id) || []).concat(subscription)
    );
    this.reverseSubscriptions.set(
      subscription,
      (this.reverseSubscriptions.get(subscription) || []).concat(id)
    );
    if (this.reverseSubscriptions.get(subscription)?.length == 1) {
      this.redisClient.subscribe(subscription, this.redisCallbackHandler);
    }
  }

  private redisCallbackHandler = (message: string, channel: string) => {
    // Message broadCasting function
    const parsedMessage = JSON.parse(message);
    this.reverseSubscriptions.get(channel)?.forEach(
      (
        s // gets all the user interested in the specific roomId
      ) => UserManager.getInstance().getUser(s)?.emit(parsedMessage) // webSocket - sending message through user's ws if the user exists on webSocket connection
    );
  };

  public unsubscribe(id: string, subscription: string) {
    if (!this.subscriptions.get(id)?.includes(subscription)) {
      return;
    }

    const subscriptions = this.subscriptions.get(id);
    if (subscriptions) {
      this.subscriptions.set(
        id,
        subscriptions.filter((subs) => subs !== subscription)
      );
    }

    const reverseSubscriptions = this.reverseSubscriptions.get(subscription);
    if (reverseSubscriptions) {
      this.reverseSubscriptions.set(
        subscription,
        reverseSubscriptions.filter((s) => s !== id)
      );
    }
    if (this.reverseSubscriptions.get(subscription)?.length == 0) {
      this.reverseSubscriptions.delete(subscription);
      this.redisClient.unsubscribe(subscription);
    }
  }

  public userLeft(userId: string) {
    console.log("user left " + userId);
    this.subscriptions.get(userId)?.forEach((s) => this.unsubscribe(userId, s));
  }
}
