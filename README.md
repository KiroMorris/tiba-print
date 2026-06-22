# Tiba Print — DTF Layout & Nesting

A fully local web app to organize brand designs, resize them, and auto-pack them
into DTF roll print files with minimal wasted length. Nothing leaves your machine.

## Run it

```bash
npm install      # first time only
npm run dev      # starts the app
```

Then open **http://localhost:4040** in your browser.

To run the production build instead:

```bash
npm run build
npm run start
```

## How to use

1. **Import** — drag designs (PNG · JPG · PDF · SVG) into the Library panel, or
   click to browse. Optionally type a Brand name first to group them.
   - The app reads each file's real size and **auto-trims** transparent padding so
     designs nest tightly. Click a design to edit its physical size (cm), toggle
     90° rotation, or delete it.
2. **Build a job** — click **+ Job** on designs to add them to the print job.
   Set a **quantity** per design, or tick **fill rest of roll** to top up free space.
3. **Auto-pack** — click **Auto-pack ⚡**. Designs nest into the roll (57 cm wide by
   default), rotating 90° where it saves length. If the content exceeds the max
   length, it **auto-splits** into File 2, 3 … You can also **drag blocks** on the
   canvas to arrange manually.
4. **Export** — pick DPI (default 300) and format (PNG / tiled TIFF / PDF), then
   **Export Print File**. Output is **trim-to-content** (only as long as needed) and
   rendered from the real artwork at full resolution. Download links appear, plus
   **Open exports folder**.

## Settings (all editable)

| Setting        | Default | Notes                                   |
| -------------- | ------- | --------------------------------------- |
| Roll width     | 57 cm   | Your DTF film width                     |
| Max length     | 30 m    | Per print file; overflow auto-splits    |
| Gap between    | 3 mm    | Cut spacing between designs             |
| Edge margin    | 5 mm    | Safety margin at the roll edges         |
| DPI            | 300     | Output resolution                       |
| Format         | PNG     | PNG · TIFF (tiled, RIP-safe) · PDF      |
| 90° rotation   | on      | Let the packer rotate to save material  |

## Where things live

- `data/library.db` — SQLite database (brands, designs, jobs)
- `data/files/` — your original uploaded designs
- `data/exports/` — rendered print files

## Tech

Next.js · react-konva (canvas) · maxrects-packer (nesting) · sharp/libvips
(300-DPI compositing) · resvg (SVG) · pdfjs + @napi-rs/canvas (PDF) · pdf-lib
(PDF output) · better-sqlite3 (local DB).
