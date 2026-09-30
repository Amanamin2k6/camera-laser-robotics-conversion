# Mathematica robotics conversion assignment

AI-generated web conversion attempt and an evidence-based evaluation of **Measuring Distance and Orientation Using Camera and Lasers**.

Generated using OpenAI Codex on September 30, 2026.

[Open the public web application](https://amanamin2k6.github.io/camera-laser-robotics-conversion/)

[Read the plain-text report](https://amanamin2k6.github.io/camera-laser-robotics-conversion/evaluation.txt)

The report lists 21 faults or limitations and 18 working features, supported by actual browser operation and 990 independent laser-ray comparisons. The preserved attempt includes documented input, rendering and orientation-estimation problems.

- Application code: `camera-laser-app/dist/`
- Plain-text submission report: `evaluation.txt`
- Browser evidence: `evidence/`
- Original Mathematica source and attribution: `source/`
- Independent analytical verification: `camera-laser-app/verify.mjs`

Run locally:

    node camera-laser-app/serve.cjs

Open http://127.0.0.1:4173/.

Run the independent geometry comparison:

    node camera-laser-app/verify.mjs

The app deliberately remains the tested conversion attempt. The report documents actual faults and limitations; it does not assume that a running interface proves correctness.

Original demonstration by Shiva Shahrokhi and Aaron T. Becker (2016):
https://demonstrations.wolfram.com/MeasuringDistanceAndOrientationUsingCameraAndLasers/

Original content and the adaptation are CC BY-NC-SA. See `source/REFERENCE.txt`.
