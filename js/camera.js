/**
 * Camera supporting mouse and touch orbit/zoom controls.
 * - Mouse drag or one-finger drag: Orbit (rotate around target)
 * - Mouse wheel or pinch: Zoom
 * - Two-finger drag+pinch: Orbit and zoom simultaneously
 */
class Camera {
    constructor(canvas) {
        this.position = glMatrix.vec3.fromValues(0, 0, 5);
        this.target = glMatrix.vec3.fromValues(0, 0, 0);
        this.up = glMatrix.vec3.fromValues(0, 1, 0);

        this.viewMatrix = glMatrix.mat4.create();
        this.projectionMatrix = glMatrix.mat4.create();

        this.fov = Math.PI / 4;
        this.aspect = canvas.width / canvas.height;
        this.near = 0.1;
        this.far = 100.0;

        this.orbitRadius = 5;
        this.orbitTheta = Math.PI / 4;
        this.orbitPhi = Math.PI / 4;

        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mouseSensitivity = 0.01;

        this.touchState = {
            isTouching: false,
            isPinching: false,
            lastTouches: [],
            lastDistance: null,
            lastTheta: null,
            lastPhi: null,
            lastRadius: null
        };

        this.updateOrbitPosition();
        this.updateViewMatrix();
        this.updateProjectionMatrix();
        this.setupEventListeners(canvas);
    }

    setupEventListeners(canvas) {
        // Mouse
        canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: false });
        // Touch
        canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        canvas.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
        // Resize
        window.addEventListener('resize', () => {
            this.aspect = canvas.width / canvas.height;
            this.updateProjectionMatrix();
        });
    }

    // Mouse controls
    onMouseDown(event) {
        this.isDragging = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }
    onMouseUp() { this.isDragging = false; }
    onMouseMove(event) {
        if (!this.isDragging) return;
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.orbitTheta -= deltaX * this.mouseSensitivity;
        this.orbitPhi -= deltaY * this.mouseSensitivity;
        this.orbitPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.orbitPhi));
        this.updateOrbitPosition();
        this.updateViewMatrix();
    }
    onMouseWheel(event) {
        event.preventDefault();
        const zoomSpeed = 0.1;
        this.orbitRadius += Math.sign(event.deltaY) * zoomSpeed;
        this.orbitRadius = Math.max(1.0, Math.min(20.0, this.orbitRadius));
        this.updateOrbitPosition();
        this.updateViewMatrix();
    }

    // Touch controls
    onTouchStart(event) {
        if (event.touches.length === 1) {
            this.touchState.isTouching = true;
            this.touchState.isPinching = false;
            this.touchState.lastTouches = [{ x: event.touches[0].clientX, y: event.touches[0].clientY }];
            this.touchState.lastTheta = this.orbitTheta;
            this.touchState.lastPhi = this.orbitPhi;
        } else if (event.touches.length === 2) {
            this.touchState.isTouching = false;
            this.touchState.isPinching = true;
            const t0 = event.touches[0], t1 = event.touches[1];
            this.touchState.lastTouches = [
                { x: t0.clientX, y: t0.clientY },
                { x: t1.clientX, y: t1.clientY }
            ];
            this.touchState.lastDistance = this._touchDistance(t0, t1);
            this.touchState.lastTheta = this.orbitTheta;
            this.touchState.lastPhi = this.orbitPhi;
            this.touchState.lastRadius = this.orbitRadius;
        }
        event.preventDefault();
    }
    onTouchMove(event) {
        if (event.touches.length === 1 && this.touchState.isTouching) {
            const t = event.touches[0];
            const last = this.touchState.lastTouches[0];
            const deltaX = t.clientX - last.x;
            const deltaY = t.clientY - last.y;
            this.orbitTheta = this.touchState.lastTheta - deltaX * this.mouseSensitivity;
            this.orbitPhi = this.touchState.lastPhi - deltaY * this.mouseSensitivity;
            this.orbitPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.orbitPhi));
            this.updateOrbitPosition();
            this.updateViewMatrix();
        } else if (event.touches.length === 2) {
            const t0 = event.touches[0], t1 = event.touches[1];
            const newDist = this._touchDistance(t0, t1);
            const lastDist = this.touchState.lastDistance;
            let zoomDelta = 0;
            if (lastDist !== null) {
                zoomDelta = newDist - lastDist;
                this.orbitRadius = this.touchState.lastRadius - zoomDelta * 0.01;
                this.orbitRadius = Math.max(1.0, Math.min(20.0, this.orbitRadius));
            }
            const avgX = (t0.clientX + t1.clientX) / 2;
            const avgY = (t0.clientY + t1.clientY) / 2;
            const lastAvgX = (this.touchState.lastTouches[0].x + this.touchState.lastTouches[1].x) / 2;
            const lastAvgY = (this.touchState.lastTouches[0].y + this.touchState.lastTouches[1].y) / 2;
            const deltaX = avgX - lastAvgX;
            const deltaY = avgY - lastAvgY;
            this.orbitTheta = this.touchState.lastTheta - deltaX * this.mouseSensitivity;
            this.orbitPhi = this.touchState.lastPhi - deltaY * this.mouseSensitivity;
            this.orbitPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.orbitPhi));
            this.updateOrbitPosition();
            this.updateViewMatrix();
        }
        event.preventDefault();
    }
    onTouchEnd(event) {
        if (event.touches.length === 0) {
            this.touchState.isTouching = false;
            this.touchState.isPinching = false;
            this.touchState.lastDistance = null;
        } else if (event.touches.length === 1) {
            this.touchState.isTouching = true;
            this.touchState.isPinching = false;
            this.touchState.lastTouches = [{ x: event.touches[0].clientX, y: event.touches[0].clientY }];
            this.touchState.lastTheta = this.orbitTheta;
            this.touchState.lastPhi = this.orbitPhi;
            this.touchState.lastDistance = null;
            this.touchState.lastRadius = this.orbitRadius;
        }
        event.preventDefault();
    }
    _touchDistance(t0, t1) {
        const dx = t0.clientX - t1.clientX;
        const dy = t0.clientY - t1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Camera math
    updateOrbitPosition() {
        this.position[0] = this.orbitRadius * Math.sin(this.orbitPhi) * Math.sin(this.orbitTheta);
        this.position[1] = this.orbitRadius * Math.cos(this.orbitPhi);
        this.position[2] = this.orbitRadius * Math.sin(this.orbitPhi) * Math.cos(this.orbitTheta);
    }
    updateViewMatrix() {
        glMatrix.mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    }
    updateProjectionMatrix() {
        glMatrix.mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.near, this.far);
    }
    reset() {
        this.orbitRadius = 5;
        this.orbitTheta = Math.PI / 4;
        this.orbitPhi = Math.PI / 4;
        this.updateOrbitPosition();
        this.updateViewMatrix();
    }
    getViewMatrix() { return this.viewMatrix; }
    getProjectionMatrix() { return this.projectionMatrix; }
}