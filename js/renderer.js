class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');
        if (!this.gl) {
            alert('WebGL 2 not supported. Please use a modern browser.');
            return;
        }
        this.initGL();
        this.createShaders();
        this.meshBuffer = null;
        this.wireframeBuffer = null;
        this.octreeBuffer = null;
        this.normalsLineBuffer = null;
        this.showWireframe = false;
        this.showNormals = false;
        this.showOctree = false;
        this.enableBackfaceCulling = true;
        this.enableTexturing = false;
        this.stats = { vertices: 0, triangles: 0, cells: 0 };

        this.triplanarTiling = 2.0;
        this.groundColorTex = null;
        this.groundNormalTex = null;
        this.triplanarTexturesLoaded = false;
        this.loadTriplanarTextures();
    }

    loadTriplanarTextures() {
        const gl = this.gl;
        this.groundColorTex = gl.createTexture();
        this.groundNormalTex = gl.createTexture();
        let loaded = 0;
        const onLoad = () => {
            loaded++;
            if (loaded === 2) {
                this.triplanarTexturesLoaded = true;
            }
        };
        const imgC = new window.Image();
        imgC.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, this.groundColorTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgC);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.generateMipmap(gl.TEXTURE_2D);
            onLoad();
        };
        imgC.src = 'assets/ground_c.jpg';
        const imgN = new window.Image();
        imgN.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, this.groundNormalTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgN);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.generateMipmap(gl.TEXTURE_2D);
            onLoad();
        };
        imgN.src = 'assets/ground_nm.jpg';
    }

    initGL() {
        const gl = this.gl;
        this.resizeCanvas();
        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CCW);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
    }

    resizeCanvas() {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    createShaders() {
        const gl = this.gl;
        this.meshProgram = this.createShaderProgram(meshVertexShaderSource, meshFragmentShaderSource);
        this.wireframeProgram = this.createShaderProgram(wireframeVertexShaderSource, wireframeFragmentShaderSource);
        this.normalLineProgram = this.createShaderProgram(normalLineVertexShaderSource, normalLineFragmentShaderSource);
        this.octreeProgram = this.createShaderProgram(octreeVertexShaderSource, octreeFragmentShaderSource);

        this.meshUniforms = {
            projectionMatrix: gl.getUniformLocation(this.meshProgram, 'uProjectionMatrix'),
            viewMatrix: gl.getUniformLocation(this.meshProgram, 'uViewMatrix'),
            modelMatrix: gl.getUniformLocation(this.meshProgram, 'uModelMatrix'),
            normalMatrix: gl.getUniformLocation(this.meshProgram, 'uNormalMatrix'),
            lightViewDir: gl.getUniformLocation(this.meshProgram, 'uLightViewDir'),
            normalOffset: gl.getUniformLocation(this.meshProgram, 'uNormalOffset'),
            lightColor: gl.getUniformLocation(this.meshProgram, 'uLightColor'),
            ambientColor: gl.getUniformLocation(this.meshProgram, 'uAmbientColor'),
            diffuseColor: gl.getUniformLocation(this.meshProgram, 'uDiffuseColor')
        };
        this.meshAttribs = {
            position: gl.getAttribLocation(this.meshProgram, 'aPosition'),
            normal: gl.getAttribLocation(this.meshProgram, 'aNormal')
        };
        this.wireframeUniforms = {
            projectionMatrix: gl.getUniformLocation(this.wireframeProgram, 'uProjectionMatrix'),
            viewMatrix: gl.getUniformLocation(this.wireframeProgram, 'uViewMatrix'),
            modelMatrix: gl.getUniformLocation(this.wireframeProgram, 'uModelMatrix'),
            color: gl.getUniformLocation(this.wireframeProgram, 'uColor')
        };
        this.wireframeAttribs = {
            position: gl.getAttribLocation(this.wireframeProgram, 'aPosition')
        };
        this.normalLineUniforms = {
            projectionMatrix: gl.getUniformLocation(this.normalLineProgram, 'uProjectionMatrix'),
            viewMatrix: gl.getUniformLocation(this.normalLineProgram, 'uViewMatrix'),
            modelMatrix: gl.getUniformLocation(this.normalLineProgram, 'uModelMatrix')
        };
        this.normalLineAttribs = {
            position: gl.getAttribLocation(this.normalLineProgram, 'aPosition'),
            color: gl.getAttribLocation(this.normalLineProgram, 'aColor')
        };
        this.octreeUniforms = {
            projectionMatrix: gl.getUniformLocation(this.octreeProgram, 'uProjectionMatrix'),
            viewMatrix: gl.getUniformLocation(this.octreeProgram, 'uViewMatrix'),
            modelMatrix: gl.getUniformLocation(this.octreeProgram, 'uModelMatrix'),
            color: gl.getUniformLocation(this.octreeProgram, 'uColor')
        };
        this.octreeAttribs = {
            position: gl.getAttribLocation(this.octreeProgram, 'aPosition')
        };

        // --- TRIPLANAR SHADER ---
        this.meshTriplanarProgram = this.createShaderProgram(meshTriplanarVertexShaderSource, meshTriplanarFragmentShaderSource);
        this.meshTriplanarUniforms = {
            projectionMatrix: gl.getUniformLocation(this.meshTriplanarProgram, 'uProjectionMatrix'),
            viewMatrix: gl.getUniformLocation(this.meshTriplanarProgram, 'uViewMatrix'),
            modelMatrix: gl.getUniformLocation(this.meshTriplanarProgram, 'uModelMatrix'),
            normalMatrix: gl.getUniformLocation(this.meshTriplanarProgram, 'uNormalMatrix'),
            lightViewDir: gl.getUniformLocation(this.meshTriplanarProgram, 'uLightViewDir'),
            normalOffset: gl.getUniformLocation(this.meshTriplanarProgram, 'uNormalOffset'),
            lightColor: gl.getUniformLocation(this.meshTriplanarProgram, 'uLightColor'),
            ambientColor: gl.getUniformLocation(this.meshTriplanarProgram, 'uAmbientColor'),
            diffuseColor: gl.getUniformLocation(this.meshTriplanarProgram, 'uDiffuseColor'),
            triplanarTiling: gl.getUniformLocation(this.meshTriplanarProgram, 'uTriplanarTiling'),
            texColor: gl.getUniformLocation(this.meshTriplanarProgram, 'uTexColor'),
            texNormal: gl.getUniformLocation(this.meshTriplanarProgram, 'uTexNormal')
        };
        this.meshTriplanarAttribs = {
            position: gl.getAttribLocation(this.meshTriplanarProgram, 'aPosition'),
            normal: gl.getAttribLocation(this.meshTriplanarProgram, 'aNormal')
        };
    }

    createShaderProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vsSource);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
            gl.deleteShader(vertexShader);
            return null;
        }
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fsSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader));
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return null;
        }
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Shader program linking error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return null;
        }
        gl.detachShader(program, vertexShader);
        gl.detachShader(program, fragmentShader);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return program;
    }

    setMesh(mesh) {
        const gl = this.gl;
        this.stats.vertices = mesh.vertexCount();
        this.stats.triangles = mesh.faceCount();
        if (mesh.vertices.length === 0 || mesh.indices.length === 0) return;
        this.meshBuffer = {
            vertices: gl.createBuffer(),
            normals: gl.createBuffer(),
            indices: gl.createBuffer(),
            count: mesh.indices.length
        };
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffer.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertices), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffer.normals);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normals), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshBuffer.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mesh.indices), gl.STATIC_DRAW);

        this.createWireframeBuffer(mesh);
        this.createNormalsLineBuffer(mesh);
    }

    createWireframeBuffer(mesh) {
        const gl = this.gl;
        const wireframeIndices = [];
        for (let i = 0; i < mesh.indices.length; i += 3) {
            const i0 = mesh.indices[i];
            const i1 = mesh.indices[i + 1];
            const i2 = mesh.indices[i + 2];
            wireframeIndices.push(i0, i1, i1, i2, i2, i0);
        }
        this.wireframeBuffer = {
            vertices: this.meshBuffer.vertices,
            indices: gl.createBuffer(),
            count: wireframeIndices.length
        };
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wireframeBuffer.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(wireframeIndices), gl.STATIC_DRAW);
    }

    createNormalsLineBuffer(mesh, length = 0.1) {
        const lines = [];
        const colors = [];
        for (let i = 0; i < mesh.vertices.length; i += 3) {
            const x = mesh.vertices[i], y = mesh.vertices[i + 1], z = mesh.vertices[i + 2];
            const nx = mesh.normals[i], ny = mesh.normals[i + 1], nz = mesh.normals[i + 2];
            lines.push(x, y, z);
            colors.push(nx * 0.5 + 0.5, ny * 0.5 + 0.5, nz * 0.5 + 0.5);
            lines.push(x + nx * length, y + ny * length, z + nz * length);
            colors.push(nx * 0.5 + 0.5, ny * 0.5 + 0.5, nz * 0.5 + 0.5);
        }
        const gl = this.gl;
        this.normalsLineBuffer = {
            vertices: gl.createBuffer(),
            colors: gl.createBuffer(),
            count: lines.length / 3
        };
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalsLineBuffer.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalsLineBuffer.colors);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    }

    setOctreeLeafCells(octreeLeafCells) {
        if (!octreeLeafCells) return;
        const gl = this.gl;
        const vertices = [];
        for (const cell of octreeLeafCells) {
            const [x, y, z] = cell.center;
            const halfWidth = cell.width / 2;
            const halfHeight = cell.height / 2;
            const halfDepth = cell.depth / 2;
            const corners = [
                [x - halfWidth, y - halfHeight, z - halfDepth],
                [x - halfWidth, y - halfHeight, z + halfDepth],
                [x - halfWidth, y + halfHeight, z - halfDepth],
                [x - halfWidth, y + halfHeight, z + halfDepth],
                [x + halfWidth, y - halfHeight, z - halfDepth],
                [x + halfWidth, y - halfHeight, z + halfDepth],
                [x + halfWidth, y + halfHeight, z - halfDepth],
                [x + halfWidth, y + halfHeight, z + halfDepth]
            ];
            const edges = [
                [0, 1], [1, 3], [3, 2], [2, 0],
                [4, 5], [5, 7], [7, 6], [6, 4],
                [0, 4], [1, 5], [2, 6], [3, 7]
            ];
            for (const [i, j] of edges) {
                vertices.push(...corners[i], ...corners[j]);
            }
        }
        this.octreeBuffer = {
            vertices: gl.createBuffer(),
            count: vertices.length / 3
        };
        gl.bindBuffer(gl.ARRAY_BUFFER, this.octreeBuffer.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    }

    render(camera) {
        const gl = this.gl;
        this.resizeCanvas();
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (!this.meshBuffer) return;

        if (this.enableBackfaceCulling) {
            gl.enable(gl.CULL_FACE);
        } else {
            gl.disable(gl.CULL_FACE);
        }

        const viewMatrix = camera.getViewMatrix();
        const projectionMatrix = camera.getProjectionMatrix();
        const modelMatrix = glMatrix.mat4.create();
        const normalMatrix = glMatrix.mat3.create();
        const modelViewMatrix = glMatrix.mat4.create();

        glMatrix.mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
        glMatrix.mat3.fromMat4(normalMatrix, modelViewMatrix);
        glMatrix.mat3.invert(normalMatrix, normalMatrix);
        glMatrix.mat3.transpose(normalMatrix, normalMatrix);

        this.renderMesh(projectionMatrix, viewMatrix, modelMatrix, normalMatrix);
        if (this.showWireframe && this.wireframeBuffer) {
            this.renderWireframe(projectionMatrix, viewMatrix, modelMatrix);
        }
        if (this.showNormals && this.normalsLineBuffer) {
            this.renderNormals(projectionMatrix, viewMatrix, modelMatrix);
        }
        if (this.showOctree && this.octreeBuffer) {
            this.renderOctree(projectionMatrix, viewMatrix, modelMatrix);
        }
    }

    renderMesh(projectionMatrix, viewMatrix, modelMatrix, normalMatrix) {
        const gl = this.gl;
        const lightViewDir = [1, 1, 1]; // fixed direction in camera/view space
        if (this.enableTexturing && this.triplanarTexturesLoaded) {
            gl.useProgram(this.meshTriplanarProgram);
            gl.uniformMatrix4fv(this.meshTriplanarUniforms.projectionMatrix, false, projectionMatrix);
            gl.uniformMatrix4fv(this.meshTriplanarUniforms.viewMatrix, false, viewMatrix);
            gl.uniformMatrix4fv(this.meshTriplanarUniforms.modelMatrix, false, modelMatrix);
            gl.uniformMatrix3fv(this.meshTriplanarUniforms.normalMatrix, false, normalMatrix);
            gl.uniform3fv(this.meshTriplanarUniforms.lightViewDir, lightViewDir);
            gl.uniform3fv(this.meshTriplanarUniforms.lightColor, [1.0, 1.0, 1.0]);
            gl.uniform3fv(this.meshTriplanarUniforms.ambientColor, [0.2, 0.2, 0.2]);
            gl.uniform3fv(this.meshTriplanarUniforms.diffuseColor, [0.7, 0.7, 0.9]);
            gl.uniform1f(this.meshTriplanarUniforms.normalOffset, -0.0001);
            gl.uniform1f(this.meshTriplanarUniforms.triplanarTiling, this.triplanarTiling);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.groundColorTex);
            gl.uniform1i(this.meshTriplanarUniforms.texColor, 0);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.groundNormalTex);
            gl.uniform1i(this.meshTriplanarUniforms.texNormal, 1);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffer.vertices);
            gl.vertexAttribPointer(this.meshTriplanarAttribs.position, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.meshTriplanarAttribs.position);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffer.normals);
            gl.vertexAttribPointer(this.meshTriplanarAttribs.normal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.meshTriplanarAttribs.normal);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshBuffer.indices);
            gl.drawElements(gl.TRIANGLES, this.meshBuffer.count, gl.UNSIGNED_INT, 0);
            gl.disableVertexAttribArray(this.meshTriplanarAttribs.position);
            gl.disableVertexAttribArray(this.meshTriplanarAttribs.normal);
            return;
        }

        // --- DEFAULT SHADER ---
        gl.useProgram(this.meshProgram);
        gl.uniformMatrix4fv(this.meshUniforms.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(this.meshUniforms.viewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(this.meshUniforms.modelMatrix, false, modelMatrix);
        gl.uniformMatrix3fv(this.meshUniforms.normalMatrix, false, normalMatrix);
        gl.uniform3fv(this.meshUniforms.lightViewDir, lightViewDir);
        gl.uniform3fv(this.meshUniforms.lightColor, [1.0, 1.0, 1.0]);
        gl.uniform3fv(this.meshUniforms.ambientColor, [0.2, 0.2, 0.2]);
        gl.uniform3fv(this.meshUniforms.diffuseColor, [0.7, 0.7, 0.9]);
        gl.uniform1f(this.meshUniforms.normalOffset, -0.003);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffer.vertices);
        gl.vertexAttribPointer(this.meshAttribs.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.meshAttribs.position);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffer.normals);
        gl.vertexAttribPointer(this.meshAttribs.normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.meshAttribs.normal);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshBuffer.indices);
        gl.drawElements(gl.TRIANGLES, this.meshBuffer.count, gl.UNSIGNED_INT, 0);
        gl.disableVertexAttribArray(this.meshAttribs.position);
        gl.disableVertexAttribArray(this.meshAttribs.normal);
    }

    renderWireframe(projectionMatrix, viewMatrix, modelMatrix) {
        const gl = this.gl;
        gl.useProgram(this.wireframeProgram);
        gl.uniformMatrix4fv(this.wireframeUniforms.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(this.wireframeUniforms.viewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(this.wireframeUniforms.modelMatrix, false, modelMatrix);
        gl.uniform3fv(this.wireframeUniforms.color, [1.0, 1.0, 1.0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.wireframeBuffer.vertices);
        gl.vertexAttribPointer(this.wireframeAttribs.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.wireframeAttribs.position);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wireframeBuffer.indices);
        gl.drawElements(gl.LINES, this.wireframeBuffer.count, gl.UNSIGNED_INT, 0);
        gl.disableVertexAttribArray(this.wireframeAttribs.position);
    }

    renderNormals(projectionMatrix, viewMatrix, modelMatrix) {
        const gl = this.gl;
        gl.useProgram(this.normalLineProgram);
        gl.uniformMatrix4fv(this.normalLineUniforms.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(this.normalLineUniforms.viewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(this.normalLineUniforms.modelMatrix, false, modelMatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalsLineBuffer.vertices);
        gl.vertexAttribPointer(this.normalLineAttribs.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.normalLineAttribs.position);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalsLineBuffer.colors);
        gl.vertexAttribPointer(this.normalLineAttribs.color, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.normalLineAttribs.color);
        gl.drawArrays(gl.LINES, 0, this.normalsLineBuffer.count);
        gl.disableVertexAttribArray(this.normalLineAttribs.position);
        gl.disableVertexAttribArray(this.normalLineAttribs.color);
    }

    renderOctree(projectionMatrix, viewMatrix, modelMatrix) {
        const gl = this.gl;
        gl.useProgram(this.octreeProgram);
        gl.uniformMatrix4fv(this.octreeUniforms.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(this.octreeUniforms.viewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(this.octreeUniforms.modelMatrix, false, modelMatrix);
        gl.uniform3fv(this.octreeUniforms.color, [1.0, 0.6, 0.0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.octreeBuffer.vertices);
        gl.vertexAttribPointer(this.octreeAttribs.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.octreeAttribs.position);
        gl.drawArrays(gl.LINES, 0, this.octreeBuffer.count);
        gl.disableVertexAttribArray(this.octreeAttribs.position);
    }

    setOptions(options) {
        if (options.showWireframe !== undefined) this.showWireframe = options.showWireframe;
        if (options.showNormals !== undefined) this.showNormals = options.showNormals;
        if (options.showOctree !== undefined) this.showOctree = options.showOctree;
        if (options.enableBackfaceCulling !== undefined) this.enableBackfaceCulling = options.enableBackfaceCulling;
        if (options.enableTexturing !== undefined) this.enableTexturing = options.enableTexturing;
    }

    getStats() {
        return this.stats;
    }
}

// --- Shader sources ---

const meshVertexShaderSource = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uNormalMatrix;
uniform float uNormalOffset;
out vec3 vViewNormal;
out vec3 vViewPosition;
void main() {
    vec3 pos = aPosition + aNormal * uNormalOffset;
    vec4 worldPosition = uModelMatrix * vec4(pos, 1.0);
    vec4 viewPosition = uViewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;
    vViewNormal = normalize(mat3(uViewMatrix * uModelMatrix) * aNormal);
    gl_Position = uProjectionMatrix * viewPosition;
}
`;

const meshFragmentShaderSource = `#version 300 es
precision highp float;
in vec3 vViewPosition;
in vec3 vViewNormal;
uniform vec3 uLightViewDir;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
out vec4 fragColor;
void main() {
    vec3 normal = normalize(vViewNormal);
    vec3 lightDir = normalize(uLightViewDir);
    float diff = max(dot(normal, lightDir), 0.0);

    vec3 viewDir = normalize(-vViewPosition);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

    vec3 ambient = uAmbientColor * uDiffuseColor;
    vec3 diffuse = uLightColor * diff * uDiffuseColor;
    vec3 specular = uLightColor * spec * 0.5;
    fragColor = vec4(ambient + diffuse + specular, 1.0);
}
`;

const wireframeVertexShaderSource = `#version 300 es
precision highp float;
in vec3 aPosition;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
void main() {
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
}
`;

const wireframeFragmentShaderSource = `#version 300 es
precision highp float;
uniform vec3 uColor;
out vec4 fragColor;
void main() {
    fragColor = vec4(uColor, 1.0);
}
`;

const normalLineVertexShaderSource = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aColor;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
out vec3 vColor;
void main() {
    vColor = aColor;
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
}
`;

const normalLineFragmentShaderSource = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 fragColor;
void main() {
    fragColor = vec4(vColor, 1.0);
}
`;

const octreeVertexShaderSource = `#version 300 es
precision highp float;
in vec3 aPosition;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
void main() {
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
}
`;

const octreeFragmentShaderSource = `#version 300 es
precision highp float;
uniform vec3 uColor;
out vec4 fragColor;
void main() {
    fragColor = vec4(uColor, 0.5);
}
`;

// --- Triplanar Shader Sources ---

const meshTriplanarVertexShaderSource = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform float uNormalOffset;
out vec3 vObjPos;
out vec3 vObjNormal;
out vec3 vViewPos;
out mat3 vNormalMatrix;
void main() {
    vec3 pos = aPosition + aNormal * uNormalOffset;
    vec4 worldPosition = uModelMatrix * vec4(pos, 1.0);
    vec4 viewPosition = uViewMatrix * worldPosition;
    vObjPos = aPosition;
    vObjNormal = aNormal;
    vViewPos = viewPosition.xyz;

    mat3 normalMatrix = mat3(uViewMatrix * uModelMatrix);
    vNormalMatrix = normalMatrix;
    gl_Position = uProjectionMatrix * viewPosition;
}
`;

const meshTriplanarFragmentShaderSource = `#version 300 es
precision highp float;
in vec3 vObjPos;
in vec3 vObjNormal;
in vec3 vViewPos;
in mat3 vNormalMatrix;
uniform vec3 uLightViewDir;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform float uTriplanarTiling;
uniform sampler2D uTexColor;
uniform sampler2D uTexNormal;
out vec4 fragColor;

vec3 decodeNormal(vec3 n) {
    return normalize(vec3(n.x, n.y, -n.z) * 2.0 - 1.0);
}

void main() {
    vec3 absNormal = abs(normalize(vObjNormal));
    vec3 blend = absNormal / (absNormal.x + absNormal.y + absNormal.z);

    float scale = uTriplanarTiling;
    vec3 colorX = texture(uTexColor, vObjPos.yz * scale).rgb;
    vec3 colorY = texture(uTexColor, vObjPos.xz * scale).rgb;
    vec3 colorZ = texture(uTexColor, vObjPos.xy * scale).rgb;

    vec3 normalX = decodeNormal(texture(uTexNormal, vObjPos.yz * scale).rgb);
    vec3 normalY = decodeNormal(texture(uTexNormal, vObjPos.xz * scale).rgb);
    vec3 normalZ = decodeNormal(texture(uTexNormal, vObjPos.xy * scale).rgb);

    vec3 objNormalX = vec3(normalX.z, normalX.y, -normalX.x);
    vec3 objNormalY = vec3(normalY.x, normalY.z, -normalY.y);
    vec3 objNormalZ = vec3(normalZ.x, normalZ.y, normalZ.z);

    if (vObjNormal.x < 0.0) objNormalX.x = -objNormalX.x;
    if (vObjNormal.y < 0.0) objNormalY.y = -objNormalY.y;
    if (vObjNormal.z < 0.0) objNormalZ.z = -objNormalZ.z;

    vec3 color = colorX * blend.x + colorY * blend.y + colorZ * blend.z;
    vec3 blendedObjNormal = normalize(
        objNormalX * blend.x +
        objNormalY * blend.y +
        objNormalZ * blend.z
    );

    vec3 normal = normalize(vNormalMatrix * blendedObjNormal);

    vec3 lightDir = normalize(uLightViewDir);
    float diff = max(dot(-normal, lightDir), 0.0);

    vec3 viewDir = normalize(-vViewPos);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

    vec3 ambient = uAmbientColor * color;
    vec3 diffuse = uLightColor * diff * color;
    vec3 specular = uLightColor * spec * 0.5;

    fragColor = vec4(ambient + diffuse + specular, 1.0);
}
`;