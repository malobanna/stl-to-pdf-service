import fs from "fs";
import STLReader from "stl-reader";

export function analyzeStl(filePath) {
    const buffer = fs.readFileSync(filePath);
    const reader = new STLReader(buffer);

    const vertices = reader.getVertices();
    const triangleCount = vertices.length / 9; // 3 vertices × 3 coords

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];

        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    const bbox = triangleCount > 0
        ? {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ },
            size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
        }
        : null;

    return { triangleCount, bbox };
}
