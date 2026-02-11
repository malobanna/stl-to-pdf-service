import fs from "fs";

/**
 * Analyze STL file (supports binary + ASCII)
 * Returns triangle count + bounding box
 */
export function analyzeStl(filePath) {
    const buffer = fs.readFileSync(filePath);

    if (!buffer || buffer.length < 84) {
        throw new Error("Invalid STL file.");
    }

    // Detect binary STL
    const isBinary = detectBinarySTL(buffer);

    if (isBinary) {
        return analyzeBinarySTL(buffer);
    } else {
        return analyzeAsciiSTL(buffer.toString("utf8"));
    }
}

/**
 * Detect if STL is binary
 */
function detectBinarySTL(buffer) {
    if (buffer.length < 84) return false;

    const faceCount = buffer.readUInt32LE(80);
    const expectedSize = 84 + faceCount * 50;

    return expectedSize === buffer.length;
}

/**
 * Analyze Binary STL
 */
function analyzeBinarySTL(buffer) {
    const triangleCount = buffer.readUInt32LE(80);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < triangleCount; i++) {
        const offset = 84 + i * 50;

        // Each triangle has 3 vertices
        for (let v = 0; v < 3; v++) {
            const vertexOffset = offset + 12 + v * 12;

            const x = buffer.readFloatLE(vertexOffset);
            const y = buffer.readFloatLE(vertexOffset + 4);
            const z = buffer.readFloatLE(vertexOffset + 8);

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }
    }

    const bbox = triangleCount > 0
        ? {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ },
            size: {
                x: maxX - minX,
                y: maxY - minY,
                z: maxZ - minZ
            }
        }
        : null;

    return { triangleCount, bbox };
}

/**
 * Analyze ASCII STL
 */
function analyzeAsciiSTL(text) {
    const vertexRegex = /vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g;

    let match;
    let triangleCount = 0;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    while ((match = vertexRegex.exec(text)) !== null) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        const z = parseFloat(match[3]);

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);

        triangleCount++;
    }

    triangleCount = Math.floor(triangleCount / 3);

    const bbox = triangleCount > 0
        ? {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ },
            size: {
                x: maxX - minX,
                y: maxY - minY,
                z: maxZ - minZ
            }
        }
        : null;

    return { triangleCount, bbox };
}
