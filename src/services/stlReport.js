import { parseStlToTriangles } from "./stlGeometry.js";

export function analyzeStl(filePath) {
    const parsed = parseStlToTriangles(filePath);

    const triangleCount = parsed.triangleCount;
    const bbox = parsed.bbox;
    const volumeMm3 = parsed.volume; // null for ASCII

    // Assumptions (Option A)
    const units = "Millimetres";
    const filamentDiameterMm = 1.75;
    const nozzleMm = 0.4;
    const layerHeightMm = 0.2;
    const filamentPricePerKgGBP = 25;

    // Densities (g/cm^3)
    const densities = {
        PLA: 1.24,
        PETG: 1.27,
        ABS: 1.04
    };

    const dims = bbox ? {
        lengthMm: round3(Math.max(bbox.size.x, bbox.size.y)),
        widthMm: round3(Math.min(bbox.size.x, bbox.size.y)),
        heightMm: round3(bbox.size.z)
    } : null;

    // Print readiness heuristics
    const flatBaseLikely = parsed.heuristics?.flatBaseVertexRatio >= 0.08; // tweakable
    const supportsRequiredLikely = !flatBaseLikely && dims ? (dims.heightMm > Math.min(dims.lengthMm, dims.widthMm) * 0.35) : false;

    const orientation = flatBaseLikely ? "Flat on bed" : "Auto-orient in slicer (choose most stable face)";
    const infillRange = { min: 0.30, max: 0.40 };
    const walls = "3–4 walls";

    // Volume-derived estimates
    // Convert mm^3 to cm^3: /1000
    const volumeCm3 = (typeof volumeMm3 === "number") ? (volumeMm3 / 1000) : null;

    // Effective printed volume is not equal to solid volume (infill, walls, top/bottom).
    // Heuristic multiplier: printed material ≈ solidVolume * (infill + shellFactor)
    // shellFactor ~ 0.10–0.18 typical; we use 0.14 for credibility.
    const shellFactor = 0.14;

    const estimateForInfill = (infill) => {
        if (volumeCm3 == null) return null;
        const effectiveCm3 = volumeCm3 * (infill + shellFactor);

        // filament length from volume:
        // filament cross-section area = π(r^2) in mm^2; volume mm^3 / area mm^2 => length mm
        const areaMm2 = Math.PI * Math.pow(filamentDiameterMm / 2, 2);
        const effectiveMm3 = effectiveCm3 * 1000;
        const lengthMm = effectiveMm3 / areaMm2;
        const lengthM = lengthMm / 1000;

        // grams by material density: g = cm^3 * density
        const gramsPLA = effectiveCm3 * densities.PLA;
        const gramsPETG = effectiveCm3 * densities.PETG;
        const gramsABS = effectiveCm3 * densities.ABS;

        // cost estimate
        const costGBP_PLA = (gramsPLA / 1000) * filamentPricePerKgGBP;

        // print time (very rough): assume extrusion rate ~ 8 mm^3/s and add overhead
        const extrusionRateMm3PerSec = 8;
        const seconds = (effectiveMm3 / extrusionRateMm3PerSec) * 1.25; // 25% overhead
        const hours = seconds / 3600;

        return {
            effectiveCm3: round3(effectiveCm3),
            filamentLengthM: round1(lengthM),
            grams: {
                PLA: round1(gramsPLA),
                PETG: round1(gramsPETG),
                ABS: round1(gramsABS)
            },
            spoolUsagePct: round1((gramsPLA / 1000) * 100),
            costGBP: round2(costGBP_PLA),
            printTimeHours: round1(hours)
        };
    };

    const estMin = estimateForInfill(infillRange.min);
    const estMax = estimateForInfill(infillRange.max);

    // Bed requirement
    const bed = dims ? {
        minBedXmm: Math.ceil(dims.widthMm + 20),
        minBedYmm: Math.ceil(dims.lengthMm + 20)
    } : null;

    return {
        triangleCount,
        bbox,
        units,
        dims,
        volumeMm3: (typeof volumeMm3 === "number") ? round3(volumeMm3) : null,
        printReadiness: {
            supportsRequired: supportsRequiredLikely ? "Likely" : "Unlikely",
            recommendedOrientation: orientation,
            recommendedLayerHeightMm: layerHeightMm,
            recommendedInfill: "30–40%",
            recommendedWalls: walls,
            nozzleMm,
            filamentDiameterMm
        },
        estimates: {
            infillMin: infillRange.min,
            infillMax: infillRange.max,
            min: estMin,
            max: estMax,
            filamentPricePerKgGBP
        },
        bed
    };
}

function round3(n) { return Number(n.toFixed(3)); }
function round2(n) { return Number(n.toFixed(2)); }
function round1(n) { return Number(n.toFixed(1)); }
