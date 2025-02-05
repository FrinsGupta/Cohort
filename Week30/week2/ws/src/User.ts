import { WebSocket } from "ws";
import { IncomingMessage } from "./types/in";
import { SubscriptionManager } from "./SubscriptionManager";
import { OutgoingMessage } from "./types/out";
export class User {
  private static instance: User;
  private id: string;
  private ws: WebSocket;

  constructor(id: string, ws: WebSocket) {
    (this.id = id), (this.ws = ws), this.addListner();
  }

  //   public static getInstance(id: string, ws: WebSocket) {
  //     if (!this.instance) {
  //       this.instance = new User(id, ws);
  //     }
  //     return this.instance;
  //   }
 
  emit(message: OutgoingMessage) {
    this.ws.send(JSON.stringify(message));
  }

  private addListner() {
    this.ws.on("message", (message: string) => {
      const parsedMessage: IncomingMessage = JSON.parse(message);
      if (parsedMessage.method === "SUBSCRIBE") {
        parsedMessage.params.forEach((s) => {
          SubscriptionManager.getInstance().subscribe(this.id, s);
        });
      }
      if (parsedMessage.method === "UNSUBSCRIBE") {
        parsedMessage.params.forEach((s) => {
          SubscriptionManager.getInstance().unsubscribe(this.id, s);
        });
      }
    });
  }
}
