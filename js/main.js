document.addEventListener('DOMContentLoaded', () => {
    let cmsWorker = new Worker('js/cms-worker.js');

    let lastFrameTime = performance.now();
    let frames = 0;
    let fps = 0;

    const canvas = document.getElementById('canvas');
    let gl = canvas.getContext('webgl2');
    if (!gl) {
        gl = canvas.getContext('webgl');
        if (!gl) {
            alert('WebGL not supported!');
            throw new Error('WebGL not supported!');
        }
    }

    const renderer = new Renderer(canvas);
    const camera = new Camera(canvas);
    const mesh = new Mesh();

    const controls = new Controls(() => {
        generateSurface();
    });

    controls.setRenderingOptionsCallback(() => {
        updateRenderingOptions();
    });
    controls.setResetCameraCallback(() => {
        camera.reset();
    });
    controls.setExportObjCallback(() => {
        exportOBJ();
    });

    updateRenderingOptions();

    let animationFrameId = null;
    let isRunning = false;

    async function generateSurface() {
        controls.showLoading();
        await new Promise(resolve => setTimeout(resolve, 0));
        const params = controls.getParameters();

        cmsWorker.onmessage = function(e) {
            const { vertices, normals, indices, stats, octreeLeafCells, algorithm, performance } = e.data;
            mesh.clear();
            mesh.vertices = vertices;
            mesh.normals = normals;
            mesh.indices = indices;
        
            renderer.setMesh(mesh);
            renderer.createWireframeBuffer(mesh);
            renderer.setOctreeLeafCells(octreeLeafCells);
        
            // Always use current rendering options
            updateRenderingOptions();

            controls.updateStats({
                vertices: stats.mesh.vertices,
                triangles: stats.mesh.triangles,
                cells: stats.octree.leafCells
            }, fps);
        
            // Update info panel (Algorithm Stats & Performance)
            if (window.updateDebugInfo && algorithm && performance) {
                window.updateDebugInfo({
                    algorithm: algorithm,
                    performance: performance
                });
            }
        
            controls.hideLoading();
            controls.markGenerationComplete();
            if (!isRunning) startAnimation();
        };

        cmsWorker.onerror = function(e) {
            controls.hideLoading();
            controls.markGenerationComplete();
            alert("Surface generation failed: " + e.message);
        };

        cmsWorker.postMessage(params);
    }

    // --- Updated to always pass enableTexturing ---
    function updateRenderingOptions() {
        const params = controls.getParameters();
        renderer.setOptions({
            showWireframe: params.showWireframe,
            showNormals: params.showNormals,
            showOctree: params.showOctree,
            enableBackfaceCulling: params.enableBackfaceCulling,
            enableTexturing: params.enableTexturing // <-- NEW
        });
    }

    function exportOBJ() {
        if (mesh.vertexCount() === 0) {
            alert('No mesh to export!');
            return;
        }
        const objContent = mesh.exportOBJ();
        const params = controls.getParameters();
        const filename = `${params.functionName}.obj`;
        Utils.downloadTextFile(filename, objContent);
    }

    function animate() {
        renderer.render(camera);
        frames++;
        const now = performance.now();
        if (now - lastFrameTime >= 1000) {
            fps = frames;
            frames = 0;
            lastFrameTime = now;
            controls.updateStats(undefined, fps);
        }
        animationFrameId = requestAnimationFrame(animate);
    }

    function startAnimation() {
        if (!isRunning) {
            isRunning = true;
            animationFrameId = requestAnimationFrame(animate);
        }
    }

    function stopAnimation() {
        if (isRunning) {
            cancelAnimationFrame(animationFrameId);
            isRunning = false;
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAnimation();
        } else {
            startAnimation();
        }
    });

    function resizeCanvasAndViewport() {
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (camera) {
            camera.aspect = displayWidth / displayHeight;
            camera.updateProjectionMatrix();
        }
    }

    ['resize', 'orientationchange'].forEach(evt => window.addEventListener(evt, resizeCanvasAndViewport));
    resizeCanvasAndViewport();

    // Initial surface and animation.
    generateSurface();
    startAnimation();
});