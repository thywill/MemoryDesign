import { loadStacks } from "./data.js";
import { mountBin } from "./bin/BinScene.jsx";

mountBin(document.getElementById("root"), await loadStacks());
