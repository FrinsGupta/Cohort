import { RedisManager } from "./RedisManager";
import { createClient } from "redis";
import { Engine } from "./trade/Engine";

async function main() {
  const engine = new Engine();
  const redisClient = createClient();
  redisClient.connect();
  while (true) {
    const response = await redisClient.rPop("messages" as string);
    if (!response) {
    } else {
      engine.process(JSON.parse(response));
    }
  }
}

main();
