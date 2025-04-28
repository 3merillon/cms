/**
 * Cubical Marching Squares algorithm implementation
 */
class AlgCMS {
    /**
     * Construct the CMS algorithm.
     * @param {Isosurface} fn - Isosurface function
     * @param {Array} container - Container bounds [xRange, yRange, zRange]
     * @param {number} octreeBase - Minimum octree level
     * @param {number} octreeDepth - Maximum octree level
     */
    constructor(fn, container, octreeBase, octreeDepth) {
        this.fn = fn;
        this.sampled = false;
        this.octMinLvl = Math.max(2, octreeBase);
        this.octMaxLvl = Math.max(this.octMinLvl, octreeDepth);
        this.container = container || [
            new Range(-1, 1),
            new Range(-1, 1),
            new Range(-1, 1)
        ];
        this.initSamples();
        this.initialize();
    }

    /**
     * Initialize sample grid based on octree depth.
     */
    initSamples() {
        const numOfSamples = Utils.getPowerOfTwo(this.octMaxLvl) + 1;
        this.samples = new Index3D(numOfSamples, numOfSamples, numOfSamples);
    }

    /**
     * Initialize algorithm parameters and data structures.
     */
    initialize() {
        this.zeroApproximation = 2;
        this.complexSurfThresh = 0.6;
        this.snapCentroid = false;

        this.xMin = this.container[0].lower;
        this.xMax = this.container[0].upper;
        this.yMin = this.container[1].lower;
        this.yMax = this.container[1].upper;
        this.zMin = this.container[2].lower;
        this.zMax = this.container[2].upper;

        this.offsets = new Vec3(
            Math.abs(this.xMax - this.xMin) / (this.samples.x - 1),
            Math.abs(this.yMax - this.yMin) / (this.samples.y - 1),
            Math.abs(this.zMax - this.zMin) / (this.samples.z - 1)
        );

        this.sampleData = new Array3D();
        this.sampleData.resize(this.samples.x, this.samples.y, this.samples.z);
        this.sampleData.setBBox(this.container);

        this.edgeData = new Array3D();
        this.edgeData.resize(this.samples.x, this.samples.y, this.samples.z);
        this.edgeData.setBBox(this.container);

        for (let x = 0; x < this.samples.x; x++) {
            for (let y = 0; y < this.samples.y; y++) {
                for (let z = 0; z < this.samples.z; z++) {
                    this.edgeData.setValueAt(x, y, z, new EdgeBlock(true));
                }
            }
        }

        this.octree = new Octree(
            this.samples,
            this.sampleData,
            this.octMinLvl,
            this.octMaxLvl,
            this.offsets,
            this.fn,
            this.complexSurfThresh
        );

        this.vertices = [];
        this.indices = [];
        this.desiredCells = [];
    }

    // --- Parameter/utility setters and getters ---
    evaluate(x, y, z) { return this.fn.evaluate(x, y, z); }
    setOctreeLevels(min, max) { this.octMinLvl = min; this.octMaxLvl = max; this.initSamples(); this.initialize(); }
    getOctreeLevels(levels) { levels[0] = this.octMinLvl; levels[1] = this.octMaxLvl; }
    setSamples(xSamp, ySamp, zSamp) { this.samples.x = xSamp; this.samples.y = ySamp; this.samples.z = zSamp; this.initialize(); }
    getSamples(samples) { samples[0] = this.samples.x; samples[1] = this.samples.y; samples[2] = this.samples.z; }
    setZeroApproximation(zeroApproximation) { this.zeroApproximation = zeroApproximation; }
    getZeroApproximation() { return this.zeroApproximation; }
    setComplexSurfThresh(complexSurfThresh) { this.complexSurfThresh = complexSurfThresh; }
    getComplexSurfThresh() { return this.complexSurfThresh; }
    setSnapCentroid(snapCentroid) { this.snapCentroid = snapCentroid; }
    snapCentroid() { return this.snapCentroid; }

