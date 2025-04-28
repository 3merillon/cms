/**
 * Core data types for the CMS algorithm.
 */

/**
 * 3D vector of floats.
 */
class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
    }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new Vec3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    subtract(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    scale(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    divide(s) { if (Math.abs(s) > EPSILON) { this.x /= s; this.y /= s; this.z /= s; } return this; }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    cross(v) {
        const x = this.y * v.z - this.z * v.y;
        const y = this.z * v.x - this.x * v.z;
        const z = this.x * v.y - this.y * v.x;
        this.x = x; this.y = y; this.z = z; return this;
    }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
    lengthSquared() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    normalize() { const len = this.length(); if (len > EPSILON) { this.x /= len; this.y /= len; this.z /= len; } return this; }
    equals(v) { return Utils.fCompare(this.x, v.x) && Utils.fCompare(this.y, v.y) && Utils.fCompare(this.z, v.z); }
    toArray() { return [this.x, this.y, this.z]; }
    fromArray(arr) { this.x = arr[0]; this.y = arr[1]; this.z = arr[2]; return this; }
}

/**
 * 3D integer index.
 */
class Index3D {
    constructor(x = -1, y = -1, z = -1) { this.x = x; this.y = y; this.z = z; }
    get(i) { return [this.x, this.y, this.z][i]; }
    set(i, value) { if (i === 0) this.x = value; else if (i === 1) this.y = value; else if (i === 2) this.z = value; else throw new Error("Invalid index"); }
    copy(idx) { this.x = idx.x; this.y = idx.y; this.z = idx.z; return this; }
    clone() { return new Index3D(this.x, this.y, this.z); }
    add(val) { if (typeof val === 'number') { this.x += val; this.y += val; this.z += val; } else { this.x += val.x; this.y += val.y; this.z += val.z; } return this; }
    subtract(val) { if (typeof val === 'number') { this.x -= val; this.y -= val; this.z -= val; } else { this.x -= val.x; this.y -= val.y; this.z -= val.z; } return this; }
    equals(idx) { return this.x === idx.x && this.y === idx.y && this.z === idx.z; }
    toArray() { return [this.x, this.y, this.z]; }
}

/**
 * Min-max range.
 */
class Range {
    constructor(lower = 0, upper = 0) {
        this.lower = lower; this.upper = upper;
        if (this.lower > this.upper) [this.lower, this.upper] = [this.upper, this.lower];
    }
    set(lower, upper) {
        this.lower = lower; this.upper = upper;
        if (this.lower > this.upper) [this.lower, this.upper] = [this.upper, this.lower];
    }
    contains(value) { return value >= this.lower && value <= this.upper; }
    size() { return this.upper - this.lower; }
    clone() { return new Range(this.lower, this.upper); }
}

/**
 * Scalar field sample (position, value, optional gradient).
 */
class Point {
    constructor(position = new Vec3(), value = 0, gradient = null) {
        this.position = position;
        this.value = value;
        this.gradient = gradient;
    }
    setPosition(position) { this.position = position; }
    getPosition() { return this.position; }
    setValue(value) { this.value = value; }
    getValue() { return this.value; }
    setGradient(gradient) { this.gradient = gradient; }
    getGradient() { return this.gradient; }
}

/**
 * Vertex with position and normal.
 */
class Vertex {
    constructor(position = new Vec3(), normal = new Vec3()) {
        this.position = position;
        this.normal = normal;
    }
    setPosition(position) { this.position.copy(position); }
    getPosition() { return this.position; }
    setNormal(normal) { this.normal.copy(normal); }
    getNormal() { return this.normal; }
    clone() { return new Vertex(this.position.clone(), this.normal.clone()); }
}

/**
 * Edge block for storing edge indices.
 */
class EdgeBlock {
    constructor(empty = true, x = -1, y = -1, z = -1) {
        this.empty = empty;
        this.edgeIndices = new Index3D(x, y, z);
    }
}

/**
 * Strip for CMS face segmentation.
 */
class Strip {
    constructor(skip = true, edge0 = -1, edge1 = -1) {
        this.skip = skip;
        this.loop = false;
        this.edge = [edge0, edge1];
        this.data = [-1, -1];
        this.dir = [-1, -1];
        this.block = [new Index3D(), new Index3D()];
    }
    changeBack(s, i) {
        this.edge[1] = s.edge[i];
        this.data[1] = s.data[i];
        this.dir[1] = s.dir[i];
        this.block[1].copy(s.block[i]);
    }
    changeFront(s, i) {
        this.edge[0] = s.edge[i];
        this.data[0] = s.data[i];
        this.dir[0] = s.dir[i];
        this.block[0].copy(s.block[i]);
    }
}

// Face and cell state enums
const FaceState = { BRANCH_FACE: 0, LEAF_FACE: 1, TRANSIT_FACE: 2 };
const CellState = { BRANCH: 0, LEAF: 1 };
const Contact = { BACK: 0, FRONT: 1, BOTTOM: 2, TOP: 3, LEFT: 4, RIGHT: 5, NONE: 6 };

/**
 * Octree face (half-face).
 */
class Face {
    constructor(id, cellInd) {
        this.id = id;
        this.cellInd = cellInd;
        this.skip = true;
        this.state = FaceState.BRANCH_FACE;
        this.sharpFeature = false;
        this.featurePosition = new Vec3();
        this.twin = null;
        this.parent = null;
        this.children = [null, null, null, null];
        this.strips = [];
        this.transitSegs = [];
    }
}

/**
 * Octree address.
 */
class Address {
    constructor(maxDepth = 8) {
        this.maxDepth = maxDepth;
        this.rawAddress = new Array(maxDepth).fill(0);
    }
    reset() { this.rawAddress.fill(0); }
    set(parentAddress, posInParent) {
        for (let i = 0; i < this.maxDepth; i++) {
            if (parentAddress[i] !== 0) this.rawAddress[i] = parentAddress[i];
            else { this.rawAddress[i] = posInParent + 1; break; }
        }
    }
    getFormatted() {
        let result = 0;
        for (let i = this.maxDepth - 1; i >= 0; i--) {
            if (this.rawAddress[i]) result += this.rawAddress[i] * Math.pow(10, i);
        }
        return result;
    }
    getRaw() { return this.rawAddress; }
    clone() { const addr = new Address(this.maxDepth); addr.rawAddress = [...this.rawAddress]; return addr; }
}

/**
 * Octree cell.
 */
class Cell {
    constructor(id, state, parent, subdivLvl, c000, offsets, posInParent) {
        this.id = id;
        this.state = state;
        this.parent = parent;
        this.subdivLvl = subdivLvl;
        this.c000 = c000;
        this.offsets = offsets;
        this.posInParent = posInParent;
        this.centre = new Vec3();
        this.width = 0;
        this.height = 0;
        this.depth = 0;
        this.x = new Range();
        this.y = new Range();
        this.z = new Range();
        this.pointInds = new Array(8).fill().map(() => new Index3D());
        this.children = new Array(8).fill(null);
        this.faces = new Array(6).fill(null);
        this.neighbours = new Array(6).fill(null);
        this.components = [];
        this.address = new Address();
        if (parent) this.address.set(parent.address.getRaw(), posInParent);
        else this.address.reset();
        for (let i = 0; i < 6; i++) this.faces[i] = new Face(i, id);
    }
    getFaceAt(position) { return this.faces[position]; }
    getChild(index) { return this.children[index]; }
    pushChild(child, index) { this.children[index] = child; }
    pushComponent(comp) { this.components.push([...comp]); }
    getComponents() { return this.components; }
    getState() { return this.state; }
    setState(state) { this.state = state; }
    getParent() { return this.parent; }
    getSubdivLvl() { return this.subdivLvl; }
    getC000() { return this.c000; }
    getOffsets() { return this.offsets; }
    getPointInds() { return this.pointInds; }
    setPointInds(indices) { for (let i = 0; i < 8; i++) this.pointInds[i].copy(indices[i]); }
    getCentre() { return this.centre; }
    setCentre(centre) { this.centre.copy(centre); }
    getWidth() { return this.width; }
    setWidth(width) { this.width = width; }
    getHeight() { return this.height; }
    setHeight(height) { this.height = height; }
    getDepth() { return this.depth; }
    setDepth(depth) { this.depth = depth; }
    getPosInParent() { return this.posInParent; }
}