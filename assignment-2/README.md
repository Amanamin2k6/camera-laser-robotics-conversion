# Assignment 2: Camera and laser geometry

Public application: https://amanamin2k6.github.io/camera-laser-robotics-conversion/assignment-2/

Submission: [report.txt](report.txt). This text file describes the final tested version, remaining limitations and working features. The Assignment 1 application and its original evaluation remain in `camera-laser-app/dist/` and `evaluation.txt`.

## Run

No Mathematica, web framework, build tool, account, or external script is required. Serve the repository over HTTP:

    node camera-laser-app/serve.cjs --final

Open http://127.0.0.1:4173/. In the downloaded source bundle, run this command from the bundle's top-level folder. ES modules need an HTTP server; opening index.html as file:// is not supported.

## Model and deliberate differences

The original Mathematica source is preserved at `source/original.nb`. It defines the cuboid corners `(-.5,-2),(.5,-2),(.5,2),(-.5,2)` in the `(z,x)` plane; a ±1 vertical extent; lasers at `(0,±s)`; `s,λ=0.1..2`; and mirrored projection `(u,v)=(-λx/z,λy/z)`. This adaptation retains those definitions, the default scene, original dial snap π/32, signed adaptive reticule, floor grid and relative spot size. Exact degree entry, readings, sampling checks, scene links and exports are additions.

The original's placeholder point at z=10000 for a missed laser is intentionally replaced by **No hit**. Near-plane crossings receive clipping and an explicit invalid-configuration warning, rather than clamping negative z into a distorted projection. Measurements require a physically valid scene and in-frame spots. Tilt also requires a shared face. It is undirected face inclination modulo 180°, not full object pose.

The default 640-pixel sampling check rejects spots whose centers are closer than one pixel or whose nominal original-style circular graphics overlap. This is a conservative display-based heuristic, **not calibrated physical optics or a general spot-detection algorithm**. The original's ideal model can be selected explicitly. Zoom crops the visualization but never changes sampling validity or sensor bounds.

## Validation

    node assignment-2/verify.mjs

This compares ray intersections against an independent local-coordinate slab reference, exercises closed-form tilted-face cases, checks measurement gates and tests clipping and the source calibration rules.

Browser tests require Playwright and an installed Chrome. They use a fresh isolated browser context, not a signed-in user profile:

    npm install --no-save playwright
    node assignment-2/browser-tests.mjs

Start the HTTP server first. Set `APP_URL` to test the deployed app instead. Set `PLAYWRIGHT_MODULE` to an existing Playwright package path when using a bundled runtime. Evidence and test summaries are written under `evidence/assignment-2/` (or `EVIDENCE_DIR`). Browser tests cover desktop and mobile emulation; they do not replace testing on a physical phone or every browser.

The report distinguishes source-based validation, stored live-Wolfram reference data, and operations actually performed on this final application. No new live-Mathematica comparison is claimed unless recorded.

## Attribution

Adapted using OpenAI Codex from **Measuring Distance and Orientation Using Camera and Lasers**, Shiva Shahrokhi and Aaron T. Becker (2016), Wolfram Demonstrations Project. Original and adaptation: CC BY-NC-SA 3.0. See `source/REFERENCE.txt` and https://creativecommons.org/licenses/by-nc-sa/3.0/.
