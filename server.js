import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import proxyRoutes from "./src/routes/proxyRoutes.js";

dotenv.config();

const app = express();

// App Proxy calls come from your own storefront domain, so CORS is usually irrelevant.
// Keep it strict if you ever call from elsewhere.
app.use(cors({ origin: false }));

// Health check
app.get("/health", (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
});

// All App Proxy traffic lands here
app.use("/proxy", proxyRoutes);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
    console.log(`Server listening on :${port}`);
});
