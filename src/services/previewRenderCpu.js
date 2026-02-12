// src/services/previewRenderCpu.js
import fs from "fs";
import path from "path";
import PImage from "pureimage";
import { parseStlToTriangles } from "./stlGeometry.js";

/**
 * CPU-only isometric preview renderer (Railway-safe)
 * - No WebGL (no gl/three)
 * - Produces a PNG suitable for embedding into PDFKit
 *
 * Returns:
 *  { outputPngPath, trianglesRendered }
 */
export async function renderPreviewPngCpu({
                                              stlPath,
                                              outputPngPath,
                                              width = 900,
                                              height = 600,
                                          }) {
    // ---- Guardrails (these prevent the "path must be string" crash) ----
    if (typeof stlPath !== "string" || !stlPath.trim()) {
        throw new Error(`renderPreviewPngCpu: invalid stlPath: ${String(stlPath)}`);
    }
    if (typeof outputPngPath !== "string" || !outputPngPath.trim()) {
        throw new Error(
            `renderPreviewPngCpu: invalid outputPngPath: ${String(outputPngPath)}`
        );
    }
    if (!Number.isFinite(width) || width < 50) width = 900;
    if (!Number.isFinite(height) || height < 50) height = 600;

    // ---- Parse geometry ----
    const { triangles, bbox } = parseStlToTriangles(stlPath);

    if (!bbox || !bbox.min || !bbox.max || !bbox.size) {
        throw new Error("Cannot render preview: missing/invalid bbox from STL parse.");
    }
    if (!triangles || triangles.length < 9) {
        throw new Error("Cannot render preview: empty geometry (no triangles).");
    }

    // Cap triangles for performance: triangles is Float32Array of 9 floats per tri
    const MAX_TRIANGLES = Number(process.env.PREVIEW_MAX_TRIANGLES || 60000);
    const maxFloats = Math.max(1, MAX_TRIANGLES) * 9;

    const triData =
        triangles.length > maxFloats ? triangles.subarray(0, maxFloats) : triangles;

    const trianglesRendered = Math.floor(triData.length / 9);

    // ---- Prepare canvas ----
    const img = PImage.make(width, height);
    const ctx = img.getContext("2d");

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Palette (subtle “credible report” look)
    const stroke = "#0f172a";
    const fillLight = "#e6f2ff";
    const fillMid = "#4ea1ff";
    const fillDark = "#0f5bd8";

    // Center + normalize model coordinates
    const centerX = (bbox.min.x + bbox.max.x) / 2;
    const centerY = (bbox.min.y + bbox.max.y) / 2;
    const centerZ = (bbox.min.z + bbox.max.z) / 2;

    const sizeX = bbox.size.x || 1;
    const sizeY = bbox.size.y || 1;
    const sizeZ = bbox.size.z || 1;
    const maxDim = Math.max(sizeX, sizeY, sizeZ) || 1;

    // Scale to fit image with padding
    const padding = 70;
    const scale = (Math.min(width, height) - padding * 2) / maxDim;

    // Isometric projection (fixed angles)
    const deg = (d) => (d * Math.PI) / 180;
    const rotY = deg(35);
    const rotX = deg(25);

    function project(x, y, z) {
        // Center + scale
        x = (x - centerX) * scale;
        y = (y - centerY) * scale;
        z = (z - centerZ) * scale;

        // Rotate Y
        const x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
        const z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);

        // Rotate X
        const y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
        const z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);

        // Screen
        const sx = width / 2 + x1;
        const sy = height / 2 - y2;

        return { sx, sy, depth: z2 };
    }

    // Build triangles list with depth sorting (Painter’s algorithm)
    const tris = [];
    for (let i = 0; i < triData.length; i += 9) {
        const ax = triData[i],
            ay = triData[i + 1],
            az = triData[i + 2];
        const bx = triData[i + 3],
            by = triData[i + 4],
            bz = triData[i + 5];
        const cx = triData[i + 6],
            cy = triData[i + 7],
            cz = triData[i + 8];

        if (![ax, ay, az, bx, by, bz, cx, cy, cz].every(Number.isFinite)) continue;

        const pa = project(ax, ay, az);
        const pb = project(bx, by, bz);
        const pc = project(cx, cy, cz);

        const n = faceNormal(ax, ay, az, bx, by, bz, cx, cy, cz);

        // Light dir (normalized-ish)
        const lx = 0.5,
            ly = 0.8,
            lz = 0.4;
        const denom = len3(n.x, n.y, n.z) * len3(lx, ly, lz);
        const dot = denom ? (n.x * lx + n.y * ly + n.z * lz) / denom : 0;
        const intensity = clamp01(dot);

        const color =
            intensity > 0.66 ? fillLight : intensity > 0.33 ? fillMid : fillDark;

        const depth = (pa.depth + pb.depth + pc.depth) / 3;
        tris.push({ pa, pb, pc, depth, color });
    }

    // Back-to-front
    tris.sort((a, b) => a.depth - b.depth);

    // Fill faces
    for (const t of tris) {
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.moveTo(t.pa.sx, t.pa.sy);
        ctx.lineTo(t.pb.sx, t.pb.sy);
        ctx.lineTo(t.pc.sx, t.pc.sy);
        ctx.closePath();
        ctx.fill();
    }



    // Ensure output dir exists
    await fs.promises.mkdir(path.dirname(outputPngPath), { recursive: true });

    // Write PNG
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(outputPngPath);
        out.on("finish", resolve);
        out.on("error", reject);
        PImage.encodePNGToStream(img, out).catch(reject);
    });

    return { outputPngPath, trianglesRendered };
}

function faceNormal(ax, ay, az, bx, by, bz, cx, cy, cz) {
    const ux = bx - ax,
        uy = by - ay,
        uz = bz - az;
    const vx = cx - ax,
        vy = cy - ay,
        vz = cz - az;
    return {
        x: uy * vz - uz * vy,
        y: uz * vx - ux * vz,
        z: ux * vy - uy * vx,
    };
}

function len3(x, y, z) {
    return Math.sqrt(x * x + y * y + z * z) || 1;
}

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}
