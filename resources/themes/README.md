# Themes — asset folder

This folder is where you drop PNG assets that can be used by Wispucci Ai's theme
system.

## Supported files

- `bg-<name>.png` — background image for a custom theme (any size; the renderer
  will `object-fit: cover` it).
- `orb-<name>.png` — circular orb sprite (square recommended, ≥ 256×256 for
  crispness). The app draws a glow behind it automatically.

## How the user picks them

The user doesn't need to know this folder exists — inside **Settings → Teme**
they can click **„Încarcă PNG de orb"** or **„Încarcă PNG de fundal"** and pick
any file from disk. The file is read into memory as a base64 Data URL and
stored in `localStorage` under `wispucci_theme_overrides` so it survives
restarts.

If you want to ship presets *inside the app bundle*, add the file here and then
import it from a component with a relative path — electron-vite will copy it
into the packaged build.

## Tips

- Keep background PNGs under ~500 KB; larger files bloat `localStorage`.
- Orb PNGs look best when they have a **transparent background** and the orb
  body occupies ~80 % of the square.
- For best parallax feel, keep the background image composition centred (since
  cropping may hide edges on narrow windows).