    /**
     * Sample the isosurface function on the grid.
     */
    sampleFunction() {
        if (this.samples.x <= 8 || this.samples.y <= 8 || this.samples.z <= 8) return false;
        for (let i = 0; i < this.samples.x; i++) {
            const tx = i / (this.samples.x - 1);
            const xPos = this.xMin + (this.xMax - this.xMin) * tx;
            for (let j = 0; j < this.samples.y; j++) {
                const ty = j / (this.samples.y - 1);
                const yPos = this.yMin + (this.yMax - this.yMin) * ty;
                for (let k = 0; k < this.samples.z; k++) {
                    const tz = k / (this.samples.z - 1);
                    const zPos = this.zMin + (this.zMax - this.zMin) * tz;
                    const val = this.fn.evaluate(xPos, yPos, zPos);
                    this.sampleData.setValueAt(i, j, k, val);
                }
            }
        }
        this.sampled = true;
        return true;
    }

    /**
     * Extract the isosurface and fill the mesh.
     */
    extractSurface(mesh, params = {}) {
        const timings = {};
        const t0 = performance.now();

        let t1 = performance.now();
        if (!this.sampled) this.sampleFunction();
        let t2 = performance.now();
        timings.sampling = t2 - t1;

        t1 = performance.now();
        this.octree.buildOctree();
        t2 = performance.now();
        timings.octree = t2 - t1;

        t1 = performance.now();
        this.octreeRoot = this.octree.getRoot();
        if (this.desiredCells.length > 0) this.fixDesiredChildren();
        this.cubicalMarchingSquaresAlg();
        t2 = performance.now();
        timings.segment = t2 - t1;

        t1 = performance.now();
        this.tessellationTraversal(this.octreeRoot, mesh);
        this.createMesh(mesh);
        t2 = performance.now();
        timings.surface = t2 - t1;

        const tEnd = performance.now();
        timings.total = tEnd - t0;

        const stats = this.getStatistics();
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

        return true;
    }

    /**
     * Run the Cubical Marching Squares algorithm.
     */
    cubicalMarchingSquaresAlg() {
        this.generateSegments(this.octree.getRoot());
        this.editTransitionalFaces();
        this.traceComponent();
    }

