import { RedisClient } from "./RedisClient";

export class IdempotencyStore {
    private redis = RedisClient.getInstance();

    async getResponse(key: string): Promise<any | null> {
        const data = await this.redis.get(`idempotency:${key}`);
        return data ? JSON.parse(data) : null;
    }

    async saveResponse(key: string, response: any, ttlSeconds: number = 86400): Promise<void> {
        await this.redis.set(`idempotency:${key}`, JSON.stringify(response), ttlSeconds);
    }
}
