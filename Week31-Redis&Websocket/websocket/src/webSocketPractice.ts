import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

wss.on("listening", () => {
  console.log("WebSocket server is running on ws://localhost:8080");
});

wss.on("connection", (ws) => {
  console.log("Websocket connection established");
  ws.send("Websocket connection established");
  ws.on("message", (message) => {
    ws.send("Message received on websocket" + message);
  });
});
