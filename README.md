# MemoryDesign

A record bin you dig through in the browser. The shop stays on the laptop or TV. A phone can be your hand in the crate.

## Phone controller

Open the shop on the laptop or TV: https://memory-design.vercel.app. Click **Use your phone**, then scan the QR code. On the phone, hold it like a record sleeve and tap the button.

- With the screen facing the ceiling, slide the phone forward and back to move through the sleeves. It stays on the cover where you pause. Slide sideways for the next rack in view. That path continues into the back row.
- Turn the phone on its side, volume buttons up, and slide. The camera follows that direction, and only while a cover is not pulled out.
- Tip it up so the screen faces you and the top of the phone points up. The cover you paused on comes out.
- Turn it over, back of the phone facing the ceiling, to see the back of that cover.
- Lay it flat on the table, screen up, and hold still. That cover plays. Pick the phone up to stop.
- The angles can be loose. Set upright only marks which way is up. It does not move the camera.

The mouse and keyboard on the laptop keep working. The phone is an extra input.

Tilt and lift work on this https address. On the phone, tap the big button, then tap Allow when asked for motion. A GitHub Pages workflow is also in the repo; if you use that instead, set the Pages source to GitHub Actions.

If the two devices cannot reach each other, the screen says so. Turn on a phone hotspot, join it from the laptop, and try again.

The screen delay (−10 ms, +10 ms, Reset) sits behind the phone icon after you connect. It is stored in the browser and adds a short buffer to the phone's messages.

To run the screen on your own network: `npm run dev -- --host`, then open the `https://` Network address Vite prints, including `/MemoryDesign/`.
