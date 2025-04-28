/**
 * Constants and tables for the CMS algorithm.
 */

// Face twin table
const FACE_TWIN_TABLE = [
    [0, 1], [1, 0], [2, 3], [3, 2], [4, 5], [5, 4], [6, 6]
];

// Face relationship table
const FACE_RELATIONSHIP_TABLE = [
    [[0, 2, 4], [0, 0, 0]],
    [[1, 2, 4], [0, 1, 1]],
    [[0, 3, 4], [1, 0, 2]],
    [[1, 3, 4], [1, 1, 3]],
    [[0, 2, 5], [2, 2, 0]],
    [[1, 2, 5], [2, 3, 1]],
    [[0, 3, 5], [3, 2, 2]],
    [[1, 3, 5], [3, 3, 3]]
];

// Edge direction, neighbor address, face vertex, edge vertices, edge map, vertex map tables (unchanged from your code)
const EDGE_DIRECTION = [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 2, 2];
const NEIGHBOR_ADDRESS_TABLE = [
    [2, 1, 4, 3, 6, 5, 8, 7],
    [3, 4, 1, 2, 7, 8, 5, 6],
    [5, 6, 7, 8, 1, 2, 3, 4]
];
const FACE_VERTEX = [
    [2, 0, 6, 4], [1, 3, 5, 7], [0, 1, 4, 5], [6, 7, 2, 3], [2, 3, 0, 1], [4, 5, 6, 7]
];
const EDGE_VERTICES = [
    [2, 6], [0, 4], [0, 2], [4, 6], [1, 5], [3, 7], [1, 3], [5, 7], [0, 1], [4, 5], [2, 3], [6, 7]
];
const EDGE_MAP = [
    [[-1, -1], [-1, -1]], [[0, 2], [-1, -1]], [[2, 1], [-1, -1]], [[0, 1], [-1, -1]],
    [[3, 0], [-1, -1]], [[3, 2], [-1, -1]], [[3, 0], [2, 1]], [[3, 1], [-1, -1]],
    [[1, 3], [-1, -1]], [[1, 3], [0, 2]], [[2, 3], [-1, -1]], [[0, 3], [-1, -1]],
    [[1, 0], [-1, -1]], [[1, 2], [-1, -1]], [[2, 0], [-1, -1]], [[-1, -1], [-1, -1]]
];
const VERTEX_MAP = [
    [0, 2], [3, 1], [0, 1], [2, 3]
];

/**
 * Octree for CMS algorithm.
 */
class Octree {
    constructor(samples, sampleData, minLvl, maxLvl, offsets, fn, complexSurfThresh) {
        this.samples = samples;
        this.sampleData = sampleData;
        this.minLvl = minLvl;
        this.maxLvl = maxLvl;
        this.offsets = offsets;
        this.fn = fn;
        this.complexSurfThresh = complexSurfThresh;
        this.root = null;
        this.cells = [];
        this.leafCells = [];
        this.cellAddresses = new Map();
    }

    /**
     * Build the octree structure and relationships.
     */
    buildOctree() {
        this.makeStructure();
        this.populateHalfFaces();
        this.setFaceRelationships();
        this.markTransitionalFaces();
    }

    /**
     * Create the octree cell structure.
     */
    makeStructure() {
        const c000 = new Index3D(0, 0, 0);
        const offsets = new Index3D(this.samples.x - 1, this.samples.y - 1, this.samples.z - 1);
        this.root = new Cell(0, CellState.BRANCH, null, 0, c000, offsets, 0);
        this.cells.push(this.root);
        this.acquireCellInfo(this.root);
        this.subdivideCell(this.root);
    }

    /**
     * Fill cell's geometric info.
     */
    acquireCellInfo(cell) {
        const c000 = cell.getC000();
        const offsets = cell.getOffsets();
        const ptIndices = [
            new Index3D(c000.x, c000.y, c000.z),
            new Index3D(c000.x, c000.y, c000.z + offsets.z),
            new Index3D(c000.x, c000.y + offsets.y, c000.z),
            new Index3D(c000.x, c000.y + offsets.y, c000.z + offsets.z),
            new Index3D(c000.x + offsets.x, c000.y, c000.z),
            new Index3D(c000.x + offsets.x, c000.y, c000.z + offsets.z),
            new Index3D(c000.x + offsets.x, c000.y + offsets.y, c000.z),
            new Index3D(c000.x + offsets.x, c000.y + offsets.y, c000.z + offsets.z)
        ];
        for (let i = 0; i < 8; i++) {
            if (ptIndices[i].x >= this.samples.x) ptIndices[i].x = this.samples.x - 1;
            if (ptIndices[i].y >= this.samples.y) ptIndices[i].y = this.samples.y - 1;
            if (ptIndices[i].z >= this.samples.z) ptIndices[i].z = this.samples.z - 1;
        }
        cell.setPointInds(ptIndices);
        const pos0 = this.sampleData.getPositionAt(ptIndices[0]);
        const pos7 = this.sampleData.getPositionAt(ptIndices[7]);
        cell.x.set(pos0.x, pos7.x);
        cell.y.set(pos0.y, pos7.y);
        cell.z.set(pos0.z, pos7.z);
        const width = cell.x.upper - cell.x.lower;
        const height = cell.y.upper - cell.y.lower;
        const depth = cell.z.upper - cell.z.lower;
        cell.setWidth(width);
        cell.setHeight(height);
        cell.setDepth(depth);
        const center = new Vec3(
            pos0.x + width / 2,
            pos0.y + height / 2,
            pos0.z + depth / 2
        );
        cell.setCentre(center);
    }

