import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { verifyShopifyProxy } from "../middleware/verifyShopifyProxy.js";
import { proxyRateLimit } from "../middleware/rateLimit.js";
import { isValidEmail, mbToBytes } from "../utils/validators.js";

import { createJobStore } from "../services/jobStore.js";
import { createLocalStorage } from "../services/storageLocal.js";
import { analyzeStl } from "../services/stlReport.js";
import { generatePdfReport } from "../services/pdfService.js";
import { renderPreviewPng } from "../services/previewRender.js";

const router = express.Router();

const maxMb = Number(process.env.MAX_FILE_MB || 30);
const jobTtl = Number(process.env.JOB_TTL_MINUTES || 30);

const jobStore = createJobStore({ ttlMinutes: jobTtl });
const storage = createLocalStorage({ baseDir: "./runtime" });

/**
 * IMPORTANT:
 * - Shopify App Proxy hits this server under /proxy/*
 * - Storefront public URLs are /apps/<proxy-subpath>/*
 * - Your server only needs to know /proxy/*
 */

// -------------------------
// Public / unverified routes
// -------------------------
router.get("/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

// Friendly route so visiting /apps/stl-pdf/jobs doesn't show "Cannot GET ..."
router.get("/jobs", (req, res) => {
    res.json({
        ok: true,
        message: "Use POST /proxy/jobs with multipart/form-data (fields: email, stl).",
    });
});

// -------------------------
// Security middleware
// (applies to everything below)
// -------------------------
router.use(proxyRateLimit);
router.use(verifyShopifyProxy);

// -------------------------
// Multer upload config
// -------------------------
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, storage.uploadsDir),
        filename: (req, file, cb) => {
            const safe = `${Date.now()}-${file.originalname}`.replace(/[^a-zA-Z0-9._-]/g, "_");
            cb(null, safe);
        },
    }),
    limits: { fileSize: mbToBytes(maxMb) },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith(".stl")) {
            return cb(new Error("Only STL files are allowed"));
        }
        cb(null, true);
    },
});

// -------------------------
// Create job + generate PDF
// -------------------------
router.post("/jobs", upload.single("stl"), async (req, res) => {
    let uploadedStlPath = null;

    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        if (!isValidEmail(email)) {
            if (req.file?.path) storage.safeUnlink(req.file.path);
            return res.status(400).json({ error: "Please enter a valid email address." });
        }

        if (!req.file?.path) {
            return res.status(400).json({ error: "Please attach an STL file." });
        }

        uploadedStlPath = req.file.path;
        const shop = req.shopifyContext?.shop || null;

        const job = jobStore.create({
            shop,
            email,
            originalFileName: req.file.originalname,
        });

        jobStore.update(job.id, { status: "processing" });

        // 1) STL analysis
        console.log("Starting STL analysis...");
        const metrics = analyzeStl(uploadedStlPath);
        console.log("STL analysis complete.");

        // 2) Preview render (optional, do not fail the job if preview fails)
        let previewPngPath = null;
        try {
            // Ensure previews dir exists
            const previewsDir = path.join(storage.baseDir, "previews");
            fs.mkdirSync(previewsDir, { recursive: true });

            previewPngPath = path.join(previewsDir, `${job.id}.png`);

            await renderPreviewPng({
                stlPath: uploadedStlPath,
                outputPngPath: previewPngPath,
                width: 900,
                height: 600,
            });

            // If renderer didn't actually write a file for some reason, treat as missing
            if (!fs.existsSync(previewPngPath)) previewPngPath = null;

            console.log("Preview generated.");
        } catch (previewErr) {
            console.warn("Preview render failed (continuing without preview):", previewErr?.message || previewErr);
            previewPngPath = null;
        }

        // 3) PDF generation
        const pdfFileName = `${job.id}.pdf`;
        const outPath = storage.pdfPath(pdfFileName);

        await generatePdfReport({
            outputPath: outPath,
            email,
            originalFileName: req.file.originalname,
            reportUrl: "https://the3doodler.com/pages/stl-to-pdf-tool",
            metrics,
            previewPngPath, // null is fine
        });

        // Clean up STL upload after processing
        storage.safeUnlink(uploadedStlPath);
        uploadedStlPath = null;

        jobStore.update(job.id, {
            status: "ready",
            pdfPath: outPath,
            metrics,
        });

        return res.json({
            jobId: job.id,
            status: "ready",
            downloadProxyPath: `/proxy/jobs/${job.id}/download`,
        });
    } catch (err) {
        console.error("JOBS ROUTE ERROR:", err);

        // best-effort cleanup
        if (uploadedStlPath) storage.safeUnlink(uploadedStlPath);

        return res.status(500).json({
            error: err?.message || "Failed to generate report.",
        });
    }
});

// -------------------------
// Job status
// -------------------------
router.get("/jobs/:id", (req, res) => {
    const job = jobStore.get(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found or expired." });

    return res.json({
        id: job.id,
        status: job.status,
        email: job.email,
        originalFileName: job.originalFileName,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        error: job.error || null,
    });
});

// -------------------------
// Download PDF
// -------------------------
router.get("/jobs/:id/download", (req, res) => {
    const job = jobStore.get(req.params.id);
    if (!job || job.status !== "ready" || !job.pdfPath) {
        return res.status(404).json({ error: "PDF not available (job missing/expired)." });
    }

    return res.download(job.pdfPath, `stl-report-${job.id}.pdf`);
});

export default router;
