import { createClient, RedisClientType } from "redis";
import { MessageFromOrderbook } from "./types";
import { MessageToEngine } from "./types/to";

export class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType;
  private publisher: RedisClientType;

  private constructor() {
    this.client = createClient();
    this.client.connect();
    this.publisher = createClient();
    this.publisher.connect();
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }

  public sendAndAwait(message: MessageToEngine) {
    return new Promise<MessageFromOrderbook>((resolve) => {
      const id = this.getRandomClientId();
      this.client.subscribe(id, (message) => {
        // The Redis client subscribes to a channel identified by the id. The callback function is invoked whenever a message is published to this channel.
        this.client.unsubscribe(id); // unsubscribing on getting message from pub/sub
        resolve(JSON.parse(message)); // The message (in JSON format) is parsed and passed to the resolve function to fulfill the promise.
      });
      this.publisher.lPush(
        // The Redis publisher pushes a message onto the messages list in Redis using lPush (left-push).
        "messages",
        JSON.stringify({ clientId: id, message })
      );
    });
  }

  public getRandomClientId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
