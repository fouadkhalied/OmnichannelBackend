export class RedisClient {
    private static instance: RedisClient;
    private client: any;

    private constructor() {
        this.client = new Map();
    }

    public static getInstance(): RedisClient {
        if (!RedisClient.instance) {
            RedisClient.instance = new RedisClient();
        }
        return RedisClient.instance;
    }

    async get(key: string): Promise<string | null> {
        return this.client.get(key) || null;
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        this.client.set(key, value);
    }

    async del(key: string): Promise<void> {
        this.client.delete(key);
    }

    async incr(key: string): Promise<number> {
        const val = Number(this.client.get(key) || 0) + 1;
        this.client.set(key, String(val));
        return val;
    }

    async expire(key: string, seconds: number): Promise<void> { }
}
