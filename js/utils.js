/**
 * Utility functions for the CMS algorithm.
 */
const EPSILON = 0.00001;

class Utils {
    /**
     * Return 2^exponent.
     */
    static getPowerOfTwo(exponent) {
        return 1 << exponent;
    }

    /**
     * Check if x is a power of two.
     */
    static isPowerOfTwo(x) {
        return x && !(x & (x - 1));
    }

    /**
     * Format time in hh:mm:ss.
     */
    static formatTime(totalSeconds) {
        const ss = totalSeconds % 60;
        const mm = Math.floor(totalSeconds / 60) % 60;
        const hh = Math.floor(totalSeconds / 3600);
        return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    }

    /**
     * Format time in ms or s, with adaptive precision.
     */
    static formatTimeMs(ms) {
        const s = ms / 1000;
        return s < 1
            ? `${ms.toFixed(2)} ms`
            : `${s.toFixed(3)} s`;
    }

    /**
     * Linear interpolation.
     */
    static lerp(a, b, t) {
        return a + t * (b - a);
    }

    /**
     * Floating point approximate equality.
     */
    static fCompare(a, b) {
        return ((a - EPSILON) < b) && ((a + EPSILON) > b);
    }

    /**
     * Download text as a file.
     */
    static downloadTextFile(filename, text) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    /**
     * Calculate normalized gradient (normal vector) at a point.
     * @param {Function} fn - Scalar field function
     * @param {Array} pos - [x, y, z]
     * @param {number} delta - Step size
     * @returns {Array} [nx, ny, nz]
     */
    static calculateNormal(fn, pos, delta = 0.01) {
        const x = pos[0], y = pos[1], z = pos[2];
        const val = fn(x, y, z);
        const dx = fn(x + delta, y, z) - val;
        const dy = fn(x, y + delta, z) - val;
        const dz = fn(x, y, z + delta) - val;
        const normal = [dx, dy, dz];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len > EPSILON) {
            normal[0] /= len;
            normal[1] /= len;
            normal[2] /= len;
        }
        return normal;
    }
}

class PerlinNoise {
    static perm = null;
    
    static initialize() {
        if (PerlinNoise.perm !== null) return;
        
        const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
        PerlinNoise.perm = new Array(512);
        for (let i = 0; i < 512; i++) {
            PerlinNoise.perm[i] = p[i & 255];
        }
    }
    
    static fade(t) {
        return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    }
    
    static grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    static noise3D(x, y, z) {
        PerlinNoise.initialize();
        
        // Add large offset to avoid edge cases with negative coordinates
        const offsetX = 1000.0;
        const offsetY = 1000.0;
        const offsetZ = 1000.0;
        
        x += offsetX;
        y += offsetY;
        z += offsetZ;
        
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        
        const u = PerlinNoise.fade(x);
        const v = PerlinNoise.fade(y);
        const w = PerlinNoise.fade(z);
        
        const perm = PerlinNoise.perm;
        const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
        const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
        
        return Utils.lerp(
            Utils.lerp(
                Utils.lerp(PerlinNoise.grad(perm[AA], x, y, z), 
                           PerlinNoise.grad(perm[BA], x - 1, y, z), u),
                Utils.lerp(PerlinNoise.grad(perm[AB], x, y - 1, z), 
                           PerlinNoise.grad(perm[BB], x - 1, y - 1, z), u),
                v
            ),
            Utils.lerp(
                Utils.lerp(PerlinNoise.grad(perm[AA + 1], x, y, z - 1), 
                           PerlinNoise.grad(perm[BA + 1], x - 1, y, z - 1), u),
                Utils.lerp(PerlinNoise.grad(perm[AB + 1], x, y - 1, z - 1), 
                           PerlinNoise.grad(perm[BB + 1], x - 1, y - 1, z - 1), u),
                v
            ),
            w
        );
    }
    
    static fbm(x, y, z, octaves = 3, lacunarity = 2.0, gain = 0.5) {
        let result = 0.0;
        let amplitude = 1.0;
        let frequency = 1.0;
        let totalAmplitude = 0.0;
        
        // Apply slight rotation to coordinates to break alignment patterns
        const rotatedX = x * 0.98 - z * 0.17;
        const rotatedY = y;
        const rotatedZ = x * 0.17 + z * 0.98;
        
        for (let i = 0; i < octaves; i++) {
            result += amplitude * PerlinNoise.noise3D(
                rotatedX * frequency + i * 3.7, 
                rotatedY * frequency + i * 2.3, 
                rotatedZ * frequency + i * 1.9
            );
            totalAmplitude += amplitude;
            amplitude *= gain;
            frequency *= lacunarity;
        }
        
        // Normalize result
        return result / totalAmplitude;
    }
}