    // --- Main algorithmic methods ---
    generateSegments(cell) {  if (!cell) return;
        if (cell.getState() === CellState.BRANCH) {
            for (let i = 0; i < 8; i++) this.generateSegments(cell.getChild(i));
        } else if (cell.getState() === CellState.LEAF) {
            const indices = new Array(4);
            for (let f = 0; f < 6; f++) {
                for (let v = 0; v < 4; v++) {
                    const vert = FACE_VERTEX[f][v];
                    indices[v] = cell.getPointInds()[vert];
                }
                this.makeFaceSegments(indices, cell.getFaceAt(f));
            }
        }
    }
    makeFaceSegments(inds, face) { 
        const edges =
            (this.sampleData.getValueAt(inds[0]) < 0 ? 1 : 0) |
            (this.sampleData.getValueAt(inds[1]) < 0 ? 2 : 0) |
            (this.sampleData.getValueAt(inds[2]) < 0 ? 4 : 0) |
            (this.sampleData.getValueAt(inds[3]) < 0 ? 8 : 0);

        if (edges === 6) {
            this.makeStrip(3, 0, inds, face, 0);
            this.makeStrip(2, 1, inds, face, 1);
        } else if (edges === 9) {
            this.makeStrip(1, 3, inds, face, 0);
            this.makeStrip(0, 2, inds, face, 1);
        } else {
            const e0a = EDGE_MAP[edges][0][0];
            const e0b = EDGE_MAP[edges][0][1];
            if (e0a !== -1) this.makeStrip(e0a, e0b, inds, face, 0);
            const e1a = EDGE_MAP[edges][1][0];
            const e1b = EDGE_MAP[edges][1][1];
            if (e1a !== -1) this.makeStrip(e1a, e1b, inds, face, 1);
        }
    }
    makeStrip(edge0, edge1, inds, face, stripInd) { 
        const s = new Strip(false, edge0, edge1);
        this.populateStrip(s, inds, 0);
        this.populateStrip(s, inds, 1);
        face.strips[stripInd] = s;
        face.skip = false;
    }
    populateStrip(strip, inds, index) { 
        const faceEdge = strip.edge[index];
        const ind0 = inds[VERTEX_MAP[faceEdge][0]];
        const ind1 = inds[VERTEX_MAP[faceEdge][1]];
        const range = new Range();
        const dir = this.getEdgesBetwixt(range, ind0, ind1);
        const signChange = this.exactSignChangeIndex(range, dir, ind0, ind1);

        const crossingIndex0 = ind0.clone();
        const crossingIndex1 = ind0.clone();
        crossingIndex0.set(dir, signChange);
        crossingIndex1.set(dir, signChange + 1);

        let dupli = false;
        const edgeBlock = this.edgeData.getValueAt(crossingIndex0);
        if (edgeBlock && !edgeBlock.empty && edgeBlock.edgeIndices.get(dir) !== -1) {
            strip.data[index] = edgeBlock.edgeIndices.get(dir);
            strip.block[index] = crossingIndex0.clone();
            strip.dir[index] = dir;
            dupli = true;
        }
        if (!dupli) this.makeVertex(strip, dir, crossingIndex0, crossingIndex1, index);
    }
    makeVertex(strip, dir, crossingIndex0, crossingIndex1, index) { 
        const pos0 = this.sampleData.getPositionAt(crossingIndex0);
        const val0 = this.sampleData.getValueAt(crossingIndex0);
        const pt0 = new Point(pos0, val0);

        const pos1 = this.sampleData.getPositionAt(crossingIndex1);
        const val1 = this.sampleData.getValueAt(crossingIndex1);
        const pt1 = new Point(pos1, val1);

        const crossingPoint = this.findCrossingPoint(this.zeroApproximation, pt0, pt1);
        const normal = new Vec3();
        this.findGradient(normal, this.offsets, crossingPoint);
        normal.normalize();

        const vert = new Vertex(crossingPoint, normal);
        this.vertices.push(vert);

        strip.data[index] = this.vertices.length - 1;
        strip.block[index] = crossingIndex0.clone();
        strip.dir[index] = dir;

        let edgeBlock = this.edgeData.getValueAt(crossingIndex0);
        if (!edgeBlock) {
            edgeBlock = new EdgeBlock(false);
            this.edgeData.setValueAt(crossingIndex0, edgeBlock);
        }
        edgeBlock.empty = false;
        edgeBlock.edgeIndices.set(dir, this.vertices.length - 1);
    }
    getEdgesBetwixt(range, pt0, pt1) { 
        let direction = -1;
        const diffX = Math.abs(pt0.x - pt1.x);
        const diffY = Math.abs(pt0.y - pt1.y);
        const diffZ = Math.abs(pt0.z - pt1.z);
        if (diffX > 0) {
            range.set(Math.min(pt0.x, pt1.x), Math.max(pt0.x, pt1.x));
            direction = 0;
        } else if (diffY > 0) {
            range.set(Math.min(pt0.y, pt1.y), Math.max(pt0.y, pt1.y));
            direction = 1;
        } else if (diffZ > 0) {
            range.set(Math.min(pt0.z, pt1.z), Math.max(pt0.z, pt1.z));
            direction = 2;
        }
        return direction;
    }
    exactSignChangeIndex(range, dir, ind0, ind1) { 
        let firstIndex;
        if (ind0.get(dir) === range.lower) firstIndex = ind0.clone();
        else if (ind1.get(dir) === range.lower) firstIndex = ind1.clone();

        if (Math.abs(range.lower - range.upper) === 1) return firstIndex.get(dir);

        const indexer = firstIndex.clone();
        for (let i = range.lower; i < range.upper; i++) {
            indexer.set(dir, i);
            const thisValue = this.sampleData.getValueAt(indexer);
            indexer.set(dir, i + 1);
            const nextValue = this.sampleData.getValueAt(indexer);
            if (thisValue * nextValue <= 0) return i;
        }
        return -1;
    }
    findCrossingPoint(quality, pt0, pt1) { 
        const isoValue = 0;
        const p0 = pt0.getPosition();
        const v0 = pt0.getValue();
        const p1 = pt1.getPosition();
        const v1 = pt1.getValue();
        const alpha = (isoValue - v0) / (v1 - v0);

        const pos = new Vec3(
            p0.x + alpha * (p1.x - p0.x),
            p0.y + alpha * (p1.y - p0.y),
            p0.z + alpha * (p1.z - p0.z)
        );
        const val = this.fn.evaluate(pos.x, pos.y, pos.z);
        if (Math.abs(isoValue - val) < EPSILON || quality === 0) {
            return pos;
        } else {
            const pt = new Point(pos, val);
            if (val < 0) {
                if (v0 > 0) return this.findCrossingPoint(quality - 1, pt, pt0);
                else if (v1 > 0) return this.findCrossingPoint(quality - 1, pt, pt1);
            } else if (val > 0) {
                if (v0 < 0) return this.findCrossingPoint(quality - 1, pt0, pt);
                else if (v1 < 0) return this.findCrossingPoint(quality - 1, pt1, pt);
            }
        }
        return pos;
    }
    findGradient(gradient, dimensions, position) { 
        const delta = 0.01;
        const val = this.fn.evaluate(position.x, position.y, position.z);
        const dx = this.fn.evaluate(position.x + delta, position.y, position.z);
        const dy = this.fn.evaluate(position.x, position.y + delta, position.z);
        const dz = this.fn.evaluate(position.x, position.y, position.z + delta);
        gradient.set(dx - val, dy - val, dz - val);
    }
    findGradientWithValue(gradient, dimensions, position, value) { 
        const dx = this.fn.evaluate(position.x + dimensions.x, position.y, position.z);
        const dy = this.fn.evaluate(position.x, position.y + dimensions.y, position.z);
        const dz = this.fn.evaluate(position.x, position.y, position.z + dimensions.z);
        gradient.set(dx - value, dy - value, dz - value);
    }

