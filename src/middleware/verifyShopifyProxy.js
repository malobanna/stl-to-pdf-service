import crypto from "crypto";

function timingSafeEqual(a, b) {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Shopify App Proxy verification:
 * - Shopify sends a "signature" query param.
 * - Signature is HMAC-SHA256 of sorted query params (excluding signature), concatenated as key=value pairs.
 */
export function verifyShopifyProxy(req, res, next) {
    const secret = process.env.SHOPIFY_API_SECRET;
    if (!secret) return res.status(500).json({ error: "Missing SHOPIFY_API_SECRET" });

    const allowedShop = process.env.ALLOWED_SHOP;
    const shop = req.query.shop;

    if (allowedShop && shop && shop !== allowedShop) {
        return res.status(403).json({ error: "Shop not allowed" });
    }

    const providedSignature = req.query.signature;
    if (!providedSignature) return res.status(401).json({ error: "Missing signature" });

    // Build message from query params excluding signature
    const params = { ...req.query };
    delete params.signature;

    const message = Object.keys(params)
        .sort()
        .map((k) => `${k}=${Array.isArray(params[k]) ? params[k].join(",") : params[k]}`)
        .join("");

    const calculated = crypto
        .createHmac("sha256", secret)
        .update(message)
        .digest("hex");

    if (!timingSafeEqual(calculated, providedSignature)) {
        return res.status(401).json({ error: "Invalid signature" });
    }

    // Attach for later use (SaaS/multi-tenant ready)
    req.shopifyContext = {
        shop: shop || null,
        customerId: req.query.customer_id || null
    };

    next();
}
