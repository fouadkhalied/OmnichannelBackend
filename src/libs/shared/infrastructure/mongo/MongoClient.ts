import mongoose from "mongoose";
import { logger } from "server/common/logger";
import { env } from "src/config/env";

type MongoStatus = {
  ready: boolean;
  readyState: number;
  lastError: string | null;
};

let connectPromise: Promise<void> | null = null;
let lastError: string | null = null;
let listenersRegistered = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const registerMongoListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on("connected", () => {
    lastError = null;
    logger.info("mongo.connected", { host: mongoose.connection.host });
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("mongo.disconnected");
  });

  mongoose.connection.on("error", (error) => {
    lastError = error.message;
    logger.error("mongo.error", { error: error.message });
  });
};

export const isMongoReady = () => mongoose.connection.readyState === 1;

export const getMongoStatus = (): MongoStatus => ({
  ready: isMongoReady(),
  readyState: mongoose.connection.readyState,
  lastError,
});

export async function connectMongo() {
  console.log("Connecting to MongoDB...");
  console.log(`MongoDB URI: ${env.MONGODB_URI}`);
  registerMongoListeners();

  if (isMongoReady()) return;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    mongoose.set("strictQuery", true);

    let attempt = 0;
    const maxAttempts = env.MONGODB_CONNECT_MAX_RETRIES;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        logger.info("mongo.connect_attempt", { attempt, maxAttempts });
        await mongoose.connect(env.MONGODB_URI, {
          dbName: env.MONGODB_DB_NAME,
          serverSelectionTimeoutMS: 5000,
        });
        await ensureMongoIndexes();
        logger.info("mongo.connected_ready", {
          database: env.MONGODB_DB_NAME,
          attempt,
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = message;
        logger.error("mongo.connect_failed", { attempt, maxAttempts, error: message });

        if (attempt >= maxAttempts) {
          throw new Error(`Failed to connect to MongoDB after ${maxAttempts} attempts: ${message}`);
        }

        await sleep(env.MONGODB_CONNECT_RETRY_DELAY_MS);
      }
    }
  })();

  return connectPromise.finally(() => {
    connectPromise = null;
  });
}


export async function ensureMongoIndexes() {
  logger.info("mongo.ensure_indexes_started");
  // Individual models handle their own index creation through Mongoose automatically
  // but we can trigger it explicitly if needed for critical indexes.
  try {
    const models = mongoose.modelNames();
    await Promise.all(models.map(name => mongoose.model(name).ensureIndexes()));
    logger.info("mongo.ensure_indexes_completed", { count: models.length });
  } catch (error: any) {
    logger.error("mongo.ensure_indexes_failed", { error: error.message });
    // Don't throw here to allow app to start even if indexing has issues
  }
}
