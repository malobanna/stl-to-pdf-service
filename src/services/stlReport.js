import fs from "fs";
import parseSTL from "stl-parser";

export function analyzeStl(filePath) {
    const buffer = fs.readFileSync(filePath);
    const mesh = parseSTL(buffer);

    const facets = mesh?.facets || [];
    const triangleCount = facets.length;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const f of facets) {
        const vs = f?.verts || [];
        for (const v of vs) {
            const x = v[0], y = v[1], z = v[2];
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
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
