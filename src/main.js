import { loadStacks } from "./data.js";
import { mountBin } from "./bin/BinScene.jsx";
import { preloadCovers } from "./bin/textures.js";
import { store } from "./bin/store.js";
import { mountWelcome } from "./welcome.js";

const shelfP = loadStacks();
shelfP.then((shelf) => preloadCovers(shelf));
mountBin(document.getElementById("root"), shelfP);
mountWelcome(document.getElementById("welcome"), (request) => store.set({ request }));
