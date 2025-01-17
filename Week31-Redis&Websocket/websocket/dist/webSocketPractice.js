"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const redis_1 = require("redis");
const wss = new ws_1.WebSocketServer({ port: 9090 });
const redisClient = (0, redis_1.createClient)();
redisClient.connect();
const publishClient = (0, redis_1.createClient)();
publishClient.connect();
wss.on("listening", () => {
  console.log("WebSocket server is running on ws://localhost:8080");
});
const users = {};
wss.on("connection", (ws) => {
  const id = Math.random();
  users[id] = {
    ws: ws,
    rooms: [],
  };
  console.log("Websocket connection established");
  ws.send("Websocket connection established");
  ws.on("message", (message) => {
    const parsedMessage = JSON.parse(message);
    ws.send("Message received on websocket" + message);
    console.log(parsedMessage);
    const roomId =
      parsedMessage === null || parsedMessage === void 0
        ? void 0
        : parsedMessage.roomId;
    if (parsedMessage.type === "SUBSCRIBE") {
      users[id].rooms.push(roomId);
      console.log(users[id]);
      if (oneUserSucbscribedTo(roomId)) {
        redisClient.subscribe(roomId, (message) => {
          Object.keys(users).forEach((userId) => {
            const { ws, rooms } = users[userId];
            if (rooms.includes(roomId)) {
              ws.send(message);
            }
          });
        });
      }
    }
    if (parsedMessage.type === "UNSUBSCRIBE") {
      const index = users[id].rooms.indexOf(roomId);
      users[id].rooms.splice(index, 1);
      console.log(users[id]);
      if (lastPersonToUnsubscribe(roomId)) {
        redisClient.unsubscribe(roomId);
      }
    }
    if (parsedMessage.type === "sendMessage") {
      const strMessage = JSON.stringify(parsedMessage);
      publishClient.publish(roomId, strMessage);
    }
  });
});
const oneUserSucbscribedTo = (roomId) => {
  let totalUsers = 0;
  Object.keys(users).forEach((id) => {
    if (users[id].rooms.includes(roomId)) {
      totalUsers++;
    }
  });
  if (totalUsers === 1) {
    return true;
  }
  return false;
};
const lastPersonToUnsubscribe = (roomId) => {
  let totalUsers = 0;
  Object.keys(users).forEach((id) => {
    if (users[id].rooms.includes(roomId)) {
      totalUsers++;
    }
  });
  if (totalUsers === 0) {
    return true;
  }
  return false;
};
