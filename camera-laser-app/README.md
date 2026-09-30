# Camera & Laser Geometry Lab

AI-generated conversion attempt by OpenAI Codex, September 30, 2026.

Original: https://demonstrations.wolfram.com/MeasuringDistanceAndOrientationUsingCameraAndLasers/
Authors: Shiva Shahrokhi and Aaron T. Becker (2016).
Adapted under CC BY-NC-SA 3.0. The original Mathematica notebook is preserved in ../source/original.nb for comparison.

Serve `dist` using any static HTTP server. For example, from this directory:

    node serve.cjs

Then open http://127.0.0.1:4173. Native ES modules require HTTP serving. No packages, build step, Mathematica, or API keys are required.

The model uses [z,x] world coordinates, a 1 by 4 cuboid footprint with height 2, ray/segment intersections, and the original notebook's sign convention u = -lambda*x/z. Two laser depths determine the inclination of a shared surface. The report evaluates the actual attempt, including unsupported configurations and imperfect conversion details.
