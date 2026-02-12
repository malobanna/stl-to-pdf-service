import fs from "fs";
import path from "path";
import PImage from "pureimage";
import { parseStlToTriangles } from "./stlGeometry.js";

/**
 * CPU-only isometric preview renderer (Railway-safe)
 * - No WebGL
 * - Produces a PNG preview suitable for embedding into PDFKit
 *
 * Params:
 *  - stlPath
 *  - outputPngPath
 *  - width, height
 */
export async function renderPreviewPngCpu({
                                              stlPath,
                                              outputPngPath,
                                              width = 900,
                                              height = 600
                                          }) {
    const { triangles, bbox } = parseStlToTriangles(stlPath);

    if (!bbox || !triangles || triangles.length < 9) {
        throw new Error("Cannot render preview: empty geometry.");
    }

    // Prepare canvas
    const img = PImage.make(width, height);
    const ctx = img.getContext("2d");

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Brand-ish colors
    const stroke = "#0f172a";        // slate-ish
    const fillLight = "#93c5fd";     // light blue
    const fillMid = "#3b82f6";       // blue
    const fillDark = "#1e40af";      // dark blue

    // Center and normalize model coordinates
    const cx = (bbox.min.x + bbox.max.x) / 2;
    const cy = (bbox.min.y + bbox.max.y) / 2;
    const cz = (bbox.min.z + bbox.max.z) / 2;

    const sizeX = bbox.size.x || 1;
    const sizeY = bbox.size.y || 1;
    const sizeZ = bbox.size.z || 1;
    const maxDim = Math.max(sizeX, sizeY, sizeZ);

    // Scale to fit image with padding
    const padding = 70;
    const scale = (Math.min(width, height) - padding * 2) / maxDim;

    // Isometric projection (classic)
    // rotate around Y and X to simulate iso view
    const deg = (d) => (d * Math.PI) / 180;
    const rotY = deg(35);
    const rotX = deg(25);

    function project(x, y, z) {
        // Center
        x = (x - cx) * scale;
        y = (y - cy) * scale;
        z = (z - cz) * scale;

        // Rotate Y
        const x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
        const z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);

        // Rotate X
        const y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
        const z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);

        // Screen space (y inverted)
        const sx = width / 2 + x1;
        const sy = height / 2 - y2;

        return { sx, sy, depth: z2 };
    }

    // Build triangles list with depth sorting (Painter's algorithm)
    const tris = [];
    for (let i = 0; i < triangles.length; i += 9) {
        const ax = triangles[i], ay = triangles[i + 1], az = triangles[i + 2];
        const bx = triangles[i + 3], by = triangles[i + 4], bz = triangles[i + 5];
        const cxv = triangles[i + 6], cyv = triangles[i + 7], czv = triangles[i + 8];

        const pa = project(ax, ay, az);
        const pb = project(bx, by, bz);
        const pc = project(cxv, cyv, czv);

        // Approx face normal (in model space) for simple shading
        const n = faceNormal(ax, ay, az, bx, by, bz, cxv, cyv, czv);

        // Light direction (from top-right-front)
        const lx = 0.5, ly = 0.8, lz = 0.4;
        const intensity = clamp01((n.x * lx + n.y * ly + n.z * lz) / (len3(n.x, n.y, n.z) * len3(lx, ly, lz)));

        const color =
            intensity > 0.66 ? fillLight :
                intensity > 0.33 ? fillMid :
                    fillDark;

        const depth = (pa.depth + pb.depth + pc.depth) / 3;

        tris.push({ pa, pb, pc, depth, color });
    }

    // Sort back-to-front
    tris.sort((t1, t2) => t1.depth - t2.depth);

    // Draw filled faces (fast-ish)
    for (const t of tris) {
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.moveTo(t.pa.sx, t.pa.sy);
        ctx.lineTo(t.pb.sx, t.pb.sy);
        ctx.lineTo(t.pc.sx, t.pc.sy);
        ctx.closePath();
        ctx.fill();
    }

    // Optional wireframe overlay for “technical” look
    ctx.strokeStyle = stroke;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;

    for (const t of tris) {
        ctx.beginPath();
        ctx.moveTo(t.pa.sx, t.pa.sy);
        ctx.lineTo(t.pb.sx, t.pb.sy);
        ctx.lineTo(t.pc.sx, t.pc.sy);
        ctx.closePath();
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Footer label
    ctx.fillStyle = "#334155";
    ctx.font = "16pt Arial";
    ctx.fillText("Isometric Preview (CPU Render)", 50, height - 30);

    // Ensure output directory exists
    await fs.promises.mkdir(path.dirname(outputPngPath), { recursive: true });

    // Write PNG
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(outputPngPath);
        out.on("finish", resolve);
        out.on("error", reject);
        PImage.encodePNGToStream(img, out).catch(reject);
    });
}

function faceNormal(ax, ay, az, bx, by, bz, cx, cy, cz) {
    // (b-a) x (c-a)
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    return {
        x: uy * vz - uz * vy,
        y: uz * vx - ux * vz,
        z: ux * vy - uy * vx
    };
}

function len3(x, y, z) {
    return Math.sqrt(x * x + y * y + z * z) || 1;
}

function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}
