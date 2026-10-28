# MemoryDesign

A record bin you dig through in the browser. The shop stays on the laptop or TV. A phone can be your hand in the crate.

## Phone controller

Open the shop on the laptop or TV: https://memory-design.vercel.app. Click **Use your phone**, then scan the QR code. On the phone, hold it like a record sleeve and tap the button.

- Move the phone left and right and the camera follows along the bin.
- Tip it to flip through the column under your hand. A fast wrist flick jumps one column.
- Lift it to pull a record out.
- Tap the record on the phone to keep it (up to three).
- Tip back to the sleeve angle and hold to put it back.
- Lay the phone flat, screen up, to set the record on the player. Pick it up to take it off.

The mouse and keyboard on the laptop keep working. The phone is an extra input.

Tilt and lift work on this https address. On the phone, tap the big button, then tap Allow when asked for motion. A GitHub Pages workflow is also in the repo; if you use that instead, set the Pages source to GitHub Actions.

If the two devices cannot reach each other, the screen says so. Turn on a phone hotspot, join it from the laptop, and try again.

The screen delay (−10 ms, +10 ms, Reset) sits behind the phone icon after you connect. It is stored in the browser and adds a short buffer to the phone's messages.

To run the screen on your own network: `npm run dev -- --host`, then open the `https://` Network address Vite prints, including `/MemoryDesign/`.
