import { Router } from "express";
import shopifyRoutes from "../../../../../modules/shopify/presentation/http/routes/shopifyRoutes";
import authRoutes from "../../../../../modules/auth/presentation/http/routes/authRoutes";

const router = Router();

// Health Check
router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Module Routes
router.use("/shopify", shopifyRoutes);
router.use("/auth", authRoutes);

export default router;
