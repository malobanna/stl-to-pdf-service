import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import proxyRoutes from "./src/routes/proxyRoutes.js";

dotenv.config();

const app = express();

// Required for Railway + express-rate-limit
app.set("trust proxy", 1);

// CORS (App Proxy usually doesn't need it, but safe)
app.use(cors({ origin: false }));

app.get('/', (req, res) => {
    res.json({ message: "Welcome to STL to PDF Converter!" });
})

// Health check (direct backend test)
app.get("/health", (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
});

// 🔥 Mount your proxy routes
app.use("/proxy", proxyRoutes);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
    console.log(`Server listening on :${port}`);
});
