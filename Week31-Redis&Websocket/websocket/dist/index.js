"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const wss = new ws_1.WebSocketServer({ port: 9090 });
// Example - 1  (Simple WebServer Connetion)
// wss.on("connection", (ws) => {
//   console.log("Hi there");
//   ws.on("error",console.error);
//   ws.on("message", (message) => {
//     console.log("send " + message);
//     ws.send("received: "+ message)
//   });
//   ws.send("Websocket connection is established")
// });
// console.log("WebSocket server is running on ws://localhost:8080");
// Exmaple - 2 (One WebSocket with Manual PubSub)
// const subscripedUsers: {
//   [key: string]: {
//     ws: WebSocket;
//     rooms: string[];
//   };
// } = {};
// console.log(subscripedUsers);
// /*
//   Obj parsedMsg = {   example (of "sendMessage" type message) that a parsedMsg can be that user send on websocket
//        roomId: "",
//        type: "",
//        message: ""
//      }
//   Obj parsedMsg = {   example (of "SUBSCRIBE" type message) that a parsedMsg can be that user send on websocket
//        type: "",
//        interestedRoomId: ""
//      }
// */
// wss.on("connection", (ws) => {
//   const id = randomId()
//   subscripedUsers[id] = {  // Initialized Object here
//     ws: ws,
//     rooms: []
//   }
//   ws.on("message", (message) => {
//     const parsedMessage = JSON.parse(message as unknown as string)
//     if (parsedMessage.type === 'SUBSCRIBE') {
//         subscripedUsers[id].rooms.push(parsedMessage.interestedRoomId)
//     }
//     if (parsedMessage.type = 'sendMessage') {
//         const roomId = parsedMessage.roomId
//         const message = parsedMessage.message
//         Object.keys(subscripedUsers).forEach((userId) => {  // way to iterate over an object
//             const {ws, rooms} = subscripedUsers[userId]
//             if (rooms.includes(roomId)) {
//                 ws.send(message)  // this gets executed whenever someone send message
//             }
//         })
//     }
//   });
// });
// const randomId = () =>{
//     return Math.random();
// }
// Exmaple -3 (Redis)
const redis_1 = require("redis");
const publishClient = (0, redis_1.createClient)();
publishClient.connect();
const subscribeClient = (0, redis_1.createClient)();
subscribeClient.connect();
const subscripedUsers = {};
console.log(subscripedUsers);
/*
  Obj parsedMsg = {   example (of "sendMessage" type message) that a parsedMsg can be that user send on websocket
       roomId: "",
       type: "",
       message: ""
     }
  Obj parsedMsg = {   example (of "SUBSCRIBE" type message) that a parsedMsg can be that user send on websocket
       type: "",
       interestedRoomId: ""
     }
*/
wss.on("connection", (ws) => {
    const id = randomId();
    subscripedUsers[id] = {
        // Initialized Object here
        ws: ws,
        rooms: [],
    };
    ws.on("message", (message) => {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.type === "SUBSCRIBE") {
            subscripedUsers[id].rooms.push(parsedMessage.interestedRoomId); // One Added in rooms
            console.log(subscripedUsers[id]);
            if (oneUserSucbscribedTo(parsedMessage.interestedRoomId)) {
                // Checking if this is the first connection for this roomId
                console.log("Subscribing on the pub sub to room " + parsedMessage.interestedRoomId);
                subscribeClient.subscribe(parsedMessage.interestedRoomId, (msg) => {
                    // this callback gets executed whenever this roomId receives a message
                    const parsedMessage = JSON.parse(msg);
                    Object.keys(subscripedUsers).forEach((userId) => {
                        const { ws, rooms } = subscripedUsers[userId];
                        if (rooms.includes(parsedMessage.interestedRoomId)) {
                            ws.send(parsedMessage.message); // sending message on users specific websocket
                        }
                    });
                });
            }
        }
        if (parsedMessage.type === "UNSUBSCRIBE") {
            subscripedUsers[id].rooms = subscripedUsers[id].rooms.filter(
            // removing previously interested roomId from rooms
            (x) => x !== parsedMessage.interestedRoomId);
            console.log(subscripedUsers[id]);
            if (lastPersonLeftRoom(parsedMessage.interestedRoomId)) {
                // checking is this the last person to left the room
                console.log("Unsubscribing from the pub sub on room" +
                    parsedMessage.interestedRoomId);
                subscribeClient.unsubscribe(parsedMessage.interestedRoomId);
            }
        }
        if (parsedMessage.type === "sendMessage") {
            const roomId = parsedMessage.roomId;
            const message = parsedMessage.message;
            publishClient.publish(roomId, JSON.stringify({
                type: "sendMessage",
                roomId: roomId,
                message,
            }));
        }
    });
});
const oneUserSucbscribedTo = (roomId) => {
    // function to check was this the first person subscribe the room
    let totalInterestedPeople = 0;
    Object.keys(subscripedUsers).map((userId) => {
        // return array of all keys of subscriptedUsers object
        if (subscripedUsers[userId].rooms.includes(roomId)) {
            totalInterestedPeople++;
        }
    });
    if (totalInterestedPeople == 1) {
        return true;
    }
    return false;
};
function lastPersonLeftRoom(roomId) {
    let totalInterestedPeople = 0;
    Object.keys(subscripedUsers).map((userId) => {
        if (subscripedUsers[userId].rooms.includes(roomId)) {
            totalInterestedPeople++;
        }
    });
    if (totalInterestedPeople == 0) {
        return true;
    }
    return false;
}
const randomId = () => {
    return Math.random();
};
console.log("WebSocket server is running on ws://localhost:9090");
