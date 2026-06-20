import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

const envFiles = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "config", ".env"),
  path.resolve(process.cwd(), "src", "config", ".env"),
];

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false, quiet: true });
  }
}

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return value;
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    API_BASE_URL: z.string().min(1).default("http://localhost:3000"),
    FRONTEND_URL: z.string().min(1).default("http://localhost:3000"),
    MONGODB_DB_NAME: z.string().min(1).default("mock_data_manager"),
    MONGODB_CONNECT_MAX_RETRIES: z.coerce.number().int().min(1).default(5),
    MONGODB_CONNECT_RETRY_DELAY_MS: z.coerce.number().int().min(100).default(1000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    LOG_PRETTY: z.preprocess(toBoolean, z.coerce.boolean()).default(false),
    DATABASE_URL: z.string().min(1).optional(),
    TESTING_NEON_DB: z.string().min(1).optional(),
    TESTING_NEON_VECTOR_DB: z.string().min(1).optional(),
    REPL_ID: z.string().min(1).optional(),
    SESSION_SECRET: z.string().min(16).default("change-me-in-production-32chars!!"),
    ISSUER_URL: z.string().url().optional(),
    ACCOUNT_ACTIVATION_NOTIFY_EMAIL: z.string().email().optional(),
    MAIL_SMTP_HOST: z.string().min(1).optional(),
    MAIL_SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    MAIL_SMTP_USER: z.string().min(1).optional(),
    MAIL_SMTP_PASS: z.string().min(1).optional(),
    MAIL_FROM: z.string().email().optional(),
    CONNECTOR_ENCRYPTION_SECRET: z.string().min(16).optional(),
    SHOPIFY_WEBHOOK_SECRET: z.string().min(1).optional(),
    SHOPIFY_APP_CLIENT_ID: z.string().min(1).optional(),
    SHOPIFY_APP_CLIENT_SECRET: z.string().min(1).optional(),
    SHOPIFY_OAUTH_STATE_SECRET: z.string().min(16).optional(),
    SHOPIFY_OAUTH_SCOPES: z.string().min(1).default(
      "read_products,read_inventory,read_customers",
    ),
    SHOPIFY_OAUTH_STATE_TTL_MS: z.coerce.number().int().min(60_000).default(600_000),
    META_WEBHOOK_SECRET: z.string().min(1).optional(),
    WHATSAPP_WEBHOOK_SECRET: z.string().min(1).optional(),
    SHOPIFY_SYNC_WORKER_POLL_MS: z.coerce.number().int().min(1000).default(5_000),
    SHOPIFY_SYNC_RECONCILIATION_MS: z.coerce.number().int().min(60_000).default(86_400_000),
    SHOPIFY_SYNC_BATCH_SIZE: z.coerce.number().int().min(10).max(250).default(50),
    SHOPIFY_IMAGE_ENRICHMENT_MAX_IMAGES: z.coerce.number().int().min(1).max(20).default(4),
    SHOPIFY_IMAGE_ENRICHMENT_POLL_MS: z.coerce.number().int().min(500).default(5_000),
    OUTBOX_WORKER_POLL_MS: z.coerce.number().int().min(100).default(1000),
    OUTBOX_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(25),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_VISION_MODEL: z.string().min(1).default("gpt-4o-mini"),
    OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
    OPENAI_EMBEDDING_BASE_URL: z.string().url().default("https://api.openai.com/v1/embeddings"),
    AI_EMBEDDING_DIM: z.coerce.number().int().min(64).max(4096).default(256),
    AI_CHUNK_SIZE: z.coerce.number().int().min(200).max(8000).default(1000),
    AI_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(2000).default(150),
    AI_RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(50).default(5),
    AI_IMAGE_MATCH_TOP_K: z.coerce.number().int().min(1).max(50).default(5),
    AI_IMAGE_MATCH_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.22),
  })
  .superRefine((data, ctx) => {
    const hasReplId = Boolean(data.REPL_ID);
    const hasSessionSecret = Boolean(data.SESSION_SECRET);
    const smtpFields = [
      Boolean(data.MAIL_SMTP_HOST),
      Boolean(data.MAIL_SMTP_PORT),
      Boolean(data.MAIL_SMTP_USER),
      Boolean(data.MAIL_SMTP_PASS),
    ];
    const hasSomeSmtpConfig = smtpFields.some(Boolean);
    const hasCompleteSmtpConfig = smtpFields.every(Boolean);

    // REPL_ID check relaxed — SESSION_SECRET now always has a value
    if (hasReplId && !data.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required when Replit auth is enabled.",
      });
    }

    if (hasSomeSmtpConfig && !hasCompleteSmtpConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MAIL_SMTP_HOST"],
        message: "MAIL_SMTP_HOST, MAIL_SMTP_PORT, MAIL_SMTP_USER, and MAIL_SMTP_PASS must be provided together.",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function createEnv(raw: NodeJS.ProcessEnv): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration. ${details}`);
  }

  return parsed.data;
}

export const env = createEnv(process.env);

// Warn loudly if using the default dev secret in production
if (
  env.NODE_ENV === "production" &&
  env.SESSION_SECRET === "change-me-in-production-32chars!!"
) {
  console.warn(
    "[SECURITY] SESSION_SECRET is using the insecure default value. " +
    "Set SESSION_SECRET in your environment variables immediately."
  );
}
