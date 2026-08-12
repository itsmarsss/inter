# INTER

INTER is an AI-assisted 3D interior design studio for moving quickly from an idea for a room to an explorable spatial concept. It gives designers and everyday users a compact workspace for planning, decorating, and reimagining interiors without jumping between moodboards, modeling tools, and floor-plan software.


https://github.com/user-attachments/assets/f1bb7ad1-5e73-450e-b46b-6b76547c79cc




## What It Does

INTER lets users define and edit a room, add architectural details, generate furniture from text, and view the result as both a 3D blockout and a synchronized 2D blueprint.

Core capabilities include:

- Editable room bounds, cut wall segments, doors, windows, cameras, furniture, and custom primitive shapes.
- Direct manipulation in 3D and blueprint views, including drag, resize, rotate, wall cutting, and dimension editing.
- Resizable doors and windows that stay clamped to the active wall or cut-wall run.
- Text-to-3D furniture generation from prompts such as `round walnut coffee table`.
- GLB/GLTF upload support for user-provided furniture and scene assets.
- Furniture placement, rotation, scaling, deletion, and local library persistence.
- Product search for furniture and decor using eBay results through SerpAPI.
- A full-screen 3D workspace paired with a synchronized blueprint renderer.
- A room-to-world workflow that turns room captures and prompts into an immersive Gaussian splat visualization.
- WebXR entry for exploring generated splat worlds in a headset when supported.
- A companion Unity Quest capture project under `quest-capture/` for headset-based room capture and export workflows.

The goal is to make early interior design exploration feel fast, spatial, and directly editable: generate ideas with AI, then refine them by moving through the room and manipulating objects yourself.

## Tech Stack

INTER is built with:

- Next.js
- React
- TypeScript
- Three.js
- React Three Fiber
- Drei
- React Three XR
- Tailwind CSS and CSS design tokens
- GLB/GLTF asset workflows
- Gaussian splat rendering for immersive room views
- SerpAPI eBay search for product discovery
- Unity, OpenXR, and Meta XR tooling for the Quest capture companion app

The editor is driven by shared application state for rooms, furniture assets, furniture instances, wall segments, doors, windows, cameras, custom shapes, generated worlds, and persisted library entries.

## AI Pipeline

INTER combines multiple AI systems so users can move between text, imagery, 3D furniture, and immersive room visualization.

### Text-to-3D Furniture

Users describe a furniture object in natural language. INTER sends that prompt through Meshy to generate a GLB model, then streams generation progress back into the editor. Generated assets can be placed in the room, saved to the local library, reused, uploaded, or combined with manually imported models.

### Design Reasoning

Gemma 4, hosted on Vultr, acts as INTER's self-hosted design reasoning layer. It helps interpret user intent, clean up rough room and style descriptions, and produce structured guidance for downstream generation steps. Running this layer on Vultr gives the project more control over latency, cost, deployment, and future fine-tuning around interior design data.

### Visual Understanding

Google Cloud Vision API is used to analyze room imagery before final scene generation. Object detection identifies major furniture and room elements, while depth map information and normal map cues help the system reason about spatial layout, surface orientation, walls, floors, and large objects. This grounds the room-to-world workflow in the real space instead of treating it as a purely image-based transformation.

### Product Search

Users can search for real furniture and decor products directly from the left-side product panel. INTER queries SerpAPI's eBay engine through a local Next.js API route and displays product cards with title, price, seller, shipping, thumbnail, and outbound listing links.

### Room to World

INTER supports a room-to-world pipeline where a room capture and design prompt are sent through the World Labs Marble API route. The result can be loaded as an immersive Gaussian splat so users can compare the editable blockout against a generated spatial concept. Image generation provides style and atmosphere; Gaussian splats make the output feel present and walkable.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Fill in the API keys and service settings needed for the AI features:

```bash
MESHY_API_KEY=
MESHY_API_BASE=https://api.meshy.ai/openapi/v2
WORLDLABS_API_KEY=
WORLDLABS_API_BASE=https://api.worldlabs.ai/marble/v1
SERPAPI_API_KEY=

# Optional self-hosted design reasoning layer
GEMMA_SSH_HOST=
GEMMA_SSH_USER=
GEMMA_SSH_PASSWORD=
```

Run the development server:

```bash
pnpm dev
```

Open the app at:

```text
http://localhost:3000
```

## Quest Capture Project

The `quest-capture/` folder is a separate Unity project for Meta Quest room capture workflows. It includes Unity project settings, XR/OpenXR configuration, Meta/Oculus assets, and scripts such as `FloorPlanReader` and `RoomMeshExporterUI` for reading room layout data and exporting capture artifacts.

Open `quest-capture/` directly in Unity when working on the headset capture side. It is intentionally kept separate from the Next.js app runtime and does not participate in the `pnpm` scripts.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm start
```

## Project Structure

```text
app/          Next.js app routes and API endpoints
src/api/      Client-side wrappers for generation, library, and world APIs
src/components/
              Editor panels, viewport, blueprint, landing page, and controls
src/server/   Server-side API helpers and asset persistence
src/state/    Editor state, geometry helpers, and shared types
src/styles/   Global styles and design tokens
public/       Generated meshes, splats, icons, and static assets
quest-capture/
              Unity project for Meta Quest room capture and export workflows
```

## Challenges

The hardest parts of INTER are the pieces between generation and usability:

- Keeping the 2D blueprint and 3D scene synchronized.
- Maintaining real-world scale for generated furniture.
- Making generated and uploaded assets behave like editable design objects.
- Managing async generation states, progress updates, and local asset persistence.
- Building a panoramic-to-Gaussian-splat workflow that preserves the feel of a real room while still allowing AI reinterpretation.

## What We Learned

Generated 3D assets are only useful when they are paired with direct manipulation. Prompt-based generation can create a strong starting point, but users still need precise placement, scale, camera behavior, footprints, comparison, and iteration.

We also learned that image generation and spatial visualization solve different parts of the design problem. Image generation is strongest for atmosphere and style; Gaussian splats make the result feel present and immersive.

## What's Next

Next steps for INTER include:

- Room scanning and better measurement tools.
- Richer material and style controls.
- Multiplayer design sessions.
- Exportable floor plans.
- More realistic final renders.
- Faster and more accurate panoramic-to-splat generation.
- Full-room concept generation from an existing layout, not just individual furniture generation.
