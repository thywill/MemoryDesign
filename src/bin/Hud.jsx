import React from "react";
import { store, useStore } from "./store.js";
import { sfx, ensureAudio } from "./sound.js";
import { putBack } from "./actions.js";

// HTML on top of the scene.
export function Hud() {
  const hover = useStore((s) => s.hover);
  const insp = useStore((s) => s.inspect);
  const flipped = useStore((s) => s.flipped);
  const out = useStore((s) => s.out);
  const moved = useStore((s) => s.moved);
  const progress = useStore((s) => s.progress);
  const sound = useStore((s) => s.sound);
  const request = useStore((s) => s.request);
  return (
    <>
      {request && (
        <div className="request-card">
          <b>The request</b>
          <p>{request}</p>
        </div>
      )}
      {!insp && (
        <>
          <div className={"hint" + (moved || hover ? " gone" : "")}>Scroll to move along the bin. Point at an edge to flip through, click to pull one out.</div>
          <div className={"tag" + (hover ? " on" : "")}>
            {hover && <><span className="g">{hover.genre}</span><b>{hover.title}</b><span className="a">{hover.artist}</span></>}
          </div>
          <div className="track" aria-hidden="true"><i style={{ transform: `scaleX(${progress ?? 0})` }} /></div>
        </>
      )}
      {insp && (
        <div className="controls">
          <button onClick={() => { sfx("slide"); store.set({ flipped: !flipped }); }}>{flipped ? "Show front" : "Flip it over"}</button>
          <button onClick={() => { sfx("slide"); store.set({ out: !out }); }}>{out ? "Slide it back in" : "Slide the record out"}</button>
          <button onClick={() => putBack()}>Put it back</button>
        </div>
      )}
      <button className="sound" aria-pressed={sound} aria-label={sound ? "Sound on" : "Sound off"}
        onClick={() => { ensureAudio(); store.set({ sound: !sound }); }}>
        {sound ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M17 9l5 6M22 9l-5 6" fill="none" /></svg>}
      </button>
    </>
  );
}
