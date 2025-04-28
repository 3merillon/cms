/**
 * Mesh class for storing and manipulating 3D meshes.
 */
class Mesh {
    constructor() {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
    }

    /**
     * Clear all mesh data.
     */
    clear() {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
    }

    /**
     * Number of vertices.
     * @returns {number}
     */
    vertexCount() {
        return this.vertices.length / 3;
    }

    /**
     * Number of indices.
     * @returns {number}
     */
    indexCount() {
        return this.indices.length;
    }

    /**
     * Number of faces (triangles).
     * @returns {number}
     */
    faceCount() {
        return this.indices.length / 3;
    }

    /**
     * Add a vertex.
     */
    pushVertex(x, y, z) {
        this.vertices.push(x, y, z);
    }

    /**
     * Add a normal.
     */
    pushNormal(x, y, z) {
        this.normals.push(x, y, z);
    }

    /**
     * Add an index.
     */
    pushIndex(index) {
        this.indices.push(index);
    }

    /**
     * Compute the bounding box.
     * @returns {{min: number[], max: number[]}}
     */
    getBoundingBox() {
        if (this.vertices.length === 0) {
            return { min: [0, 0, 0], max: [0, 0, 0] };
        }
        const min = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
        const max = [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE];
        for (let i = 0; i < this.vertices.length; i += 3) {
            const x = this.vertices[i], y = this.vertices[i + 1], z = this.vertices[i + 2];
            min[0] = Math.min(min[0], x);
            min[1] = Math.min(min[1], y);
            min[2] = Math.min(min[2], z);
            max[0] = Math.max(max[0], x);
            max[1] = Math.max(max[1], y);
            max[2] = Math.max(max[2], z);
        }
        return { min, max };
    }

    /**
     * Export mesh as OBJ format string.
     * @returns {string}
     */
    exportOBJ() {
        let obj = "# Exported with Cubical Marching Squares\n";
        obj += "# Vertices: " + this.vertexCount() + "\n";
        obj += "# Faces: " + this.faceCount() + "\n\n";
        for (let i = 0; i < this.vertices.length; i += 3) {
            obj += `v ${this.vertices[i]} ${this.vertices[i+1]} ${this.vertices[i+2]}\n`;
        }
        for (let i = 0; i < this.normals.length; i += 3) {
            obj += `vn ${this.normals[i]} ${this.normals[i+1]} ${this.normals[i+2]}\n`;
        }
        for (let i = 0; i < this.indices.length; i += 3) {
            const i1 = this.indices[i] + 1;
            const i2 = this.indices[i+1] + 1;
            const i3 = this.indices[i+2] + 1;
            obj += `f ${i1}//${i1} ${i2}//${i2} ${i3}//${i3}\n`;
        }
        return obj;
    }

    /**
     * Create WebGL buffers for the mesh.
     * @param {WebGLRenderingContext} gl
     * @returns {Object}
     */
    createBuffers(gl) {
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);

        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.normals), gl.STATIC_DRAW);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.indices), gl.STATIC_DRAW);

        return {
            vertices: vertexBuffer,
            normals: normalBuffer,
            indices: indexBuffer,
            vertexCount: this.vertices.length / 3,
            indexCount: this.indices.length
        };
    }
}