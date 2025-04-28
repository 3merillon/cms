/**
 * UI controls for CMS parameters.
 */
class Controls {
    constructor(onGenerateCallback) {
        this.onGenerateCallback = onGenerateCallback;
        this.elements = {
            functionSelect: document.getElementById('function-select'),
            minLevelSlider: document.getElementById('min-level'),
            minLevelValue: document.getElementById('min-level-value'),
            maxLevelSlider: document.getElementById('max-level'),
            maxLevelValue: document.getElementById('max-level-value'),
            complexThresholdSlider: document.getElementById('complex-threshold'),
            complexThresholdValue: document.getElementById('complex-threshold-value'),
            zeroApproxSlider: document.getElementById('zero-approx'),
            zeroApproxValue: document.getElementById('zero-approx-value'),
            snapCentroidCheckbox: document.getElementById('snap-centroid'),
            showWireframeCheckbox: document.getElementById('show-wireframe'),
            showNormalsCheckbox: document.getElementById('show-normals'),
            showOctreeCheckbox: document.getElementById('show-octree'),
            enableBackfaceCullingCheckbox: document.getElementById('enable-backface-culling'),
            enableTexturingCheckbox: document.getElementById('enable-texturing'),
            generateButton: document.getElementById('generate-btn'),
            resetCameraButton: document.getElementById('reset-camera-btn'),
            exportObjButton: document.getElementById('export-obj-btn'),
            statsElement: document.getElementById('stats'),
            loadingElement: document.getElementById('loading'),
            controlsPanel: document.getElementById('controls'),
            infoPanel: document.getElementById('info-panel')
        };
        this.lastGeneratedParams = this.getCurrentSurfaceParams();
        this.isGenerating = false;
        this.lastMeshStats = { vertices: 0, triangles: 0, cells: 0 };
        this.initUI();
        this.setupEventListeners();
        this.updatePendingUI();
    }

    getCurrentSurfaceParams() {
        return {
            functionName: this.elements.functionSelect.value,
            minLevel: parseInt(this.elements.minLevelSlider.value),
            maxLevel: parseInt(this.elements.maxLevelSlider.value),
            complexThreshold: parseFloat(this.elements.complexThresholdSlider.value),
            zeroApproximation: parseInt(this.elements.zeroApproxSlider.value),
            snapCentroid: this.elements.snapCentroidCheckbox.checked
        };
    }

    paramsEqual(a, b) {
        return Object.keys(a).every(key => a[key] === b[key]);
    }

    updatePendingUI() {
        const current = this.getCurrentSurfaceParams();
        const last = this.lastGeneratedParams;
        const pending = !this.paramsEqual(current, last);

        // Button state
        const btn = this.elements.generateButton;
        btn.classList.toggle('pending', pending && !this.isGenerating);
        btn.classList.toggle('generating', this.isGenerating);

        // Arrow animation: only when generating
        const arrow = btn.querySelector('.material-icons');
        if (arrow) {
            if (this.isGenerating) {
                arrow.classList.add('rotating');
            } else {
                arrow.classList.remove('rotating');
            }
        }

        // Inputs: orange border if changed, blue if not
        this.setInputPending(this.elements.functionSelect, current.functionName !== last.functionName);
        this.setInputPending(this.elements.minLevelSlider, current.minLevel !== last.minLevel);
        this.setInputPending(this.elements.maxLevelSlider, current.maxLevel !== last.maxLevel);
        this.setInputPending(this.elements.complexThresholdSlider, current.complexThreshold !== last.complexThreshold);
        this.setInputPending(this.elements.zeroApproxSlider, current.zeroApproximation !== last.zeroApproximation);
        this.setInputPending(this.elements.snapCentroidCheckbox, current.snapCentroid !== last.snapCentroid);

        // Disable/enable controls
        this.setControlsEnabled(!this.isGenerating);
    }

    setInputPending(input, pending) {
        input.classList.toggle('input-pending', pending);
        input.classList.toggle('input-default', !pending);
    }

    markGenerationComplete() {
        this.lastGeneratedParams = this.getCurrentSurfaceParams();
        this.isGenerating = false;
        this.updatePendingUI();
    }

    initUI() {
        this.updateValue(this.elements.minLevelSlider, this.elements.minLevelValue);
        this.updateValue(this.elements.maxLevelSlider, this.elements.maxLevelValue);
        this.updateValue(this.elements.complexThresholdSlider, this.elements.complexThresholdValue);
        this.updateValue(this.elements.zeroApproxSlider, this.elements.zeroApproxValue);
    }

