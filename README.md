# INTER

INTER is an AI-assisted 3D interior design studio for moving quickly from an idea for a room to an explorable spatial concept. It gives designers and everyday users a compact workspace for planning, decorating, and reimagining interiors without jumping between moodboards, modeling tools, and floor-plan software.

## What It Does

INTER lets users define and edit a room, add architectural details, generate furniture from text, and view the result as both a 3D blockout and a synchronized 2D blueprint.

Core capabilities include:

- Editable room bounds, wall segments, doors, windows, cameras, and custom shapes.
- Text-to-3D furniture generation from prompts such as `round walnut coffee table`.
- GLB/GLTF upload support for user-provided furniture and scene assets.
- Furniture placement, rotation, scaling, deletion, and local library persistence.
- A full-screen 3D workspace paired with a synchronized blueprint renderer.
- A room-to-world workflow that turns panoramic room imagery into an immersive Gaussian splat visualization.

The goal is to make early interior design exploration feel fast, spatial, and directly editable: generate ideas with AI, then refine them by moving through the room and manipulating objects yourself.

## Tech Stack

INTER is built with:

- Next.js
- React
- TypeScript
- Three.js
- React Three Fiber
- Drei
- Tailwind CSS and CSS design tokens
- GLB/GLTF asset workflows
- Gaussian splat rendering for immersive room views

The editor is driven by shared application state for rooms, furniture assets, furniture instances, wall segments, doors, windows, cameras, custom shapes, generated worlds, and persisted library entries.

## AI Pipeline

INTER combines multiple AI systems so users can move between text, imagery, 3D furniture, and immersive room visualization.

### Text-to-3D Furniture

Users describe a furniture object in natural language. INTER sends that prompt through Meshy to generate a GLB model, then streams generation progress back into the editor. Generated assets can be placed in the room, saved to the local library, reused, uploaded, or combined with manually imported models.

### Design Reasoning

Gemma 4, hosted on Vultr, acts as INTER's self-hosted design reasoning layer. It helps interpret user intent, clean up rough room and style descriptions, and produce structured guidance for downstream generation steps. Running this layer on Vultr gives the project more control over latency, cost, deployment, and future fine-tuning around interior design data.

### Visual Understanding

Google Cloud Vision API is used to analyze room imagery before final scene generation. Object detection identifies major furniture and room elements, while depth map information and normal map cues help the system reason about spatial layout, surface orientation, walls, floors, and large objects. This grounds the room-to-world workflow in the real space instead of treating it as a purely image-based transformation.

### Panorama to World

INTER supports a panoramic image pipeline where a captured room photo is passed into GPT-2 image generation to create a redesigned interior concept. That result is then converted into a Gaussian splat so users can explore a more immersive version of the generated room. Image generation provides style and atmosphere; Gaussian splats make the output feel spatial and walkable.

## Getting Started

Install dependencies:

```bash
npm install
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
```

Run the development server:

```bash
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run start
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
