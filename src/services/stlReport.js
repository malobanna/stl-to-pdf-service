import fs from "fs";

/**
 * Analyze STL file (binary + ASCII support)
 * Returns:
 *  - triangleCount
 *  - bbox
 *  - volume (if binary STL)
 */
export function analyzeStl(filePath) {
    const buffer = fs.readFileSync(filePath);

    if (!buffer || buffer.length < 84) {
        throw new Error("Invalid STL file.");
    }

    const isBinary = detectBinarySTL(buffer);

    if (isBinary) {
        return analyzeBinarySTL(buffer);
    } else {
        return analyzeAsciiSTL(buffer.toString("utf8"));
    }
}

function detectBinarySTL(buffer) {
    const faceCount = buffer.readUInt32LE(80);
    const expectedSize = 84 + faceCount * 50;
    return expectedSize === buffer.length;
}

function analyzeBinarySTL(buffer) {
    const triangleCount = buffer.readUInt32LE(80);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    let volume = 0;

    for (let i = 0; i < triangleCount; i++) {
        const offset = 84 + i * 50;

        const v = [];

        for (let j = 0; j < 3; j++) {
            const vo = offset + 12 + j * 12;

            const x = buffer.readFloatLE(vo);
            const y = buffer.readFloatLE(vo + 4);
            const z = buffer.readFloatLE(vo + 8);

            v.push({ x, y, z });

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }

        // Volume calculation (signed tetrahedron method)
        volume += signedTetraVolume(v[0], v[1], v[2]);
    }

    volume = Math.abs(volume);

    return {
        triangleCount,
        volume,
        bbox: triangleCount > 0
            ? {
                min: { x: minX, y: minY, z: minZ },
                max: { x: maxX, y: maxY, z: maxZ },
                size: {
                    x: maxX - minX,
                    y: maxY - minY,
                    z: maxZ - minZ
                }
            }
            : null
    };
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

function analyzeAsciiSTL(text) {
    const vertexRegex = /vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g;

    let match;
    let vertices = [];

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    while ((match = vertexRegex.exec(text)) !== null) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        const z = parseFloat(match[3]);

        vertices.push({ x, y, z });

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
    }

    const triangleCount = Math.floor(vertices.length / 3);

    return {
        triangleCount,
        volume: null,
        bbox: triangleCount > 0
            ? {
                min: { x: minX, y: minY, z: minZ },
                max: { x: maxX, y: maxY, z: maxZ },
                size: {
                    x: maxX - minX,
                    y: maxY - minY,
                    z: maxZ - minZ
                }
            }
            : null
    };
}