    // --- Utility methods for adaptive transitions ---
    isBetweenBlocks(blockA, blockB, targetBlock, dir) {
        const a = blockA.get(dir);
        const b = blockB.get(dir);
        const t = targetBlock.get(dir);
        return (t > Math.min(a, b) && t < Math.max(a, b));
    }
    splitCoarseStripAndInsertVertex(face, crossingKey, vtxIdx) {
        const [blockStr, dirStr] = crossingKey.split(":");
        const [x, y, z] = blockStr.split(",").map(Number);
        const dir = Number(dirStr);
        const crossingBlock = new Index3D(x, y, z);

        for (let s = 0; s < face.strips.length; ++s) {
            const strip = face.strips[s];
            const block0 = strip.block[0];
            const block1 = strip.block[1];
            const dir0 = strip.dir[0];
            const dir1 = strip.dir[1];

            if (dir0 === dir && dir1 === dir) {
                if (this.isBetweenBlocks(block0, block1, crossingBlock, dir)) {
                    const vtx0 = strip.data[0];
                    const vtx1 = strip.data[1];

                    const stripA = new Strip(false, strip.edge[0], strip.edge[1]);
                    stripA.data[0] = vtx0;
                    stripA.block[0] = block0.clone();
                    stripA.dir[0] = dir;
                    stripA.data[1] = vtxIdx;
                    stripA.block[1] = crossingBlock.clone();
                    stripA.dir[1] = dir;

                    const stripB = new Strip(false, strip.edge[0], strip.edge[1]);
                    stripB.data[0] = vtxIdx;
                    stripB.block[0] = crossingBlock.clone();
                    stripB.dir[0] = dir;
                    stripB.data[1] = vtx1;
                    stripB.block[1] = block1.clone();
                    stripB.dir[1] = dir;

                    face.strips.splice(s, 1, stripA, stripB);
                    return;
                }
            }
        }
    }

