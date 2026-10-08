# TraceCase identity

The logo is the project owner’s dark teal squircle with a mint dot near its lower-left corner.

The canonical asset is [tracecase-logo.png](assets/tracecase-logo.png). It is now a transparent, closely framed derivative of the supplied `Minimal Teal Squircle with Mint Dot.png`, as requested by the owner. Preserve the squircle silhouette, mint dot placement, and teal/mint identity. Do not restore a white background or large empty canvas.

The README retains its existing 112px image box and spacing; removing the surrounding blank canvas makes the visible mark larger without pushing the text down. Product headers use a 36px image box. The same asset supplies the extension icon and viewer favicon.

`npm run brand` copies the canonical asset into application public directories before building. Those copies are not separate sources of truth. Release packages include the built assets.

The interface uses dark teal `#0D252B` and mint `#49DCBC`, with neutral reading surfaces. See [interface design](DESIGN.md).

## Asset provenance

The source image was supplied directly by the project owner. The current transparent derivative was made using the built-in image-generation tool in background-extraction mode. Browser checks verify transparent corner pixels and that the mark fills more than 80% of the image width. This is an edited bitmap, not a new vector master.

Final edit prompt:

> Use case: background-extraction. Edit the supplied TraceCase logo only: remove all white background to actual transparent alpha, and tightly frame the existing teal squircle with mint dot so it fills 96% of a square canvas. Preserve the original squircle silhouette, dark teal color, subtle texture, mint dot position, size and color. No redesign, no extra objects, no text, no shadows, no white halo, no checkerboard painted into image. Deliver a clean transparent PNG logo suitable for UI icons and README. Keep only 2% transparent margin on each side.
