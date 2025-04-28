importScripts(
    'gl-matrix.js',
    'utils.js',
    'types.js',
    'isosurface.js',
    'array3d.js',
    'octree.js',
    'algcms.js',
    'mesh.js'
);

function serializeOctreeLeafCells(octree) {
    const out = [];
    for (const cell of octree.leafCells) {
        const c = cell.getCentre();
        out.push({
            center: [c.x, c.y, c.z],
            width: cell.getWidth(),
            height: cell.getHeight(),
            depth: cell.getDepth()
        });
    }
    return out;
}

self.onmessage = function(e) {
    const params = e.data;
    const isoFunction = Isosurfaces.getFunction(params.functionName);
    const isosurface = new FunctionIsosurface(isoFunction);
    const container = [
        new Range(-1, 1),
        new Range(-1, 1),
        new Range(-1, 1)
    ];
    const cms = new AlgCMS(
        isosurface,
        container,
        params.minLevel,
        params.maxLevel
    );
    cms.setComplexSurfThresh(params.complexThreshold);
    cms.setZeroApproximation(params.zeroApproximation);
    cms.setSnapCentroid(params.snapCentroid);

    const mesh = new Mesh();

    // Timings for info panel
    const timings = {};
    const t0 = performance.now();

    let t1 = performance.now();
    if (!cms.sampled) cms.sampleFunction();
    let t2 = performance.now();
    timings.sampling = t2 - t1;

    t1 = performance.now();
    cms.octree.buildOctree();
    t2 = performance.now();
    timings.octree = t2 - t1;

    t1 = performance.now();
    cms.octreeRoot = cms.octree.getRoot();
    if (cms.desiredCells.length > 0) cms.fixDesiredChildren();
    cms.cubicalMarchingSquaresAlg();
    t2 = performance.now();
    timings.segment = t2 - t1;

    t1 = performance.now();
    cms.tessellationTraversal(cms.octreeRoot, mesh);
    cms.createMesh(mesh);
    t2 = performance.now();
    timings.surface = t2 - t1;

    const tEnd = performance.now();
    timings.total = tEnd - t0;

    // Algorithm/Performance Stats
    const stats = cms.getStatistics();
    const algorithm = {
        "Function": params.functionName || "Unknown",
        "Samples": `${stats.samples.x} × ${stats.samples.y} × ${stats.samples.z}`,
        "Min Octree Level": stats.octree.minLevel,
        "Max Octree Level": stats.octree.maxLevel,
        "Total Cells": stats.octree.totalCells,
        "Leaf Cells": stats.octree.leafCells,
        "Vertices": stats.mesh.vertices,
        "Triangles": stats.mesh.triangles,
        "Zero Approximation": stats.parameters.zeroApproximation,
        "Complex Threshold": stats.parameters.complexSurfThresh,
        "Snap Centroid": stats.parameters.snapCentroid ? "Yes" : "No"
    };
    const performanceStats = {
        "Sampling Time": Utils.formatTimeMs(timings.sampling),
        "Octree Build Time": Utils.formatTimeMs(timings.octree),
        "Segment Generation": Utils.formatTimeMs(timings.segment),
        "Surface Extraction": Utils.formatTimeMs(timings.surface),
        "Total Time": Utils.formatTimeMs(timings.total)
    };

    const octreeLeafCells = serializeOctreeLeafCells(cms.octree);

    self.postMessage({
        vertices: mesh.vertices,
        normals: mesh.normals,
        indices: mesh.indices,
        stats: stats,
        octreeLeafCells: octreeLeafCells,
        algorithm: algorithm,
        performance: performanceStats
    });
};