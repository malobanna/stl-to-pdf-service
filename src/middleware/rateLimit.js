import rateLimit from "express-rate-limit";

export const proxyRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 30, // 30 requests per minute per IP
    standardHeaders: "draft-7",
    legacyHeaders: false
});