    // --- Transitional face and component tracing methods ---
    editTransitionalFaces() { 
        const cells = this.octree.getAllCells();
        for (const cell of cells) {
            for (let j = 0; j < 6; j++) {
                const face = cell.getFaceAt(j);
                if (face.state === FaceState.TRANSIT_FACE) {
                    this.resolveTransitionalFace(face);
                }
            }
        }
    }
    resolveTransitionalFace(face) { 
        const fineStrips = [];
        this.traverseFace(face.twin, fineStrips);
        if (fineStrips.length === 0) {
            face.state = FaceState.LEAF_FACE;
            return;
        }
        const uniqueCrossings = new Map();
        for (const strip of fineStrips) {
            for (let i = 0; i < 2; ++i) {
                const block = strip.block[i];
                const dir = strip.dir[i];
                const key = `${block.x},${block.y},${block.z}:${dir}`;
                if (!uniqueCrossings.has(key)) {
                    uniqueCrossings.set(key, strip.data[i]);
                }
            }
        }
        let coarseStrips = face.strips || [];
        if (!coarseStrips.length) {
            coarseStrips = [];
            this.traverseFace(face, coarseStrips);
        }
        face.strips = coarseStrips;
        for (const [key, vtxIdx] of uniqueCrossings.entries()) {
            let found = false;
            for (const strip of face.strips) {
                for (let i = 0; i < 2; ++i) {
                    const block = strip.block[i];
                    const dir = strip.dir[i];
                    const stripKey = `${block.x},${block.y},${block.z}:${dir}`;
                    if (stripKey === key) {
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (!found) {
                this.splitCoarseStripAndInsertVertex(face, key, vtxIdx);
            }
        }
        face.twin.strips = fineStrips.map(strip => {
            const newStrip = new Strip(strip.skip, strip.edge[0], strip.edge[1]);
            newStrip.data[0] = strip.data[0];
            newStrip.data[1] = strip.data[1];
            newStrip.block[0] = strip.block[0].clone();
            newStrip.block[1] = strip.block[1].clone();
            newStrip.dir[0] = strip.dir[0];
            newStrip.dir[1] = strip.dir[1];
            return newStrip;
        });
        face.twin.transitSegs = fineStrips.map(strip => [strip.data[0], strip.data[1]]);
    }
    traverseFace(face, transitStrips) { 
        if (!face) return;
        if (face.state === FaceState.BRANCH_FACE) {
            for (let i = 0; i < 4; i++) {
                this.traverseFace(face.children[i], transitStrips);
            }
        } else if (face.state === FaceState.LEAF_FACE) {
            for (let i = 0; i < face.strips.length; i++) {
                if (!face.strips[i].skip) {
                    transitStrips.push(face.strips[i]);
                }
            }
        }
    }
    traceComponent() { 
        const cells = this.octree.getAllCells();
        for (let i = 0; i < this.octMaxLvl; i++) {
            for (const cell of cells) {
                if (cell.getSubdivLvl() === this.octMaxLvl - i && cell.getState() === CellState.LEAF) {
                    const cellStrips = [];
                    const transitSegs = [];
                    this.collectStrips(cell, cellStrips, transitSegs);
                    while (cellStrips.length > 0) {
                        const component = [];
                        this.linkStrips(component, cellStrips, transitSegs);
                        if (component.length >= 3) {
                            cell.pushComponent(component);
                        }
                    }
                }
            }
        }
    }
    collectStrips(cell, cellStrips, transitSegs) { 
        for (let f = 0; f < 6; f++) {
            const face = cell.getFaceAt(f);
            if (face.state === FaceState.LEAF_FACE) {
                for (const strip of face.strips) {
                    if (strip.data[0] !== -1) cellStrips.push(strip);
                }
            } else if (face.state === FaceState.TRANSIT_FACE) {
                if (!face.twin) continue;
                for (let i = 0; i < face.twin.strips.length; i++) {
                    if (face.twin.strips[i].data[0] !== -1) {
                        transitSegs.push(face.twin.transitSegs[i]);
                        cellStrips.push(face.twin.strips[i]);
                    }
                }
            }
        }
    }
    linkStrips(component, strips, transitSegs) { 
        let minIdx = 0;
        let minVal = Math.min(strips[0].data[0], strips[0].data[1]);
        for (let i = 1; i < strips.length; ++i) {
            let localMin = Math.min(strips[i].data[0], strips[i].data[1]);
            if (localMin < minVal) {
                minIdx = i;
                minVal = localMin;
            }
        }
        const startStrip = strips.splice(minIdx, 1)[0];
        let v0 = startStrip.data[0];
        let v1 = startStrip.data[1];
        let ring = [v0, v1];
        let current = v1;
        while (strips.length > 0) {
            let found = false;
            for (let i = 0; i < strips.length; ++i) {
                const s = strips[i];
                if (s.data[0] === current) {
                    ring.push(s.data[1]);
                    current = s.data[1];
                    strips.splice(i, 1);
                    found = true;
                    break;
                } else if (s.data[1] === current) {
                    ring.push(s.data[0]);
                    current = s.data[0];
                    strips.splice(i, 1);
                    found = true;
                    break;
                }
            }
            if (!found) break;
        }
        current = v0;
        while (strips.length > 0) {
            let found = false;
            for (let i = 0; i < strips.length; ++i) {
                const s = strips[i];
                if (s.data[0] === current) {
                    ring.unshift(s.data[1]);
                    current = s.data[1];
                    strips.splice(i, 1);
                    found = true;
                    break;
                } else if (s.data[1] === current) {
                    ring.unshift(s.data[0]);
                    current = s.data[0];
                    strips.splice(i, 1);
                    found = true;
                    break;
                }
            }
            if (!found) break;
        }
        if (ring.length > 2 && ring[0] === ring[ring.length - 1]) ring.pop();
        for (const idx of ring) component.push(idx);
    }

    // --- Ring orientation and tessellation utilities ---
    isRingCCW(component, vertices, centroidIdx) {
        const ring = component.slice(0, component.length - 1);
        const centroid = vertices[centroidIdx].getPosition();
        const normal = vertices[centroidIdx].getNormal();
        let areaNormal = new Vec3(0, 0, 0);
        for (let i = 0; i < ring.length; i++) {
            const v1 = vertices[ring[i]].getPosition().clone().subtract(centroid);
            const v2 = vertices[ring[(i + 1) % ring.length]].getPosition().clone().subtract(centroid);
            areaNormal.x += (v1.y - v2.y) * (v1.z + v2.z);
            areaNormal.y += (v1.z - v2.z) * (v1.x + v2.x);
            areaNormal.z += (v1.x - v2.x) * (v1.y + v2.y);
        }
        return areaNormal.dot(normal) > 0;
    }
    orderComponentCCW(component, vertices) {
        if (component.length < 4) return component;
        const centroidIdx = component[component.length - 1];
        const centroid = vertices[centroidIdx].getPosition();
        const normal = vertices[centroidIdx].getNormal();
        let ring = component.slice(0, component.length - 1);
        let u = new Vec3(1,0,0);
        if (Math.abs(normal.x) > 0.9) u = new Vec3(0,1,0);
        let v = normal.clone().cross(u).normalize();
        u = v.clone().cross(normal).normalize();
        let projected = ring.map(idx => {
            const p = vertices[idx].getPosition().clone().subtract(centroid);
            return [p.dot(u), p.dot(v), idx];
        });
        projected.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
        let ordered = projected.map(p => p[2]);
        return ordered.concat([centroidIdx]);
    }

    // --- Mesh creation ---
    tessellationTraversal(cell, mesh) { 
        if (!cell) return;
        if (cell.getState() === CellState.BRANCH) {
            for (let i = 0; i < 8; i++) {
                this.tessellationTraversal(cell.getChild(i), mesh);
            }
        } else if (cell.getState() === CellState.LEAF) {
            if (this.desiredCells.length > 0 && !this.isInDesired(cell.id)) return;
            const components = cell.getComponents();
            for (const component of components) {
                this.tessellateComponent(component, cell);
            }
        }
    }
    tessellateComponent(component, cell) {
        const numOfInds = component.length;
        if (numOfInds < 3) return;
        
        if (numOfInds === 3) {
            // For triangles, use the original logic that worked correctly
            const v0 = this.vertices[component[0]].getPosition();
            const v1 = this.vertices[component[1]].getPosition();
            const v2 = this.vertices[component[2]].getPosition();
            const a = v1.clone().subtract(v0);
            const b = v2.clone().subtract(v0);
            const geoNormal = a.clone().cross(b).normalize();
            let avgNormal = new Vec3();
            for (let i = 0; i < 3; ++i) avgNormal.add(this.vertices[component[i]].getNormal());
            avgNormal.normalize();
            if (geoNormal.dot(avgNormal) < 0) {
                this.indices.push(component[0], component[2], component[1]);
            } else {
                this.indices.push(component[0], component[1], component[2]);
            }
            return;
        }
        
        // Calculate centroid position and normal
        let centroidPos = new Vec3();
        let centroidNormal = new Vec3();
        for (const idx of component) {
            centroidPos.add(this.vertices[idx].getPosition());
            centroidNormal.add(this.vertices[idx].getNormal());
        }
        centroidPos.divide(numOfInds);
        centroidNormal.normalize();
        
        // Apply centroid snapping if enabled
        if (this.snapCentroid) {
            // Get the function value at the centroid
            const medVal = this.fn.evaluate(centroidPos.x, centroidPos.y, centroidPos.z);
            
            // Use the normalized centroid normal directly
            // Scale by the function value to move to the isosurface
            centroidPos.subtract(centroidNormal.clone().scale(medVal));
            
            // No iterative refinement as requested
        }
        
        // Create centroid vertex
        const centroid = new Vertex(centroidPos, centroidNormal);
        centroid.cellId = cell.id;
        this.vertices.push(centroid);
        const centroidIdx = this.vertices.length - 1;
        
        // Use the original winding order logic
        let minIdx = 0;
        for (let i = 1; i < component.length; i++) {
            if (component[i] < component[minIdx]) minIdx = i;
        }
        let ring = component.slice(minIdx).concat(component.slice(0, minIdx));
        if (!this.isRingCCW(ring.concat([centroidIdx]), this.vertices, centroidIdx)) {
            ring.reverse();
        }
        
        // Create triangles
        for (let i = 0; i < ring.length; i++) {
            const next = (i + 1) % ring.length;
            this.indices.push(centroidIdx, ring[i], ring[next]);
        }
    }
    createMesh(mesh) {
        mesh.clear();
        for (const vertex of this.vertices) {
            const pos = vertex.getPosition();
            const normal = vertex.getNormal();
            mesh.pushVertex(pos.x, pos.y, pos.z);
            mesh.pushNormal(normal.x, normal.y, normal.z);
        }
        for (const idx of this.indices) {
            mesh.pushIndex(idx);
        }
    }

    // --- Debug/utility ---
    isInDesired(id) { return this.desiredCells.includes(id); }
    fixDesiredChildren() { const temp = [...this.desiredCells]; for (const id of temp) { const cell = this.octree.getCellAt(id); if (cell.getState() === CellState.BRANCH) { this.traverseForDesired(cell); } } }
    traverseForDesired(cell) { if (!cell) return; if (cell.getState() === CellState.BRANCH) { for (let i = 0; i < 8; i++) { this.traverseForDesired(cell.getChild(i)); } } else if (cell.getState() === CellState.LEAF) { this.desiredCells.push(cell.id); } }
    exportOctreeToOBJ(filename, justLeafs = true) {  let obj = "# CMS Octree Export\n"; obj += "# Generated by Cubical Marching Squares\n\n"; const cells = this.octree.getAllCells(); let vertexCount = 0; for (const cell of cells) { if ((justLeafs && cell.getState() === CellState.LEAF) || !justLeafs) { const center = cell.getCentre(); const width = cell.getWidth() / 2; const height = cell.getHeight() / 2; const depth = cell.getDepth() / 2; obj += `v ${center.x - width} ${center.y - height} ${center.z - depth}\n`; obj += `v ${center.x - width} ${center.y - height} ${center.z + depth}\n`; obj += `v ${center.x - width} ${center.y + height} ${center.z - depth}\n`; obj += `v ${center.x - width} ${center.y + height} ${center.z + depth}\n`; obj += `v ${center.x + width} ${center.y - height} ${center.z - depth}\n`; obj += `v ${center.x + width} ${center.y - height} ${center.z + depth}\n`; obj += `v ${center.x + width} ${center.y + height} ${center.z - depth}\n`; obj += `v ${center.x + width} ${center.y + height} ${center.z + depth}\n`; vertexCount += 8; } } let cellCount = 0; for (const cell of cells) { if ((justLeafs && cell.getState() === CellState.LEAF) || !justLeafs) { const base = cellCount * 8 + 1; obj += `f ${base} ${base+2} ${base+3} ${base+1}\n`; obj += `f ${base+4} ${base+5} ${base+7} ${base+6}\n`; obj += `f ${base} ${base+1} ${base+5} ${base+4}\n`; obj += `f ${base+2} ${base+6} ${base+7} ${base+3}\n`; obj += `f ${base} ${base+4} ${base+6} ${base+2}\n`; obj += `f ${base+1} ${base+3} ${base+7} ${base+5}\n`; cellCount++; } } Utils.downloadTextFile(filename, obj); return true; }
    getStatistics() {
        return {
            samples: {
                x: this.samples.x,
                y: this.samples.y,
                z: this.samples.z
            },
            octree: {
                minLevel: this.octMinLvl,
                maxLevel: this.octMaxLvl,
                leafCells: this.octree ? this.octree.leafCells.length : 0,
                totalCells: this.octree ? this.octree.cells.length : 0
            },
            mesh: {
                vertices: this.vertices.length,
                triangles: this.indices.length / 3
            },
            parameters: {
                zeroApproximation: this.zeroApproximation,
                complexSurfThresh: this.complexSurfThresh,
                snapCentroid: this.snapCentroid
            }
        };
    }
}