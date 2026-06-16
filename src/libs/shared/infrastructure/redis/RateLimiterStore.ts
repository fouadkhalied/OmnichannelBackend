import { RedisClient } from "./RedisClient";

export class RateLimiterStore {
    private redis = RedisClient.getInstance();

    async increment(key: string, ttlSeconds: number): Promise<number> {
        const count = await this.redis.incr(key);
        if (count === 1) {
            await this.redis.expire(key, ttlSeconds);
        }
        return count;
    }

    async getCount(key: string): Promise<number> {
        const val = await this.redis.get(key);
        return val ? Number(val) : 0;
    }
}
