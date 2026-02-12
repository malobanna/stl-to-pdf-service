import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export async function generatePdfReport({
                                            outputPath,
                                            email,
                                            originalFileName,
                                            reportUrl,
                                            metrics,
                                            previewPngPath
                                        }) {
    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const stream = fs.createWriteStream(outputPath);

        stream.on("finish", resolve);
        stream.on("error", reject);

        doc.pipe(stream);

        const brandBlue = "#1F6FEB";
        const muted = "#666666";

        // Logo (optional)
        const logoPath = process.env.LOGO_PATH
            ? path.resolve(process.env.LOGO_PATH)
            : path.resolve("./runtime/assets/logo.png");

        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 40, { width: 120 });
        }

        doc.moveDown(2.5);

        doc.fillColor(brandBlue).fontSize(22).text("3D Print Readiness Report");
        doc.fillColor("black").moveDown(0.5);

        doc.fontSize(10).fillColor(muted)
            .text(`Generated: ${new Date().toISOString()}`)
            .text(`Report generated: ${reportUrl}`)
            .fillColor("black");

        doc.moveDown(1);

        // Preview image
        if (previewPngPath && fs.existsSync(previewPngPath)) {
            doc.fillColor(brandBlue).fontSize(14).text("3D Preview (Shaded Isometric)");
            doc.fillColor("black").moveDown(0.4);
            doc.image(previewPngPath, { fit: [500, 260], align: "left" });
            doc.moveDown(1);
        }

        // Model overview
        doc.fillColor(brandBlue).fontSize(14).text("Model Overview");
        doc.fillColor("black").moveDown(0.4);

        doc.fontSize(11)
            .text(`User Email: ${email}`)
            .text(`STL File: ${originalFileName}`)
            .text(`Triangles: ${metrics.triangleCount.toLocaleString()}`);

        if (metrics.volumeMm3 != null) {
            doc.text(`Estimated Volume: ${formatNumber(metrics.volumeMm3)} mm³`);
        } else {
            doc.fillColor(muted).text("Estimated Volume: Not available for ASCII STL (heuristic mode).").fillColor("black");
        }

        doc.moveDown(1);

        // Dimensions
        doc.fillColor(brandBlue).fontSize(14).text("Overall Dimensions");
        doc.fillColor("black").moveDown(0.4);

        if (metrics.dims) {
            doc.fontSize(11)
                .text(`Length: ${metrics.dims.lengthMm} mm`)
                .text(`Width: ${metrics.dims.widthMm} mm`)
                .text(`Height: ${metrics.dims.heightMm} mm`)
                .text(`Units: ${metrics.units}`);
        } else {
            doc.fontSize(11).text("Dimensions: Not available (no facets detected).");
        }

        doc.moveDown(0.6);
        doc.fontSize(9).fillColor(muted)
            .text("Note: STL files do not contain units. Confirm scale in your slicer before printing.")
            .fillColor("black");

        doc.moveDown(1);

        // Print readiness
        doc.fillColor(brandBlue).fontSize(14).text("Print Readiness Summary");
        doc.fillColor("black").moveDown(0.4);

        const pr = metrics.printReadiness;
        doc.fontSize(11)
            .text(`Supports Required: ${pr.supportsRequired}`)
            .text(`Recommended Orientation: ${pr.recommendedOrientation}`)
            .text(`Recommended Layer Height: ${pr.recommendedLayerHeightMm} mm`)
            .text(`Recommended Infill: ${pr.recommendedInfill}`)
            .text(`Recommended Wall Count: ${pr.recommendedWalls}`);

        doc.moveDown(1);

        // Material guidance
        doc.fillColor(brandBlue).fontSize(14).text("Material Guidance");
        doc.fillColor("black").moveDown(0.4);

        doc.fontSize(11)
            .text("Recommended Materials:")
            .text("✔ PETG (best for outdoor/cold weather use)")
            .text("✔ ABS (durable and impact resistant)")
            .text("⚠ PLA may become brittle in very cold conditions");

        doc.moveDown(0.4);
        doc.fontSize(11)
            .text(`Filament Diameter: ${pr.filamentDiameterMm} mm recommended`)
            .text(`Nozzle Size: ${pr.nozzleMm} mm recommended`);

        doc.moveDown(1);

        // Filament/spool usage
        doc.fillColor(brandBlue).fontSize(14).text("Filament & Spool Usage");
        doc.fillColor("black").moveDown(0.4);

        const estMin = metrics.estimates?.min;
        const estMax = metrics.estimates?.max;

        if (estMin && estMax) {
            doc.fontSize(11)
                .text(`Estimated filament usage: ~${estMin.grams.PLA}–${estMax.grams.PLA} g (PLA, based on 30–40% infill)`)
                .text(`Estimated filament length: ~${estMin.filamentLengthM}–${estMax.filamentLengthM} m`)
                .text(`1kg spool usage: ~${estMin.spoolUsagePct}–${estMax.spoolUsagePct}% (PLA)`)
                .text(`Estimated material cost: ~£${estMin.costGBP}–£${estMax.costGBP} (based on £${metrics.estimates.filamentPricePerKgGBP}/kg)`);
            doc.moveDown(0.4);
            doc.fontSize(9).fillColor(muted)
                .text("Note: Actual usage varies by slicer, wall thickness, top/bottom layers, and print speed.")
                .fillColor("black");
        } else {
            doc.fontSize(11).text("Filament estimates: Not available for ASCII STL (heuristic mode).");
        }

        doc.moveDown(1);

        // Bounding box
        doc.fillColor(brandBlue).fontSize(14).text("Bounding Box");
        doc.fillColor("black").moveDown(0.4);

        if (metrics.bbox) {
            const { size } = metrics.bbox;
            doc.fontSize(11)
                .text(`Model Envelope:`)
                .text(`X: ${size.x.toFixed(3)} mm`)
                .text(`Y: ${size.y.toFixed(3)} mm`)
                .text(`Z: ${size.z.toFixed(3)} mm`);
        } else {
            doc.fontSize(11).text("Bounding box: Not available.");
        }

        doc.moveDown(1);

        // Print time
        doc.fillColor(brandBlue).fontSize(14).text("Estimated Print Time");
        doc.fillColor("black").moveDown(0.4);

        if (estMin && estMax) {
            doc.fontSize(11).text(`~${estMin.printTimeHours}–${estMax.printTimeHours} hours (0.2mm layer height, heuristic estimate)`);
        } else {
            doc.fontSize(11).text("Print time: Not available for ASCII STL (heuristic mode).");
        }

        doc.moveDown(1);

        // Bed requirement
        doc.fillColor(brandBlue).fontSize(14).text("Bed Size Requirement");
        doc.fillColor("black").moveDown(0.4);

        if (metrics.bed) {
            doc.fontSize(11).text(`Minimum build plate: ${metrics.bed.minBedXmm} mm × ${metrics.bed.minBedYmm} mm`);
        } else {
            doc.fontSize(11).text("Bed size: Not available.");
        }

        doc.moveDown(1);

        // Mesh health (transparent)
        doc.fillColor(brandBlue).fontSize(14).text("Mesh Health & Quality (Heuristic)");
        doc.fillColor("black").moveDown(0.4);

        doc.fontSize(11)
            .text("Watertight: Assumed (binary STL integrity OK)")
            .text("Non-manifold edges: Not measured (Option B upgrade)")
            .text("Inverted normals: Not measured (Option B upgrade)")
            .text("Self-intersections: Not measured (Option B upgrade)");

        doc.moveDown(1);

        // Disclaimer
        doc.fillColor(brandBlue).fontSize(14).text("Disclaimer");
        doc.fillColor("black").moveDown(0.4);

        doc.fontSize(9).fillColor(muted).text(
            "This report provides geometry-based estimates and recommended starting settings. STL files do not contain unit metadata; confirm scale in your slicer. Print outcomes vary by printer calibration, material, and slicer configuration. Use at your own discretion.",
            { align: "left" }
        );

        doc.end();
    });
}

function formatNumber(n) {
    // readable thousand separators while keeping decimals
    const s = String(n);
    const [a, b] = s.split(".");
    const withCommas = a.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return b ? `${withCommas}.${b}` : withCommas;
}
