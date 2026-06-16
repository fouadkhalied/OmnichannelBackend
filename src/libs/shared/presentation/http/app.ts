import express from "express";
import helmet from "helmet";
import cors from "cors";
import routes from "./routes/index";
import { logger } from "../../../common/logger";

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
    origin: true, // Reflect the requester's origin
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"]
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Routes
app.use("/api", routes);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: "Not Found" });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error("Unhandled Error", { error: err.message, stack: err.stack });
    res.status(err.status || 500).json({
        error: "Internal Server Error",
        message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});

export { app };