    setupEventListeners() {
        [
            this.elements.functionSelect,
            this.elements.minLevelSlider,
            this.elements.maxLevelSlider,
            this.elements.complexThresholdSlider,
            this.elements.zeroApproxSlider,
            this.elements.snapCentroidCheckbox
        ].forEach(el => {
            el.addEventListener('input', () => this.updatePendingUI());
            el.addEventListener('change', () => this.updatePendingUI());
        });

        this.elements.zeroApproxSlider.addEventListener('input', () => {
            this.updateValue(this.elements.zeroApproxSlider, this.elements.zeroApproxValue);
        });
        this.elements.minLevelSlider.addEventListener('input', () => {
            this.updateValue(this.elements.minLevelSlider, this.elements.minLevelValue);
            const minLevel = parseInt(this.elements.minLevelSlider.value);
            const maxLevel = parseInt(this.elements.maxLevelSlider.value);
            if (maxLevel < minLevel) {
                this.elements.maxLevelSlider.value = minLevel;
                this.updateValue(this.elements.maxLevelSlider, this.elements.maxLevelValue);
            }
        });
        this.elements.maxLevelSlider.addEventListener('input', () => {
            this.updateValue(this.elements.maxLevelSlider, this.elements.maxLevelValue);
            const minLevel = parseInt(this.elements.minLevelSlider.value);
            const maxLevel = parseInt(this.elements.maxLevelSlider.value);
            if (minLevel > maxLevel) {
                this.elements.minLevelSlider.value = maxLevel;
                this.updateValue(this.elements.minLevelSlider, this.elements.minLevelValue);
            }
        });
        this.elements.complexThresholdSlider.addEventListener('input', () => {
            this.updateValue(this.elements.complexThresholdSlider, this.elements.complexThresholdValue);
        });

        this.elements.generateButton.addEventListener('click', () => {
            if (this.isGenerating) return;
            this.isGenerating = true;
            this.updatePendingUI(); // Start animation and disable controls immediately
            this.onGenerateCallback();
        });

        this.elements.showWireframeCheckbox.addEventListener('change', () => this.onRenderingOptionChanged());
        this.elements.showNormalsCheckbox.addEventListener('change', () => this.onRenderingOptionChanged());
        this.elements.showOctreeCheckbox.addEventListener('change', () => this.onRenderingOptionChanged());
        this.elements.enableBackfaceCullingCheckbox.addEventListener('change', () => this.onRenderingOptionChanged());
        this.elements.enableTexturingCheckbox.addEventListener('change', () => this.onRenderingOptionChanged());
    }

    updateValue(slider, valueElement) {
        valueElement.textContent = parseFloat(slider.value).toFixed(2);
    }

    getParameters() {
        return {
            functionName: this.elements.functionSelect.value,
            minLevel: parseInt(this.elements.minLevelSlider.value),
            maxLevel: parseInt(this.elements.maxLevelSlider.value),
            complexThreshold: parseFloat(this.elements.complexThresholdSlider.value),
            zeroApproximation: parseInt(this.elements.zeroApproxSlider.value),
            snapCentroid: this.elements.snapCentroidCheckbox.checked,
            showWireframe: this.elements.showWireframeCheckbox.checked,
            showNormals: this.elements.showNormalsCheckbox.checked,
            showOctree: this.elements.showOctreeCheckbox.checked,
            enableBackfaceCulling: this.elements.enableBackfaceCullingCheckbox.checked,
            enableTexturing: this.elements.enableTexturingCheckbox.checked
        };
    }

    setRenderingOptionsCallback(callback) {
        this.onRenderingOptionChanged = callback;
    }
    setResetCameraCallback(callback) {
        this.elements.resetCameraButton.addEventListener('click', callback);
    }
    setExportObjCallback(callback) {
        this.elements.exportObjButton.addEventListener('click', callback);
    }

    updateStats(stats, fps = 0) {
        if (stats && typeof stats.vertices !== "undefined") {
            this.lastMeshStats = {
                vertices: stats.vertices,
                triangles: stats.triangles,
                cells: stats.cells
            };
        }
        this.elements.statsElement.innerHTML =
            `<div class="stats-grid">
                <div class="stats-label">FPS:</div><div class="stats-value">${fps}</div>
                <div class="stats-label">Vertices:</div><div class="stats-value">${this.lastMeshStats.vertices}</div>
                <div class="stats-label">Triangles:</div><div class="stats-value">${this.lastMeshStats.triangles}</div>
                <div class="stats-label">Cells:</div><div class="stats-value">${this.lastMeshStats.cells}</div>
            </div>`;
    }

    showLoading() {
        this.isGenerating = true;
        this.updatePendingUI();
    }
    hideLoading() {
        this.isGenerating = false;
        this.updatePendingUI();
    }

    setControlsEnabled(enabled) {
        [
            this.elements.functionSelect,
            this.elements.minLevelSlider,
            this.elements.maxLevelSlider,
            this.elements.complexThresholdSlider,
            this.elements.zeroApproxSlider,
            this.elements.snapCentroidCheckbox,
            this.elements.resetCameraButton,
            this.elements.exportObjButton
        ].forEach(el => el.disabled = !enabled);
    }
}