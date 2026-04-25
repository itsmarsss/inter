# Warm Graphite Design System

## Intent

Marble Studio uses a matte graphite workspace with warm ivory type and muted clay accents. The interface should feel like a compact creative tool: quiet surfaces, readable controls, restrained contrast, and one clear action color.

## Tokens

```json
{
  "color": {
    "background": "#0B0A08",
    "surface": "#151310",
    "overlay": "#1B1814",
    "inset": "#24201B",
    "border": "#3A332B",
    "textPrimary": "#F4EEE6",
    "textMuted": "#A89F94",
    "accentClay": "#B8653F",
    "accentHover": "#CA7951",
    "accentSoft": "#2D211A",
    "warning": "#D6A24A",
    "danger": "#C96B5D"
  }
}
```

## Rules

- Use semantic CSS variables for product UI colors; avoid raw slate, teal, cyan, blue, or purple utilities in active controls.
- Primary actions use clay fill with warm ink text.
- Active tools and tabs use soft clay background with clay text.
- Panels, widgets, dialogs, and inputs use graphite surfaces with border tokens.
- Captions and metadata use warm muted text.
- Warning and danger states use the muted warm system colors above.
- Corners stay at `rounded-md` or smaller.
- No gradients, glow effects, decorative orbs, or marketing-style hero treatments.
- Typography stays compact, functional, and scan-friendly.
- The 3D scene should share the same graphite, clay, and warm neutral palette as the UI.
