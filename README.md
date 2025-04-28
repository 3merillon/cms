License: MIT Status: In Development Version: 0.1.0

This repository contains a JavaScript/WebGL implementation of the Cubical Marching Squares (CMS) algorithm for adaptive isosurface extraction. CMS is a powerful algorithm that addresses many of the limitations of traditional Marching Cubes, providing adaptive resolution and manifold surfaces.

<p align="center"> <img src="assets/cms-screenshot.png" alt="CMS WebGL Implementation" width="600"/> <br> <em>Adaptive isosurface extraction with varying octree depths</em> </p>
About This Implementation
This is a partial, educational implementation of the CMS algorithm, designed to demonstrate the core concepts in an interactive web environment. The code is a loose translation of George Rassovsky's C++ implementation into JavaScript, with adaptations for WebGL rendering.

Features
✅ Adaptive octree-based sampling
✅ Manifold surface extraction
✅ Interactive parameter adjustment
✅ WebGL visualization
✅ Centroid snapping for improved surface quality
⬜ Sharp feature preservation (planned)
⬜ Face and internal disambiguation (planned)
⬜ GPU acceleration (planned)
Algorithm Credits
The Cubical Marching Squares algorithm was originally proposed by Ho et al. in 2005:

Ho, C.-C., Wu, F.-C., Chen, B.-Y., Chuang, Y.-Y., & Ouhyoung, M. (2005). Cubical Marching Squares: Adaptive feature preserving surface extraction from volume data. Computer Graphics Forum, 24(3), 537-545.

This implementation is inspired by the C++ implementation by George Rassovsky:

Rassovsky, G. (2014). Cubical Marching Squares Implementation. GC Rassovsky CG Blog.

Future Work
This implementation is a work in progress with several planned enhancements:

Sharp Feature Preservation: Implementing the full CMS algorithm with 2D and 3D sharp feature preservation
Performance Optimization: Improving the octree creation stage, which is currently a bottleneck
GPU Acceleration: Exploring WebGPU and compute shaders for accelerated surface extraction
Interactive Editing: Adding tools for real-time sculpting and modification of implicit surfaces
How It Works
The CMS algorithm works by:

Sampling a scalar field on an adaptive octree grid
Identifying surface crossings along cell edges
Generating segments on cell faces
Connecting segments to form components (polygons)
Tessellating components into triangles
The adaptive nature of the algorithm allows it to use higher resolution in areas of complex detail while using lower resolution in simpler regions, resulting in efficient mesh generation.

Usage
Interact with the demo using the control panel:

Select different implicit functions
Adjust minimum and maximum octree levels
Modify the complex surface threshold
Toggle wireframe, normals, and octree visualization
Export the generated mesh as OBJ
Development
This project is open to contributions, particularly in the areas of:

Performance optimization
Sharp feature preservation implementation
GPU acceleration techniques
Additional implicit surface functions
License
This project is licensed under the MIT License - see the LICENSE file for details.

Acknowledgments
Special thanks to:

The original CMS algorithm authors from National Taiwan University
George Rassovsky for his C++ implementation and detailed thesis
The WebGL community for their excellent resources
<p align="center"> <em>Exploring the intersection of computational geometry, computer graphics, and web technologies</em> </p>