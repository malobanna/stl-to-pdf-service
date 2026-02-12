import fs from "fs";

/**
 * Parses STL (binary + ASCII) into triangle vertices.
 * Returns:
 *  - triangles: Float32Array of xyz xyz xyz ... (3 verts per triangle)
 *  - triangleCount
 *  - bbox (min/max/size)
 *  - volume (mm^3 if STL units are mm)
 */
export function parseStlToTriangles(filePath) {
    const buffer = fs.readFileSync(filePath);
    if (!buffer || buffer.length < 84) throw new Error("Invalid STL file.");

    const isBinary = detectBinarySTL(buffer);
    return isBinary ? parseBinary(buffer) : parseAscii(buffer.toString("utf8"));
}

function detectBinarySTL(buffer) {
    // Strong binary check:
    // If header starts with "solid" it *might* still be binary, so size check is best.
    const faceCount = buffer.readUInt32LE(80);
    const expectedSize = 84 + faceCount * 50;
    return expectedSize === buffer.length;
}

function parseBinary(buffer) {
    const triangleCount = buffer.readUInt32LE(80);
    const triangles = new Float32Array(triangleCount * 9);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    let volume = 0;

    for (let i = 0; i < triangleCount; i++) {
        const triOffset = 84 + i * 50;

        const verts = [];
        for (let v = 0; v < 3; v++) {
            const o = triOffset + 12 + v * 12;
            const x = buffer.readFloatLE(o);
            const y = buffer.readFloatLE(o + 4);
            const z = buffer.readFloatLE(o + 8);

            verts.push({ x, y, z });

            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);

            const idx = i * 9 + v * 3;
            triangles[idx] = x;
            triangles[idx + 1] = y;
            triangles[idx + 2] = z;
        }

        volume += signedTetraVolume(verts[0], verts[1], verts[2]);
    }

    volume = Math.abs(volume);

    const bbox = triangleCount > 0 ? {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
        size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
    } : null;

    return { triangles, triangleCount, volume, bbox, heuristics: {} };
}

function signedTetraVolume(a, b, c) {
    return (
        (a.x * b.y * c.z +
            a.y * b.z * c.x +
            a.z * b.x * c.y -
            a.x * b.z * c.y -
            a.y * b.x * c.z -
            a.z * b.y * c.x) / 6
    );
}

function parseAscii(text) {
    const vertexRegex = /vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g;

    const verts = [];
    let match;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    while ((match = vertexRegex.exec(text)) !== null) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        const z = parseFloat(match[3]);

        if (![x, y, z].every(Number.isFinite)) continue;

        verts.push(x, y, z);

        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }

    const triangleCount = Math.floor(verts.length / 9);
    const triangles = new Float32Array(verts);

    const bbox = triangleCount > 0 ? {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
        size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
    } : null;

    return { triangles, triangleCount, volume: null, bbox, heuristics: {} };
}