    /**
     * Recursively subdivide a cell.
     */
    subdivideCell(parent) {
        const parLvl = parent.getSubdivLvl();
        const thisLvl = parLvl + 1;
        const offsets = new Index3D(
            Math.floor((this.samples.x - 1) / Utils.getPowerOfTwo(thisLvl)),
            Math.floor((this.samples.y - 1) / Utils.getPowerOfTwo(thisLvl)),
            Math.floor((this.samples.z - 1) / Utils.getPowerOfTwo(thisLvl))
        );
        const parIndX = parent.getC000().x;
        const parIndY = parent.getC000().y;
        const parIndZ = parent.getC000().z;
        for (let i = 0; i < 8; i++) {
            let c000 = new Index3D();
            switch (i) {
                case 0: c000.x = parIndX; c000.y = parIndY; c000.z = parIndZ; break;
                case 1: c000.x = parIndX; c000.y = parIndY; c000.z = parIndZ + offsets.z; break;
                case 2: c000.x = parIndX; c000.y = parIndY + offsets.y; c000.z = parIndZ; break;
                case 3: c000.x = parIndX; c000.y = parIndY + offsets.y; c000.z = parIndZ + offsets.z; break;
                case 4: c000.x = parIndX + offsets.x; c000.y = parIndY; c000.z = parIndZ; break;
                case 5: c000.x = parIndX + offsets.x; c000.y = parIndY; c000.z = parIndZ + offsets.z; break;
                case 6: c000.x = parIndX + offsets.x; c000.y = parIndY + offsets.y; c000.z = parIndZ; break;
                case 7: c000.x = parIndX + offsets.x; c000.y = parIndY + offsets.y; c000.z = parIndZ + offsets.z; break;
            }
            const cell = new Cell(
                this.cells.length,
                CellState.BRANCH,
                parent,
                thisLvl,
                c000,
                offsets,
                i
            );
            this.cells.push(cell);
            this.acquireCellInfo(cell);
            parent.pushChild(cell, i);
            if (thisLvl < this.minLvl) {
                this.subdivideCell(cell);
            } else if (thisLvl >= this.minLvl && thisLvl < this.maxLvl) {
                if (this.checkForSubdivision(cell)) {
                    this.subdivideCell(cell);
                } else if (this.checkForSurface(cell)) {
                    cell.setState(CellState.LEAF);
                    this.leafCells.push(cell);
                }
            } else {
                if (this.checkForSurface(cell)) {
                    cell.setState(CellState.LEAF);
                    this.leafCells.push(cell);
                }
            }
            this.cellAddresses.set(cell.address.getFormatted(), cell);
        }
    }

    /**
     * Check if a cell should be subdivided.
     */
    checkForSubdivision(cell) {
        return this.checkForEdgeAmbiguity(cell) || this.checkForComplexSurface(cell);
    }

    /**
     * Check if a cell contains a surface.
     */
    checkForSurface(cell) {
        const points = cell.getPointInds();
        let inside = 0;
        for (let i = 0; i < 8; i++) {
            if (this.sampleData.getValueAt(points[i]) < 0) inside++;
        }
        return inside !== 0 && inside !== 8;
    }

    /**
     * Check for edge ambiguity.
     */
    checkForEdgeAmbiguity(cell) {
        const indPtr = cell.getPointInds();
        for (let i = 0; i < 12; i++) {
            const cellPtA = EDGE_VERTICES[i][0];
            const cellPtB = EDGE_VERTICES[i][1];
            const ptA = indPtr[cellPtA];
            const ptB = indPtr[cellPtB];
            const edgeDirection = EDGE_DIRECTION[i];
            let prevIndex = ptA.clone();
            let crossingPoints = 0;
            const index = ptA.clone();
            while (index.get(edgeDirection) <= ptB.get(edgeDirection)) {
                if (this.sampleData.getValueAt(prevIndex) * this.sampleData.getValueAt(index) < 0) {
                    crossingPoints++;
                }
                if (crossingPoints > 1) return true;
                prevIndex = index.clone();
                index.set(edgeDirection, index.get(edgeDirection) + 1);
            }
        }
        return false;
    }

