# MaldaOS 3D Animated Experience — Visual QA & Reality Check Report

**Date:** September 5, 2026  
**Auditor:** Head AI Agent / Orchestrator  
**Target Environment:** MaldaOS Production Runtime (`http://127.0.0.1:3101` / `maldacollege.duckdns.org`)  
**Methodology:** Full Headless Chromium Playwright Automation, Multi-Viewport Visual Regression, Frame-Time Profiling, Failure Inversion Testing.

---

## 1. Executive Summary

A comprehensive visual, interaction, and technical audit was conducted on the current MaldaOS 3D implementation. 
The 3D digital campus of Malda College (Estd. 1944) successfully builds real procedural geometry for all 8 campus bhavans, flag mast, mature banyan/neem foliage, Victorian lanterns, and interactive issue beacons. The dedicated `/map` route delivers genuine spatial building focus and diagnostic cards, and the WebGL fallback mechanism successfully protects against white-screens.

However, a strict visual comparison against Devini Labs (`kage-optimise`, `sylva-hero`, `devini-tea`) reveals noticeable UX and visual polish shortcomings:
1. **Severe Text-on-Brick Contrast Degradation** in Chapters 3, 4, 5, and 6 on the landing page, where dark maroon typography is placed directly over dark maroon brick walls.
2. **Sub-optimal Camera Framing** in Chapter 5 (blocked by a tree) and Chapter 6 (dominated by an uncurated roof angle rather than a wide campus panorama).
3. **Hero Scroll Pinning vs Carousel**: The 6-chapter story is currently driven by a stepper button carousel rather than a pinned scroll-scrubbed timeline (as in Devini's `kage-optimise` / `devini-tea`).
4. **Render Loop Fill Cost**: Continuous per-frame shadow and mesh attribute recalculations without dirty-checking increase rendering load on low-tier hardware.
5. **Operational Chunk Sync**: A production service reload is required whenever Next.js chunk builds update to avoid client-side `ChunkLoadError`.

---

## 2. Route Verification

| Route | HTTP Status | 3D Element Mounted | Visual Status | Console Errors |
| :--- | :--- | :--- | :--- | :--- |
| `/` | 200 OK | `<canvas>` (CampusHeroScene) | PASS (with contrast issues) | 0 |
| `/map` | 200 OK | `<canvas>` (CampusSpatialMap) | PASS (Interactive, stable) | 0 |
| `/dashboard` | 200 OK | Standard UI | PASS | 0 |
| `/issues` | 200 OK | Standard UI | PASS | 0 |
| `/report` | 200 OK | Standard UI | PASS | 0 |
| `/admin` | 200 OK | Standard UI | PASS | 0 |
| `/admin/map` | 200 OK | Dual-mode `<CampusMap>` | PASS (Defaults to 3D) | 0 |

---

## 3. Landing Page Visual Audit

Evaluated across all 7 target viewports:

- **1440x900 (Desktop HD)**: Canvas occupies `1440x720`. Zero horizontal overflow. Central quad, Centenary building, and flagpole are composed well in Chapter 1. Contrast fails in Chapters 3–6.
- **1024x768 (Tablet Landscape)**: Clean aspect ratio, responsive buttons wrap without clipping.
- **768x1024 (Tablet Portrait)**: `fitAspect` opens FOV appropriately; buildings remain centered.
- **428x926, 390x844, 375x667, 320x568 (Mobile Phones)**:
  - Zero horizontal overflow.
  - The editorial card sits cleanly in the upper half with bottom controls.
  - However, on mobile, the 3D scene is mostly covered by the text overlay, reducing the spatial feeling to a background wallpaper rather than an integrated environment.

---

## 4. Six-Chapter Story Audit

| Chapter | Stated Goal | Camera Framing Quality | Text Readability | Spatial Storytelling Effectiveness |
| :--- | :--- | :--- | :--- | :--- |
| **01 Campus Overview** | Establish Malda College twin | **4/5**: Balanced quad framing, clock tower, flag | **5/5**: High contrast against sky | **Strong**: Establishes scale and institutional identity. |
| **02 Incident Intake** | Focus on Science Wing fault | **3.5/5**: Swoops to Vidyasagar; beacon visible | **4/5**: Readable against sky/wall boundary | **Good**: Pulsating crimson beacon connects to text. |
| **03 Urgency Triage** | Structural telemetry perspective | **2/5**: Too close to facade; geometry feels flat | **1.5/5**: Dark maroon text on dark maroon brick | **Weak**: Text is hard to decipher; angle feels cramped. |
| **04 Work Dispatch** | Pathway toward IT/Estate cell | **2.5/5**: Angled towards BCA roof | **2/5**: Headline overlaps dark brick cornice | **Moderate**: Doesn't clearly show the dispatch pathway. |
| **05 Field Execution** | Central quad restored pavilion | **2/5**: Foreground tree canopy covers 35% of view | **2/5**: Headline blocked by brick & leaf silhouette | **Weak**: Visual obstruction distracts from narrative. |
| **06 Verified Closure** | Overview across all 8 bhavans | **2/5**: Camera pitched down onto a single roof plane | **2/5**: High glare, narrow field | **Weak**: Fails to convey "executive overview" of campus. |

---

## 5. /map — Deep Visual & Interaction Audit

- **Orbit / Pan / Zoom**: Smooth interaction via mouse drag and touch gestures. Bounded polar angles (`0.18` to `PI/2.15`) prevent camera from dipping below the ground plane.
- **Preset Buttons**: Tested all 6 building presets (`CENT-ADM`, `VID-BHAVAN`, `LIB-CENTRAL`, `RAB-BHAVAN`, `BCA-COMPLEX`, `HOSTEL-BOYS`). Every preset smoothly lerps camera target and opens the contextual ledger card.
- **Raycasting**: Successfully detects building hitboxes. Clicking a building activates the golden wireframe bounding cage in 3D.
- **Severity Filters**: Clicking "Urgent Hazards", "High Priority", and "Active Only" filters the list and highlights corresponding 3D beacons.
- **2D / 3D Switcher**: Toggle switches cleanly between WebGL Spatial Twin and Leaflet GIS without memory leaks or crash.

---

## 6. 3D ↔ UI Integration Audit

- **Good Elements**: Selecting a building in 3D directly triggers the floating ledger card and synchronizes the dropdown filter. Clicking presets moves the 3D world.
- **Weakness**: On the landing page, the UI is essentially a static overlay panel layered over the canvas. Unlike Devini's `kage-optimise` or `devini-tea`, where the text elements are scrubbed and dissolved synchronously with scroll position, MaldaOS uses a button-based stepper carousel that feels somewhat detached from page scroll.

---

## 7. Visual Quality Benchmark (Devini Labs Comparison)

Scale: 1 = Poor, 2 = Weak, 3 = Acceptable, 4 = Strong, 5 = Exceptional

| Category | Score | Evidence | Improvement Needed |
| :--- | :---: | :--- | :--- |
| **1. Spatial Depth** | 3.5 / 5 | Real multi-plane buildings, quads, trees, lamps | Improve background depth / horizon layers |
| **2. Camera Choreography** | 3.0 / 5 | Smooth Catmull-Rom interpolation | Fix waypoints 3, 5, and 6 to avoid visual obstruction |
| **3. Scene Composition** | 3.5 / 5 | Chapter 1 & Map overview look grand and authentic | Curate close-up angles so buildings aren't cropped awkwardly |
| **4. Lighting** | 3.5 / 5 | Directional sunlight + warm hemisphere bounce | Add subtle ground contact ambient occlusion |
| **5. Materials** | 3.5 / 5 | Procedural canvas brick, tile, and brass look heritage | Add subtle normal variation on flagstone pathways |
| **6. Environmental Atmosphere**| 4.0 / 5 | Calibrated FogExp2 matches paper palette | Excellent; blends smoothly with background |
| **7. Motion Quality** | 3.5 / 5 | Pointer parallax lerp is subtle and natural | Make chapter transitions scroll-scrubbed |
| **8. Scroll Storytelling** | 2.5 / 5 | Stepper works, but is not pinned scroll-scrubbed | Implement pinned ScrollTrigger / Lenis scrub |
| **9. Interaction Quality** | 4.0 / 5 | Raycasting, presets, and 3D/2D toggle work flawlessly | Add tooltip hovering on 3D beacons |
| **10. Art Direction** | 4.0 / 5 | Grounded in Malda College Estd. 1944 maroon/gold identity | Maintain strict contrast standards for text |
| **TOTAL SCORE** | **35.0 / 50** | *(70% — Solid Foundation with Specific UX Gaps)* | |

---

## 8. Mobile Visual Audit

- **Viewports Tested:** 320x568, 375x667, 390x844, 428x926.
- **Horizontal Overflow:** 0px (Passed across all screens).
- **Touch Interaction:** 1-finger orbit and 2-finger pinch zoom work smoothly on `/map`.
- **Finding:** On small mobile screens (320px & 375px), the narrative text block takes up >65% of the hero height, obscuring the 3D Centenary hall. The text card needs a semi-translucent backdrop or compact mobile presentation so the 3D environment remains visible.

---

## 9. Performance Audit

- **WebGL Initialization Time:** ~180ms on desktop.
- **Resource Disposal:** All textures, geometries, and materials implement `.dispose()` on unmount.
- **IntersectionObserver:** Verified; render loop stops when scrolled out of view.
- **DPR Capping:** Enforced at `1.25` on mobile and `1.75` on desktop.
- **Frame Rate Finding:** In software rendering / throttled CPU modes, continuous 2048x2048 shadow maps and dynamic vertex recalculation on the flag cause unnecessary fill rate. Adding dirty-checking to render only when the camera or animated objects are moving will significantly boost performance on modest devices.

---

## 10. Failure & Fallback Testing

- **WebGL Disabled (`getContext = null`)**: Verified. The component catches the condition and displays an institutional fallback card with direct navigation links. Zero white-screen.
- **Reduced Motion (`prefers-reduced-motion: reduce`)**: Verified. Parallax drift and automatic camera sway are muted.
- **Stale Chunks / Production Restart**: Verified that when `npm run build` is executed, `campuspulse.service` must be restarted (`systemctl restart campuspulse`) to synchronize runtime in-memory chunks with on-disk output.

---

## 11. Problems Found & Severity Classification

| ID | Severity | Problem Description | Root Cause |
| :--- | :---: | :--- | :--- |
| **ISSUE-01** | **P1** | **Low contrast text in Chapters 3, 4, 5, 6** | H1 text is dark maroon (`#171717`/`#5a1820`) sitting over dark red brick geometry without an adequate backdrop plate. |
| **ISSUE-02** | **P1** | **Awkward camera waypoints in Chapters 5 & 6** | Waypoint 5 is blocked by a tree; Waypoint 6 points steeply downward at an empty roof slope instead of a commanding campus vista. |
| **ISSUE-03** | **P2** | **Hero uses button stepper instead of pinned scroll scrub** | The landing page hero is not pinned with scroll-driven scrubbing (like Devini's `devini-tea` / `kage-optimise`). |
| **ISSUE-04** | **P2** | **Mobile hero card crowds out the 3D scene** | On 320x568 and 375x667, the white card obscures most of the campus background. |
| **ISSUE-05** | **P3** | **Continuous rendering when stationary** | Render loop runs continuously rather than pausing when camera and pointer are idle. |

---

## 12. Recommended Prioritized Fixes

1. **Fix P1 (Contrast & Legibility)**:
   Add an editorial semi-translucent backdrop wash (`bg-white/85 backdrop-blur-md border border-warm-300`) to the entire text block or anchor the text into an institutional ledger panel so it remains readable regardless of camera orientation.
2. **Fix P1 (Waypoint Re-choreography)**:
   - Adjust Waypoint 3: Pull back 8 units so Vidyasagar Science block is elegantly framed in three-quarters isometric view.
   - Adjust Waypoint 5: Shift camera 6 units to clear the tree canopy and showcase the restored quadrangle.
   - Adjust Waypoint 6: Raise camera to `y: 42, z: 65`, target `[0, 6, 0]` to deliver the grand 8-bhavan panorama.
3. **Fix P2 (Scroll Scrub Integration)**:
   Allow wheel/touch scroll inside the hero to scrub smoothly between story waypoints.
4. **Fix P2 (Mobile Compact Mode)**:
   On mobile screens (`< 640px`), reduce padding and body font size so at least 50% of the 3D canvas is visible above the fold.
5. **Fix P3 (Render Optimization)**:
   Reduce shadow map to 1024x1024 on medium tier and only flag vertex updates when visible.

---

## 13. Final Verdict

### **VERIFIED WITH POLISH REQUIRED**

The MaldaOS 3D implementation is technically sound, fully functional, and renders a genuine procedural digital twin of Malda College with authentic materials and interactive GIS capabilities. However, specific visual polish issues (text contrast on chapters 3–6, camera framing on chapters 5 & 6, and mobile card density) prevent it from reaching the full aesthetic refinement of the Devini Labs references.

---
