/**
 * Abstract base class for isosurfaces.
 */
class Isosurface {
    constructor() {
        this.isolevel = 0;
        this.negativeInside = true;
    }

    /**
     * Evaluate the isosurface function at a point.
     * Must be implemented by subclasses.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    evaluate(x, y, z) {
        throw new Error("evaluate() must be implemented by subclass");
    }

    setIsolevel(isolevel) {
        this.isolevel = isolevel;
    }

    getIsolevel() {
        return this.isolevel;
    }

    setNegativeInside(negativeInside) {
        this.negativeInside = negativeInside;
    }

    isNegativeInside() {
        return this.negativeInside;
    }
}

/**
 * Isosurface implementation with a user-provided function.
 */
class FunctionIsosurface extends Isosurface {
    constructor(fn = null) {
        super();
        this.fn = fn;
    }

    setFunction(fn) {
        this.fn = fn;
    }

    evaluate(x, y, z) {
        if (!this.fn) throw new Error("No isosurface function set");
        return this.fn(x, y, z);
    }
}

/**
 * Predefined isosurface functions.
 */
class Isosurfaces {
    static sphere(x, y, z) {
        return x * x + y * y + z * z - 1.0;
    }

    static torus(x, y, z) {
        const R = 0.45, r = 0.2, x0 = x - 0.25;
        return ((x0 * x0 + y * y + z * z + R * R - r * r) *
                (x0 * x0 + y * y + z * z + R * R - r * r))
                - (4.0 * R * R) * (z * z + x0 * x0);
    }

    static cube(x, y, z) {
        return Math.max(Math.abs(x) - 1.0, Math.max(Math.abs(y) - 1.0, Math.abs(z) - 1.0));
    }

    static terrain(x, y, z) {
        const groundHeight = -0.25;
        
        // Use FBM (Fractal Brownian Motion) for smoother terrain
        let noise = PerlinNoise.fbm(
            x * 1.5, 
            y * 1.5, 
            z * 1.5, 
            3,      // 3 octaves for more detail
            2.2,    // Slightly irregular lacunarity
            0.42    // Gain
        );
        
        // Scale and offset the noise
        noise = noise * 0.5 + 0.5;
        
        // Add some variation to avoid flat areas
        const variation = Math.sin(x * 3.1 + z * 2.7) * 0.05;
        
        // Create terrain height with slight variation
        const terrainHeight = noise * 0.8 + variation;
        
        // Add a small slope to ensure no holes at corners
        const cornerSlope = Math.max(0, 0.1 - (x*x + z*z)) * 0.2;
        
        // Return distance from point to terrain surface
        return y - (groundHeight + terrainHeight + cornerSlope);
    }

    static gyroid(x, y, z) {
        return Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x);
    }

    static doubleTorus(x, y, z) {
        return -(0.01 - x ** 4 + 2.0 * Math.pow(x, 6) - Math.pow(x, 8)
                 + 2.0 * x * x * y * y - 2.0 * x * x * x * x * y * y
                 - y * y * y * y - z * z);
    }

    /**
     * Get a predefined isosurface function by name.
     * @param {string} name
     * @returns {Function}
     */
    static getFunction(name) {
        switch (name.toLowerCase()) {
            case 'sphere': return Isosurfaces.sphere;
            case 'torus': return Isosurfaces.torus;
            case 'cube': return Isosurfaces.cube;
            case 'terrain': return Isosurfaces.terrain;
            case 'gyroid': return Isosurfaces.gyroid;
            case 'doubletorus': return Isosurfaces.doubleTorus;
            default: return Isosurfaces.sphere;
        }
    }
}