    /**
     * Check for complex surface (angle between normals).
     */
    checkForComplexSurface(cell) {
        const points = cell.getPointInds();
        for (let i = 0; i < 7; i++) {
            const indA = points[i];
            const normalA = new Vec3();
            this.findGradient(normalA, indA);
            normalA.normalize();
            for (let j = i + 1; j < 8; j++) {
                const indB = points[j];
                const normalB = new Vec3();
                this.findGradient(normalB, indB);
                normalB.normalize();
                if (normalA.dot(normalB) < this.complexSurfThresh) return true;
            }
        }
        return false;
    }

    /**
     * Estimate gradient at a cell corner.
     */
    findGradient(gradient, indices) {
        const pos = this.sampleData.getPositionAt(indices);
        const dimensions = new Vec3(this.offsets.x / 2, this.offsets.y / 2, this.offsets.z / 2);
        const val = this.sampleData.getValueAt(indices);
        const dx = this.fn.evaluate(pos.x + dimensions.x, pos.y, pos.z);
        const dy = this.fn.evaluate(pos.x, pos.y + dimensions.y, pos.z);
        const dz = this.fn.evaluate(pos.x, pos.y, pos.z + dimensions.z);
        gradient.set(dx - val, dy - val, dz - val);
    }

    /**
     * Find neighbors for a cell and set face twins.
     */
    findNeighbours(cellA) {
        const tempAddress = new Array(6).fill().map(() => new Address(this.maxLvl));
        const tempNeighbourAddress = new Array(6).fill().map(() => new Array(this.maxLvl).fill(0));
        for (let i = 0; i < 6; i++) {
            let sameParent = false;
            for (let slot = this.maxLvl - 1; slot >= 0; slot--) {
                if (sameParent) {
                    tempNeighbourAddress[i][slot] = cellA.address.getRaw()[slot];
                } else {
                    const slotVal = cellA.address.getRaw()[slot];
                    const axis = Math.floor(i / 2);
                    if (slotVal === 0) {
                        tempNeighbourAddress[i][slot] = 0;
                    } else {
                        tempNeighbourAddress[i][slot] = NEIGHBOR_ADDRESS_TABLE[axis][slotVal - 1];
                    }
                    if ((i % 2 !== 0 && slotVal < tempNeighbourAddress[i][slot]) ||
                        (i % 2 === 0 && slotVal > tempNeighbourAddress[i][slot])) {
                        sameParent = true;
                    }
                }
            }
            tempAddress[i].rawAddress = [...tempNeighbourAddress[i]];
        }
        for (let i = 0; i < 6; i++) {
            const addressKey = tempAddress[i].getFormatted();
            const cellB = this.cellAddresses.get(addressKey);
            if (cellB) {
                const contact = i;
                if (i % 2 === 0) {
                    cellA.neighbours[contact + 1] = cellB;
                } else {
                    cellA.neighbours[contact - 1] = cellB;
                }
                this.setFaceTwins(cellB, cellA, contact);
            }
        }
    }

    /**
     * Populate all half-faces and neighbors.
     */
    populateHalfFaces() {
        for (const cell of this.cells) this.findNeighbours(cell);
    }

    /**
     * Set face twins between two cells.
     */
    setFaceTwins(a, b, contact) {
        const valA = FACE_TWIN_TABLE[contact][0];
        const valB = FACE_TWIN_TABLE[contact][1];
        b.getFaceAt(valA).twin = a.getFaceAt(valB);
        a.getFaceAt(valB).twin = b.getFaceAt(valA);
    }

    /**
     * Set face relationships between parent and child cells.
     */
    setFaceRelationships() {
        for (const cell of this.cells) {
            if (!cell) continue;
            const location = cell.getPosInParent();
            if (cell.getParent() === null) continue;
            for (let side = 0; side < 3; side++) {
                const con = FACE_RELATIONSHIP_TABLE[location][0][side];
                const posOfSubFace = FACE_RELATIONSHIP_TABLE[location][1][side];
                cell.getFaceAt(con).parent = cell.getParent().getFaceAt(con);
                cell.getParent().getFaceAt(con).children[posOfSubFace] = cell.getFaceAt(con);
            }
            if (cell.getState() === CellState.LEAF) {
                for (let i = 0; i < 6; i++) cell.getFaceAt(i).state = FaceState.LEAF_FACE;
            }
        }
    }

    /**
     * Mark transitional faces for adaptivity.
     */
    markTransitionalFaces() {
        for (const cell of this.leafCells) {
            for (let j = 0; j < 6; j++) {
                const face = cell.getFaceAt(j);
                if (face.twin && face.twin.children[0]) {
                    face.state = FaceState.TRANSIT_FACE;
                }
            }
        }
    }

    getRoot() { return this.root; }
    getAllCells() { return this.cells; }
    getCellAt(index) { return this.cells[index]; }
}