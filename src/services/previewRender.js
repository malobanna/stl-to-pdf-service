import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import * as THREE from "three";
import createGL from "gl";
import { parseStlToTriangles } from "./stlGeometry.js";

export async function renderPreviewPng({ stlPath, outputPngPath, width = 900, height = 600 }) {
    const { triangles, bbox } = parseStlToTriangles(stlPath);
    if (!bbox || triangles.length === 0) throw new Error("Cannot render preview: empty geometry.");

    // Create headless GL context
    const gl = createGL(width, height, { preserveDrawingBuffer: true, antialias: true });
    if (!gl) throw new Error("Failed to create headless WebGL context.");

    const renderer = new THREE.WebGLRenderer({ context: gl });
    renderer.setSize(width, height, false);
    renderer.setClearColor(0xffffff, 1);

    const scene = new THREE.Scene();

    // Lights (shaded look)
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(2, 3, 4);
    scene.add(dir);

    // Geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    // Center geometry
    const box = geometry.boundingBox;
    const center = new THREE.Vector3();
    box.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);

    const material = new THREE.MeshStandardMaterial({
        color: 0x1f6feb,          // brand-ish blue (tweak as needed)
        metalness: 0.05,
        roughness: 0.55
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Camera (isometric-ish)
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 10000);

    // Fit camera to bounds
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const distance = maxDim * 2.2;
    camera.position.set(distance, distance, distance);
    camera.lookAt(0, 0, 0);

    // Subtle turn for nicer angle
    mesh.rotation.y = THREE.MathUtils.degToRad(25);
    mesh.rotation.x = THREE.MathUtils.degToRad(-10);

    renderer.render(scene, camera);

    // Read pixels
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Flip Y and write PNG
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
        const srcRow = height - 1 - y;
        const srcStart = srcRow * width * 4;
        const dstStart = y * width * 4;
        pixels.copy(png.data, dstStart, srcStart, srcStart + width * 4);
    }

    await fs.promises.mkdir(path.dirname(outputPngPath), { recursive: true });

    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(outputPngPath);
        out.on("finish", resolve);
        out.on("error", reject);
        png.pack().pipe(out);
    });
}
