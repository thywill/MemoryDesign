import React, { useEffect, useRef, useState } from "react";
import { useStore } from "./store.js";
import { ensureAudio } from "./sound.js";
import { changeDelay, disconnectPhone, getPhoneSnap, startPhone, subscribePhone } from "./hand.js";

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="18" r="0.8" fill="currentColor" />
    </svg>
  );
}

// Pairing for the optional phone hand. The bin underneath is unchanged.
export function PhoneLink() {
  const phone = React.useSyncExternalStore(subscribePhone, getPhoneSnap);
  const taken = useStore((s) => s.taken);
  const [menu, setMenu] = useState(false);
  const canvasRef = useRef(null);
  const paired = phone.phase === "connected" || phone.phase === "disconnected";

  useEffect(() => {
    if (!phone.url || !canvasRef.current) return;
    let live = true;
    const canvas = canvasRef.current;
    import("qrcode").then((mod) => {
      if (!live) return;
      const api = mod.toCanvas ? mod : mod.default;
      return api.toCanvas(canvas, phone.url, { margin: 1, width: 200, color: { dark: "#1d1a16", light: "#00000000" } });
    }).catch(() => {});
    return () => { live = false; };
  }, [phone.url, phone.phase]);

  useEffect(() => { if (phone.phase !== "connected") setMenu(false); }, [phone.phase]);

  const delayLabel = `${phone.delay > 0 ? "+" : ""}${phone.delay} ms`;
  return (
    <div className="phone-ui">
      {paired ? (
        <button type="button" className="phone-launch icon" aria-label={phone.status || "Phone"} aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}>
          <PhoneIcon />
          {phone.phase === "connected" && <i className="phone-dot" />}
        </button>
      ) : (
        <button type="button" className="phone-launch" onClick={() => { ensureAudio(); startPhone(); }}>Use your phone</button>
      )}
      {(phone.phase === "waiting" || phone.phase === "error") && (
        <div className="phone-panel" onWheel={(e) => e.stopPropagation()}>
          <canvas ref={canvasRef} aria-label="QR code for the phone" />
          <div className="code">{phone.code}</div>
          <p role="status">{phone.status}</p>
        </div>
      )}
      {phone.phase === "disconnected" && (
        <div className="phone-panel" onWheel={(e) => e.stopPropagation()}>
          <p role="status">Phone disconnected</p>
        </div>
      )}
      {phone.phase === "connected" && menu && (
        <div className="phone-panel" onWheel={(e) => e.stopPropagation()}>
          <button type="button" className="disconnect" onClick={() => disconnectPhone()}>Disconnect</button>
          <p className="delay">Screen delay <b>{delayLabel}</b></p>
          <div className="phone-menu">
            <button type="button" onClick={() => changeDelay(phone.delay - 10)}>−10 ms</button>
            <button type="button" onClick={() => changeDelay(phone.delay + 10)}>+10 ms</button>
            <button type="button" onClick={() => changeDelay(0)}>Reset</button>
          </div>
        </div>
      )}
      {taken.length > 0 && (
        <ol className="take-tray">
          <b>Taking {taken.length}/3</b>
          {taken.map((r) => <li key={r.id}>{r.c.title}</li>)}
        </ol>
      )}
    </div>
  );
}
