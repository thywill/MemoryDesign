import { crackle } from "./bin/sound.js";

// The counter. Choosing a slip unlocks the door; stepping inside drops the needle and leaves.
export function mountWelcome(root, onEnter) {
  const bin = document.getElementById("root");
  if (bin) bin.inert = true;
  const form = root.querySelector("#form");
  const enter = root.querySelector("#enter");
  const reqs = [...form.querySelectorAll('input[name="req"]')].map((i) => i.value).filter((v) => v !== "surprise");
  let pickVal = null;
  form.addEventListener("change", (e) => {
    if (e.target.name !== "req") return;
    pickVal = e.target.value === "surprise" ? reqs[Math.floor(Math.random() * reqs.length)] : e.target.value;
    enter.disabled = false;
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!pickVal || root.classList.contains("leaving")) return;
    onEnter(pickVal);
    crackle();
    root.classList.add("leaving");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let gone = false;
    const done = () => {
      if (gone) return;
      gone = true;
      if (bin) bin.inert = false;
      root.remove();
    };
    root.addEventListener("transitionend", (ev) => { if (ev.target === root && ev.propertyName === "opacity") done(); });
    setTimeout(done, reduce ? 500 : 1400);
  });
}
