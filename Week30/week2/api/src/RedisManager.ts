import {createClient, RedisClientType} from 'redis'

export class RedisManager {
    private static instance: RedisManager
    private client: RedisClientType
    private publisher: RedisClientType

    private constructor (){
        this.client = createClient()
        this.client.connect();
        this.publisher = createClient();
        this.publisher.connect();
    }

    public static getInstance(){
        if (!this.instance) {
            this.instance = new RedisManager();
        }
        return this.instance;
    }

    public sendAndAwait(message: string){
        return new Promise<T>(resolve) =>{
            const id = Math.random();
            this.client.subscribe(id, (message)=>{
                this.client.unsubscribe(id)
                const msg = JSON.parse(message)
                resolve(msg)
            })
            this.publisher.lPush({indexOf,message})
        }
    }
}