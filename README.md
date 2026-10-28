# Measuring distance and orientation using a camera and lasers

An independently validated, interactive JavaScript adaptation of the Wolfram robotics demonstration by Shiva Shahrokhi and Aaron T. Becker (2016), developed using OpenAI Codex.

## Assignment 2 — improved and validated application

- [Open the final application](https://amanamin2k6.github.io/camera-laser-robotics-conversion/assignment-2/)
- [Read/download the required text submission](https://amanamin2k6.github.io/camera-laser-robotics-conversion/assignment-2/report.txt)
- [Download the complete runnable source bundle](https://amanamin2k6.github.io/camera-laser-robotics-conversion/assignment-2/source.zip)
- Implementation and instructions: [`assignment-2/`](assignment-2/)
- Calculation and browser evidence: [`evidence/assignment-2/`](evidence/assignment-2/)

The final version fixes the Assignment 1 input and scaling defects, checks camera visibility and shared-face validity, handles invalid near-plane setups, restores the original visual guides, and adds precision exports, scene links and an explicit sampling check. It runs without Mathematica, accounts, API keys, a build step or runtime dependencies.

Serve the final version:

    node camera-laser-app/serve.cjs --final

Open http://127.0.0.1:4173/.

Run the independent mathematical verification:

    node assignment-2/verify.mjs

Browser tests and their prerequisites are documented in [`assignment-2/README.md`](assignment-2/README.md).

## Assignment 1 — preserved conversion attempt

The original conversion and its documented problems remain unchanged for comparison:

- [Original application](https://amanamin2k6.github.io/camera-laser-robotics-conversion/camera-laser-app/dist/)
- [Original evaluation: 22 faults and 18 working features](evaluation.txt)
- [Six original live-Wolfram comparisons](live-comparison.txt)
- Original source: [`camera-laser-app/dist/`](camera-laser-app/dist/)
- Original independent 990-ray check: `node camera-laser-app/verify.mjs`

Run the Assignment 1 app with `node camera-laser-app/serve.cjs` (without `--final`).

## Original source and attribution

Original demonstration: https://demonstrations.wolfram.com/MeasuringDistanceAndOrientationUsingCameraAndLasers/

The downloaded Mathematica notebook is preserved at [`source/original.nb`](source/original.nb). Original and adaptation: CC BY-NC-SA 3.0. See [`source/REFERENCE.txt`](source/REFERENCE.txt).
