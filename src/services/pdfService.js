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

        // -----------------------------
        // Brand Styling
        // -----------------------------

        const brandBlue = "#1F6FEB";
        const dark = "#111111";
        const muted = "#6B7280";

        const logoPath = process.env.LOGO_PATH
            ? path.resolve(process.env.LOGO_PATH)
            : path.resolve("./runtime/assets/logo.png");

        // -----------------------------
        // HEADER (Page 1)
        // -----------------------------

        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 40, { width: 120 });
        }

        doc.moveDown(2.5);

        doc.fillColor(brandBlue)
            .fontSize(22)
            .text("3D Print Readiness Report");

        doc.moveDown(0.4);

        doc.fillColor(muted)
            .fontSize(9)
            .text(`Generated: ${new Date().toISOString()}`)
            .text(`Report URL: ${reportUrl}`);

        doc.fillColor(dark);
        doc.moveDown(1.2);

        // =============================
        // MODEL OVERVIEW
        // =============================

        sectionTitle(doc, "Model Overview", brandBlue);

        doc.fontSize(11)
            .text(`User Email: ${email}`)
            .text(`STL File: ${originalFileName}`)
            .text(`Triangles: ${metrics.triangleCount.toLocaleString()}`);

        if (metrics.volumeMm3 != null) {
            doc.text(`Estimated Volume: ${formatNumber(metrics.volumeMm3)} mm³`);
        } else {
            mutedText(doc, "Estimated Volume: Not available (ASCII STL heuristic mode).");
        }

        doc.moveDown(1);

        // =============================
        // DIMENSIONS
        // =============================

        sectionTitle(doc, "Overall Dimensions", brandBlue);

        if (metrics.dims) {
            doc.fontSize(11)
                .text(`Length: ${metrics.dims.lengthMm} mm`)
                .text(`Width: ${metrics.dims.widthMm} mm`)
                .text(`Height: ${metrics.dims.heightMm} mm`)
                .text(`Units: ${metrics.units}`);
        } else {
            doc.fontSize(11).text("Dimensions: Not available.");
        }

        mutedText(doc, "Note: STL files do not contain units. Confirm scale in your slicer.");

        doc.moveDown(1);

        // =============================
        // PRINT READINESS
        // =============================

        sectionTitle(doc, "Print Readiness Summary", brandBlue);

        const pr = metrics.printReadiness;

        doc.fontSize(11)
            .text(`Supports Required: ${pr.supportsRequired}`)
            .text(`Recommended Orientation: ${pr.recommendedOrientation}`)
            .text(`Layer Height: ${pr.recommendedLayerHeightMm} mm`)
            .text(`Infill: ${pr.recommendedInfill}`)
            .text(`Wall Count: ${pr.recommendedWalls}`);

        doc.moveDown(1);

        // =============================
        // MATERIAL GUIDANCE
        // =============================

        sectionTitle(doc, "Material Guidance", brandBlue);

        doc.fontSize(11)
            .text("Recommended Materials:")
            .text("• PETG (best for outdoor / cold weather use)")
            .text("• ABS (durable and impact resistant)")
            .text("• PLA (general use, indoor)");

        doc.moveDown(0.4);

        doc.text(`Filament Diameter: ${pr.filamentDiameterMm} mm`)
            .text(`Nozzle Size: ${pr.nozzleMm} mm`);

        doc.moveDown(1);

        // =============================
        // FILAMENT ESTIMATION
        // =============================

        sectionTitle(doc, "Filament & Spool Usage", brandBlue);

        const estMin = metrics.estimates?.min;
        const estMax = metrics.estimates?.max;

        if (estMin && estMax) {
            doc.fontSize(11)
                .text(`Estimated Usage: ~${estMin.grams.PLA}–${estMax.grams.PLA} g (PLA, 30–40% infill)`)
                .text(`Estimated Length: ~${estMin.filamentLengthM}–${estMax.filamentLengthM} m`)
                .text(`Spool Usage (1kg): ~${estMin.spoolUsagePct}–${estMax.spoolUsagePct}%`)
                .text(`Estimated Cost: ~£${estMin.costGBP}–£${estMax.costGBP} (based on £${metrics.estimates.filamentPricePerKgGBP}/kg)`);

            mutedText(doc, "Actual usage varies by slicer settings and calibration.");
        } else {
            doc.fontSize(11).text("Filament estimates not available.");
        }

        doc.moveDown(1);

        // =============================
        // BOUNDING BOX
        // =============================

        sectionTitle(doc, "Bounding Box", brandBlue);

        if (metrics.bbox) {
            const { size } = metrics.bbox;
            doc.fontSize(11)
                .text(`X: ${size.x.toFixed(2)} mm`)
                .text(`Y: ${size.y.toFixed(2)} mm`)
                .text(`Z: ${size.z.toFixed(2)} mm`);
        } else {
            doc.text("Bounding box: Not available.");
        }

        doc.moveDown(1);

        // =============================
        // PRINT TIME
        // =============================

        sectionTitle(doc, "Estimated Print Time", brandBlue);

        if (estMin && estMax) {
            doc.fontSize(11)
                .text(`~${estMin.printTimeHours}–${estMax.printTimeHours} hours (0.2mm layer height, heuristic)`);
        } else {
            doc.text("Print time estimate not available.");
        }

        doc.moveDown(1);

        // =============================
        // BED SIZE
        // =============================

        sectionTitle(doc, "Build Plate Requirement", brandBlue);

        if (metrics.bed) {
            doc.fontSize(11)
                .text(`Minimum build plate: ${metrics.bed.minBedXmm} mm × ${metrics.bed.minBedYmm} mm`);
        } else {
            doc.text("Bed size requirement not available.");
        }

        doc.moveDown(1);

        // =============================
        // MESH HEALTH
        // =============================

        sectionTitle(doc, "Mesh Health & Quality (Heuristic)", brandBlue);

        doc.fontSize(11)
            .text("Watertight: Assumed (binary STL integrity OK)")
            .text("Non-manifold edges: Not analysed (Option B upgrade)")
            .text("Inverted normals: Not analysed (Option B upgrade)")
            .text("Self-intersections: Not analysed (Option B upgrade)");

        doc.moveDown(1);

        // =============================
        // DISCLAIMER
        // =============================

        sectionTitle(doc, "Disclaimer", brandBlue);

        mutedText(
            doc,
            "This report provides geometry-based estimates and recommended starting settings. STL files do not contain unit metadata. Confirm scale in your slicer. Print results vary by machine calibration, material quality, and slicer configuration. Use at your own discretion."
        );

        // =============================
        // PREVIEW ON SEPARATE PAGE
        // =============================

        if (previewPngPath && fs.existsSync(previewPngPath)) {
            doc.addPage();

            doc.fillColor(brandBlue)
                .fontSize(18)
                .text("3D Preview (Shaded Isometric)");

            doc.moveDown(1);

            const pageWidth =
                doc.page.width - doc.page.margins.left - doc.page.margins.right;

            doc.image(previewPngPath, doc.page.margins.left, doc.y, {
                fit: [pageWidth, 450],
                align: "center",
            });
        }

        doc.end();
    });
}

// -----------------------------
// Helper Functions
// -----------------------------

function sectionTitle(doc, title, color) {
    doc.fillColor(color)
        .fontSize(14)
        .text(title)
        .moveDown(0.4)
        .fillColor("#111111");
}

function mutedText(doc, text) {
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor("#6B7280").text(text);
    doc.fillColor("#111111");
    doc.moveDown(0.6);
}

function formatNumber(n) {
    const s = String(n);
    const [a, b] = s.split(".");
    const withCommas = a.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return b ? `${withCommas}.${b}` : withCommas;
}
