# MemoryDesign

A record bin you dig through in the browser. The shop stays on the laptop or TV. A phone can be your hand in the crate.

## Phone controller

Open the shop on the laptop or TV: https://memory-design.vercel.app. Click **Use your phone**, then scan the QR code. On the phone, hold it like a record sleeve and tap the button.

- Previous rack and Next rack move the camera. Tilting the phone does not.
- Reach the phone forward, then bring it back upright, to move one sleeve deeper. Past the front row, that continues into the back row.
- Pause on a sleeve and lift the phone to pull it out. It shows on the phone.
- Turn the phone to see the back of that sleeve.
- Reach forward again, or tap Put it back, to return it.
- Lay the phone flat, screen up, to set the record on the player. Pick it up to take it off.
- Set upright remembers which way you are holding the phone. It does not move the camera.

The mouse and keyboard on the laptop keep working. The phone is an extra input.

Tilt and lift work on this https address. On the phone, tap the big button, then tap Allow when asked for motion. A GitHub Pages workflow is also in the repo; if you use that instead, set the Pages source to GitHub Actions.

If the two devices cannot reach each other, the screen says so. Turn on a phone hotspot, join it from the laptop, and try again.

The screen delay (−10 ms, +10 ms, Reset) sits behind the phone icon after you connect. It is stored in the browser and adds a short buffer to the phone's messages.

To run the screen on your own network: `npm run dev -- --host`, then open the `https://` Network address Vite prints, including `/MemoryDesign/`.
