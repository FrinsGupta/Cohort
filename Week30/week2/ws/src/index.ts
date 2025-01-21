import { WebSocketServer } from "ws";
import { UserManager } from "./UserManager";

const port = 8080;

const wss = new WebSocketServer({ port: port });

wss.on("listening", () => {
  console.log(`WebSocket connection started at ws://localhost:${port}`);
});

wss.on("connection", (ws) => {
  UserManager.getInstance().addUser(ws);
});
