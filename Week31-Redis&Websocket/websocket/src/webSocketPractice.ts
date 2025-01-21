import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "redis";

const wss = new WebSocketServer({ port: 8080 });
const redisClient = createClient();
redisClient.connect();
const publishClient = createClient();
publishClient.connect();

wss.on("listening", () => {
  console.log("WebSocket server is running on ws://localhost:8080");
});

const users: { [key: string]: { ws: WebSocket; rooms: string[] } } = {};

wss.on("connection", (ws) => {
  // ws: Represents the current WebSocket connection between the server and a single client.
  const id = Math.random();
  users[id] = {
    ws: ws,
    rooms: [],
  };

  console.log("Websocket connection established");
  ws.send("Websocket connection established");

  ws.on("message", (message) => {
    const parsedMessage = JSON.parse(message as unknown as string);
    ws.send("Message received on websocket" + message);
    console.log(parsedMessage);

    const roomId = parsedMessage?.roomId;

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

const oneUserSucbscribedTo = (roomId: string) => {
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

const lastPersonToUnsubscribe = (roomId: string) => {
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
