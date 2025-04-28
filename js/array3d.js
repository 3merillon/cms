/**
 * 3D Array class for storing data in a 3D grid.
 */
class Array3D {
    /**
     * Construct a 3D array.
     * @param {*} defaultValue - Default value for all elements (optional)
     */
    constructor(defaultValue = null) {
        this.data = [];
        this.indices = new Index3D(1, 1, 1);
        this.bbox = [
            new Range(-1, 1),
            new Range(-1, 1),
            new Range(-1, 1)
        ];
        this.defaultValue = defaultValue;
        this.resize(1, 1, 1);
    }

    /**
     * Total number of elements.
     * @returns {number}
     */
    size() {
        return this.data.length;
    }

    sizeX() { return this.indices.x; }
    sizeY() { return this.indices.y; }
    sizeZ() { return this.indices.z; }

    /**
     * Resize the array.
     */
    resize(xSize, ySize, zSize) {
        this.indices.x = xSize;
        this.indices.y = ySize;
        this.indices.z = zSize;
        const totalSize = xSize * ySize * zSize;
        this.data = new Array(totalSize);
        if (this.defaultValue !== null) this.data.fill(this.defaultValue);
    }

    /**
     * Resize using an Index3D.
     */
    resizeWithIndex(indices) {
        this.resize(indices.x, indices.y, indices.z);
    }

    /**
     * Set the bounding box.
     */
    setBBox(bbox) {
        for (let i = 0; i < 3; i++) this.bbox[i] = bbox[i];
    }

    /**
     * Get 1D array index for a 3D position.
     */
    getIndexAt(x, y, z) {
        if (typeof x === 'object') {
            return (x.x * this.indices.y + x.y) * this.indices.z + x.z;
        } else {
            return (x * this.indices.y + y) * this.indices.z + z;
        }
    }

    /**
     * Get value at position (x, y, z) or Index3D.
     */
    getValueAt(x, y, z) {
        let index;
        if (typeof x === 'object') {
            if (x.x >= this.indices.x || x.y >= this.indices.y || x.z >= this.indices.z ||
                x.x < 0 || x.y < 0 || x.z < 0) {
                return undefined;
            }
            index = (x.x * this.indices.y + x.y) * this.indices.z + x.z;
        } else {
            if (x >= this.indices.x || y >= this.indices.y || z >= this.indices.z ||
                x < 0 || y < 0 || z < 0) {
                return undefined;
            }
            index = (x * this.indices.y + y) * this.indices.z + z;
        }
        return this.data[index];
    }

    /**
     * Set value at position (x, y, z) or Index3D.
     */
    setValueAt(x, y, z, value) {
        let index;
        if (typeof x === 'object') {
            if (x.x >= this.indices.x || x.y >= this.indices.y || x.z >= this.indices.z ||
                x.x < 0 || x.y < 0 || x.z < 0) {
                return;
            }
            index = (x.x * this.indices.y + x.y) * this.indices.z + x.z;
        } else {
            if (x >= this.indices.x || y >= this.indices.y || z >= this.indices.z ||
                x < 0 || y < 0 || z < 0) {
                return;
            }
            index = (x * this.indices.y + y) * this.indices.z + z;
        }
        this.data[index] = value;
    }

    /**
     * Get the real-space position for a grid coordinate.
     * @returns {Vec3}
     */
    getPositionAt(x, y, z) {
        let xIdx, yIdx, zIdx;
        if (typeof x === 'object') {
            xIdx = x.x; yIdx = x.y; zIdx = x.z;
        } else {
            xIdx = x; yIdx = y; zIdx = z;
        }
        const tx = xIdx / (this.indices.x - 1);
        const ty = yIdx / (this.indices.y - 1);
        const tz = zIdx / (this.indices.z - 1);
        const px = this.bbox[0].lower + (this.bbox[0].upper - this.bbox[0].lower) * tx;
        const py = this.bbox[1].lower + (this.bbox[1].upper - this.bbox[1].lower) * ty;
        const pz = this.bbox[2].lower + (this.bbox[2].upper - this.bbox[2].lower) * tz;
        return new Vec3(px, py, pz);
    }
}