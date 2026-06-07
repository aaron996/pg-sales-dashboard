import { processExcelData, calculateStatus, matchSkuInCatalog } from './excelParser';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DEFAULT_BASELINE_DATA } from './data';
import * as XLSX from 'xlsx';
import { STORE_MAPPING, PRODUCT_PRICES } from './configData';

// --- Component Source: tweaks-panel.jsx ---

// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({ title = 'Tweaks', noDeckControls = false, children }: any) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  // Auto-inject a rail toggle when a <deck-stage> is on the page. The
  // toggle drives the deck's per-viewer _railVisible via window message;
  // state is mirrored from the same localStorage key the deck reads so
  // the control reflects reality across reloads. The mechanism is the
  // message — authors who want custom placement can post it directly
  // and pass noDeckControls to suppress this one.
  const hasDeckStage = React.useMemo(
    () => typeof document !== 'undefined' && !!document.querySelector('deck-stage'),
    [],
  );
  // deck-stage enables its rail in connectedCallback, but this panel can
  // mount before that element has upgraded. The initial read catches the
  // common case; the listener covers mounting first. (Older deck-stage.js
  // copies still wait for the host's __omelette_rail_enabled postMessage —
  // same listener handles those.)
  const [railEnabled, setRailEnabled] = React.useState(
    () => hasDeckStage && !!(document.querySelector('deck-stage') as any)?._railEnabled,
  );
  React.useEffect(() => {
    if (!hasDeckStage || railEnabled) return undefined;
    const onMsg = (e) => {
      if (e.data && e.data.type === '__omelette_rail_enabled') setRailEnabled(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [hasDeckStage, railEnabled]);
  const [railVisible, setRailVisible] = React.useState(() => {
    try { return localStorage.getItem('deck-stage.railVisible') !== '0'; } catch (e) { return true; }
  });
  const toggleRail = (on) => {
    setRailVisible(on);
    window.postMessage({ type: '__deck_rail_visible', on }, '*');
  };
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-noncommentable=""
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={dismiss}>✕</button>
        </div>
        <div className="twk-body">
          {children}
          {hasDeckStage && railEnabled && !noDeckControls && (
            <TweakSection label="Deck">
              <TweakToggle label="Thumbnail rail" value={railVisible} onChange={toggleRail} />
            </TweakSection>
          )}
        </div>
      </div>
    </>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({ label, children }: any) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value = null, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
                        onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                      width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    aria-label={colors.join(', ')} title={colors.join(' · ')}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
});


// --- Component Source: atoms.jsx ---
/* === Atomic visual components === */

// useCountUp: animates from 0 to value
const useCountUp = (target, duration = 900, decimals = 0, deps = []) => {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    const start = performance.now();
    const from = 0;
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutCubic
      const e = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [target, duration, ...deps]);
  return Number(val).toFixed(decimals);
};

// AnimatedNumber: renders a number with count-up
const AnimatedNumber = ({ value, decimals = 0, duration = 900, format = null }) => {
  const raw = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  const isNumeric = !isNaN(raw) && isFinite(raw);
  if (!isNumeric) return <>{value}</>;
  const animated = useCountUp(raw, duration, decimals);
  // If original had comma separators OR explicit format, use locale formatter
  const useLocale = format === 'locale' || (typeof value === 'string' && value.includes(','));
  if (useLocale) {
    return <>{Number(animated).toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
  }
  return <>{animated}</>;
};

// Sparkline with draw-in animation
const Sparkline = ({ data, color = 'currentColor', height = 28, width = 96, fill = true, animate = true }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * width : width / 2;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const fillPath = `${path} L${width},${height} L0,${height} Z`;
  const pathRef = React.useRef(null);
  const [len, setLen] = React.useState(0);
  React.useEffect(() => {
    if (pathRef.current && animate) {
      const l = pathRef.current.getTotalLength();
      setLen(l);
    }
  }, [data, animate]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      {fill && <path d={fillPath} fill={color} fillOpacity="0.12" className={animate ? 'spark-fill-anim' : ''} />}
      <path
        ref={pathRef}
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={animate && len ? {
          strokeDasharray: len,
          strokeDashoffset: len,
          animation: 'sparkDraw 1.1s cubic-bezier(.65,.05,.36,1) forwards'
        } : {}}
      />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color}
        className={animate ? 'spark-dot-anim' : ''} />
    </svg>
  );
};

// Progress bar with target marker
const ProgressBar = ({ value, target = 100, height = 8, label = false }) => {
  const pct = Math.min((value / target) * 100, 130);
  const color = pct >= 100 ? 'var(--c-good)' : pct >= 85 ? 'var(--c-warn)' : 'var(--c-bad)';
  return (
    <div style={{ position: 'relative', width: '100%', height, background: 'var(--c-surface-2)', borderRadius: 999 }}>
      <div style={{
        position: 'absolute', inset: 0, width: `${Math.min(pct, 100)}%`,
        background: color, borderRadius: 999, transition: 'width .6s cubic-bezier(.2,.8,.2,1)'
      }} />
      {pct > 100 && (
        <div style={{
          position: 'absolute', left: '100%', top: 0, height: '100%',
          width: `${Math.min(pct - 100, 30)}%`,
          background: 'var(--c-good)', opacity: 0.4, borderRadius: '0 999px 999px 0'
        }} />
      )}
      {label && (
        <div style={{ position: 'absolute', right: 4, top: -16, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--c-text-2)' }}>
          {pct.toFixed(0)}%
        </div>
      )}
    </div>
  );
};

// Currency formatter
const fmtVND = (n) => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' tr';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return String(n);
};
const fmtVNDfull = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
// Always return value in billions (tỷ) as a plain number string, e.g. 966_700_000 -> "0.97"
const fmtTy = (n) => (n / 1e9).toFixed(n >= 1e9 ? 2 : 2);

// KPI tile with count-up
const Kpi = ({ label, value, suffix, delta, deltaDir, spark, sparkColor, footer, accent, animIdx = 0, onClick, active }: any) => {
  // Detect if value is numeric to animate
  const rawStr = typeof value === 'string' ? value.replace(/,/g, '') : String(value);
  const num = parseFloat(rawStr);
  const isNumeric = !isNaN(num) && isFinite(num);
  const decimals = typeof value === 'string' && value.includes('.') ? (value.split('.')[1] || '').length : 0;
  const useLocale = typeof value === 'string' && value.includes(',');
  return (
    <div 
      className={`kpi anim-rise ${active ? 'active' : ''}`} 
      style={{ 
        animationDelay: `${animIdx * 70}ms`,
        cursor: onClick ? 'pointer' : undefined,
        borderColor: active ? (accent || 'var(--c-accent)') : undefined,
        boxShadow: active ? `0 0 0 2px color-mix(in srgb, ${accent || 'var(--c-accent)'} 25%, transparent)` : undefined
      }}
      onClick={onClick}
    >
      <div className="kpi-row">
        <div className="kpi-label">{label}</div>
        {delta && (
          <div className={`kpi-delta ${deltaDir === 'up' ? 'up' : deltaDir === 'down' ? 'down' : ''}`}>
            {deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : '●'} {delta}
          </div>
        )}
      </div>
      <div className="kpi-value-row">
        <div className="kpi-value" style={{ color: accent }}>
          {isNumeric ? <AnimatedNumber value={num} decimals={decimals} duration={1000 + animIdx * 80} format={useLocale ? 'locale' : undefined} /> : value}
          {suffix && <span className="kpi-suffix">{suffix}</span>}
        </div>
        {spark && (
          <div className="kpi-spark">
            <Sparkline data={spark} color={sparkColor || accent || 'var(--c-accent)'} width={100} height={36} />
          </div>
        )}
      </div>
      {footer && <div className="kpi-foot">{footer}</div>}
    </div>
  );
};

// Filter chip
const Chip = ({ active, onClick, children, count }: any) => (
  <button onClick={onClick} className={`chip ${active ? 'active' : ''}`}>
    {children}
    {count !== undefined && <span className="chip-count">{count}</span>}
  </button>
);

// Severity dot
const SevDot = ({ sev }: any) => (
  <span className={`sev-dot sev-${sev}`} />
);

// Region row (horizontal bar)
const RegionRow = ({ r, idx = 0 }: any) => {
  const pct = (r.rev / r.target) * 100;
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setW(Math.min(pct, 100)), 100 + idx * 80);
    return () => clearTimeout(t);
  }, [pct, idx]);
  return (
    <div className="region-row anim-slide-in" style={{ animationDelay: `${idx * 60}ms` }}>
      <div className="region-name">{r.name}</div>
      <div className="region-bar-wrap">
        <div className="region-bar-bg">
          <div className="region-bar-fill" style={{ width: `${w}%`, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} />
        </div>
      </div>
      <div className="region-val mono"><AnimatedNumber value={r.rev} decimals={0} duration={1000} /></div>
      <div className={`region-pct mono ${pct >= 100 ? 'good' : pct >= 85 ? 'warn' : 'bad'}`}>
        <AnimatedNumber value={pct} decimals={0} duration={1000} />%
      </div>
      <div className="region-ba mono">{r.baCount} BA</div>
    </div>
  );
};

// Make components global
Object.assign(window, { Sparkline, ProgressBar, fmtVND, fmtVNDfull, fmtTy, Kpi, Chip, SevDot, RegionRow, AnimatedNumber, useCountUp });


// --- Component Source: trend-chart.jsx ---
/* === Trend chart — 2-line CRV vs STMB === */
const TrendChart = ({ data, channels, height = 280 }) => {
  const containerRef = React.useRef(null);
  const [width, setWidth] = React.useState(800);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width) {
          setWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const W = width;
  const H = height;
  const PAD = { l: 50, r: 16, t: 16, b: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const allVals = data.flatMap(d => [
    channels.includes('crv') ? d.crv : 0,
    channels.includes('stmb') ? d.stmb : 0,
    d.target || 0,
  ]);
  const max = Math.ceil(Math.max(...allVals, 1) / 50) * 50;

  const xStep = innerW / Math.max(data.length - 1, 1);
  const yScale = v => PAD.t + innerH - (v / max) * innerH;
  const xScale = i => PAD.l + i * xStep;

  const buildPath = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d[key] || 0)}`).join(' ');
  const buildArea = (key) => `${buildPath(key)} L${xScale(data.length - 1)},${PAD.t + innerH} L${xScale(0)},${PAD.t + innerH} Z`;

  const yTicks = [0, max * 0.25, max * 0.5, max * 0.75, max].map(v => Math.round(v));

  const [hoverIdx, setHoverIdx] = React.useState(null);
  const crvRef = React.useRef(null);
  const stmbRef = React.useRef(null);
  const [crvLen, setCrvLen] = React.useState(0);
  const [stmbLen, setStmbLen] = React.useState(0);

  React.useEffect(() => {
    if (crvRef.current) setCrvLen(crvRef.current.getTotalLength());
    if (stmbRef.current) setStmbLen(stmbRef.current.getTotalLength());
  }, [data, channels, W]); // depend on W so it recalculates lengths on resize!

  const animKey = channels.join('-') + data.length;
  const targetVal = data[0]?.target || 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W - PAD.l;
          const i = Math.round(x / xStep);
          if (i >= 0 && i < data.length) setHoverIdx(i);
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yScale(t)} y2={yScale(t)} stroke="var(--c-grid)" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '2 4'} />
            <text x={PAD.l - 8} y={yScale(t) + 3} fontSize="10" fontFamily="var(--font-mono)" fill="var(--c-text-3)" textAnchor="end">{t}</text>
          </g>
        ))}

        {targetVal > 0 && (
          <>
            <line x1={PAD.l} x2={W - PAD.r} y1={yScale(targetVal)} y2={yScale(targetVal)}
              stroke="var(--c-text-3)" strokeWidth="1" strokeDasharray="4 4" />
            <text x={W - PAD.r - 4} y={yScale(targetVal) - 4} fontSize="9" fontFamily="var(--font-mono)" fill="var(--c-text-3)" textAnchor="end">
              Daily target {targetVal}
            </text>
          </>
        )}

        {data.map((d, i) => (
          (i % 2 === 0 || i === data.length - 1) && (
            <text key={i} x={xScale(i)} y={H - 8} fontSize="10" fontFamily="var(--font-mono)" fill="var(--c-text-3)" textAnchor="middle">{d.d}</text>
          )
        ))}

        {channels.includes('crv') && (
          <g key={`crv-${animKey}`}>
            <path d={buildArea('crv')} fill="var(--c-crv)" fillOpacity="0.12" className="chart-area-anim" />
            <path
              ref={crvRef}
              d={buildPath('crv')}
              fill="none"
              stroke="var(--c-crv)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={crvLen ? { strokeDasharray: crvLen, strokeDashoffset: crvLen, animation: 'lineDraw 1.4s cubic-bezier(.65,.05,.36,1) forwards' } : {}}
            />
          </g>
        )}
        {channels.includes('stmb') && (
          <g key={`stmb-${animKey}`}>
            <path d={buildArea('stmb')} fill="var(--c-stmb)" fillOpacity="0.12" className="chart-area-anim" style={{ animationDelay: '.15s' }} />
            <path
              ref={stmbRef}
              d={buildPath('stmb')}
              fill="none"
              stroke="var(--c-stmb)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={stmbLen ? { strokeDasharray: stmbLen, strokeDashoffset: stmbLen, animation: 'lineDraw 1.4s cubic-bezier(.65,.05,.36,1) .15s forwards' } : {}}
            />
          </g>
        )}

        {data.map((d, i) => (
          <g key={i}>
            {channels.includes('crv') && d.crv > 0 && (
              <circle cx={xScale(i)} cy={yScale(d.crv)} r={hoverIdx === i ? 4 : 2.5} fill="var(--c-crv)" stroke="var(--c-bg)" strokeWidth="1.5"
                style={{ opacity: 0, animation: `dotPop .35s ${1.2 + i * 0.05}s cubic-bezier(.34,1.56,.64,1) forwards` }} />
            )}
            {channels.includes('stmb') && d.stmb > 0 && (
              <circle cx={xScale(i)} cy={yScale(d.stmb)} r={hoverIdx === i ? 4 : 2.5} fill="var(--c-stmb)" stroke="var(--c-bg)" strokeWidth="1.5"
                style={{ opacity: 0, animation: `dotPop .35s ${1.35 + i * 0.05}s cubic-bezier(.34,1.56,.64,1) forwards` }} />
            )}
          </g>
        ))}

        {hoverIdx !== null && hoverIdx < data.length && (
          <line x1={xScale(hoverIdx)} x2={xScale(hoverIdx)} y1={PAD.t} y2={PAD.t + innerH} stroke="var(--c-text-2)" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
        )}
      </svg>

      {hoverIdx !== null && hoverIdx < data.length && data[hoverIdx] && (
        <div className="chart-tip" style={{ left: `${(xScale(hoverIdx) / W) * 100}%` }}>
          <div className="chart-tip-date">{data[hoverIdx].d}</div>
          {channels.includes('crv') && (
            <div className="chart-tip-row"><span className="dot" style={{ background: 'var(--c-crv)' }} />CRV<span className="mono">{data[hoverIdx].crv}</span></div>
          )}
          {channels.includes('stmb') && (
            <div className="chart-tip-row"><span className="dot" style={{ background: 'var(--c-stmb)' }} />STMB<span className="mono">{data[hoverIdx].stmb}</span></div>
          )}
        </div>
      )}
    </div>
  );
};

(window as any).TrendChart = TrendChart;


// --- Component Source: telegram.jsx ---
/* === Telegram Bot Composer === */
const TELE_TEMPLATES = [
  {
    id: 'daily',
    name: 'Daily Recap',
    desc: 'Tự động 18:00 hàng ngày',
    icon: '📊',
    body: ({ today }) => `📊 *INTERDIST · P&G DAILY RECAP*
${today}

💰 Doanh số ngày: *695 triệu* (CRV 410M · STMB 285M)
🎯 MTD: *14.4 tỷ / 17 tỷ* — 84.7%
🔥 Top: GO Đà Lạt (192M · 113%)
⚠️ Báo động: 2 BA dưới 45% target

→ Mở dashboard: interdist.io/dash`,
  },
  {
    id: 'alert',
    name: 'Alert · Báo động',
    desc: 'Gửi khi BA < 50% target 3 ngày',
    icon: '🚨',
    body: () => `🚨 *CẢNH BÁO HIỆU SUẤT*

3 BA dưới 50% target liên tục 3+ ngày:
• Nguyễn Văn Bình (GOLT099) — 40%
• Lê Thị Thảo (STMB053) — 45%
• Trần Văn An (STMB012) — 52%

@TuanSup vui lòng follow-up trong hôm nay.`,
  },
  {
    id: 'weekly',
    name: 'Weekly Summary',
    desc: 'Tự động sáng Thứ Hai',
    icon: '📈',
    body: () => `📈 *WEEKLY · TUẦN 19/2026*

MTD: 14.4 tỷ (84.7% target)
Δ vs tuần trước: +8.2%

Vùng leader: NORTH (93%)
Vùng cần đẩy: MEKONG (76%)
Cat leader: Skin Care (110%)
Cat lag: Oral Care (86%)

Action items: 6 (2 high · 2 med · 2 low)`,
  },
  {
    id: 'oos',
    name: 'OOS Alert',
    desc: 'Khi shop báo hết hàng',
    icon: '📦',
    body: () => `📦 *OUT OF STOCK*

GO Thái Nguyên · Pantene 320ml
Hết hàng từ: 14/05 (4 ngày)
SKU code: PG-PAN-320-S

→ Logistics: ưu tiên giao 19/05`,
  },
];

const TELE_CHANNELS = [
  { id: 'ops', name: 'Interdist · P&G Ops', members: 24, badge: 'PRIMARY' },
  { id: 'sup', name: 'Supervisor Vùng', members: 8 },
  { id: 'mgmt', name: 'Management', members: 4 },
];

const TELE_HISTORY = [
  { time: '14:32 Hôm nay', tmpl: 'alert', channel: 'Supervisor Vùng', status: 'delivered', reads: '6/8' },
  { time: '09:00 Hôm nay', tmpl: 'weekly', channel: 'Management', status: 'delivered', reads: '4/4' },
  { time: '18:00 Hôm qua', tmpl: 'daily', channel: 'Interdist · P&G Ops', status: 'delivered', reads: '22/24' },
  { time: '11:14 Hôm qua', tmpl: 'oos', channel: 'Interdist · P&G Ops', status: 'delivered', reads: '24/24' },
];

const TelegramComposer = ({ open, onClose, project = 'stmb', pdata }) => {
  return null;
  // Compute dynamic content from current project data
  const D = pdata || ((window as any).INTERDIST_DATA ? (window as any).INTERDIST_DATA[project] : null);
  const stores = D ? [...D.stores].sort((a,b) => a.pct - b.pct) : [];
  const offCount = D ? stores.filter(s => s.pct < (D.meta.timegone || 40)).length : 0;
  const projTitle = project === 'crv' ? 'CRV BA' : 'STMB';
  const dynTemplates = [
    {
      id: 'daily',
      name: 'Daily Recap',
      desc: 'Tự động 18:00 hàng ngày',
      icon: '📊',
      body: () => D ? `📊 *INTERDIST · P&G · ${projTitle} · DAILY RECAP*
Updated: ${D.meta.updated_to}

💰 Actual SO: *${(D.total.actual/1e9).toFixed(2)} tỷ*
🎯 Target Full: ${(D.total.target/1e9).toFixed(2)} tỷ
📈 %Ach: *${D.total.pct.toFixed(1)}%* (Timegone ${D.meta.timegone}%)
🔥 Top: ${stores[stores.length-1].store} (${stores[stores.length-1].pct.toFixed(1)}%)
⚠️ Off Track: ${offCount}/${stores.length} stores

→ Mở dashboard: interdist.io/dash` : '',
    },
    {
      id: 'alert',
      name: 'Alert · Báo động',
      desc: 'Gửi khi store < 50% timegone',
      icon: '🚨',
      body: () => D ? `🚨 *CẢNH BÁO HIỆU SUẤT · ${projTitle}*

${stores.slice(0, 3).map(s => `• ${s.store} (${s.code}) — ${s.pct.toFixed(1)}%`).join('\n')}

@TuanSup vui lòng follow-up trong hôm nay.` : '',
    },
    {
      id: 'weekly',
      name: 'Weekly Summary',
      desc: 'Tự động sáng Thứ Hai',
      icon: '📈',
      body: () => D ? `📈 *WEEKLY · ${projTitle}*

Actual: ${(D.total.actual/1e9).toFixed(2)} tỷ (${D.total.pct.toFixed(1)}% target)
${D.wow ? D.wow.map(w => `${w.cat}: W19 ${w.change >= 100 ? '▲' : '▼'} ${w.change.toFixed(0)}%`).join('\n') : ''}

Off Track: ${offCount} stores cần đẩy` : '',
    },
    {
      id: 'oos',
      name: 'OOS Alert',
      desc: 'Khi shop báo hết hàng',
      icon: '📦',
      body: () => `📦 *OUT OF STOCK · ${projTitle}*

${stores[0] ? stores[0].store : 'Store'} · Pantene 320ml
Hết hàng từ: 14/05 (4 ngày)
SKU code: PG-PAN-320-S

→ Logistics: ưu tiên giao sớm`,
    },
  ];

  const [tmplId, setTmplId] = React.useState('daily');
  const [channelId, setChannelId] = React.useState('ops');
  const [scheduled, setScheduled] = React.useState(false);
  const [scheduleTime, setScheduleTime] = React.useState('18:00');
  const [sent, setSent] = React.useState(false);
  const [pinned, setPinned] = React.useState(true);

  const tmpl = dynTemplates.find(t => t.id === tmplId);
  const channel = TELE_CHANNELS.find(c => c.id === channelId);
  const body = tmpl.body();

  const handleSend = () => {
    setSent(true);
    setTimeout(() => { setSent(false); onClose && onClose(); }, 1400);
  };

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="tele-overlay" onClick={onClose}>
      <div className="tele-modal" onClick={e => e.stopPropagation()}>
        <div className="tele-head">
          <div className="tele-head-left">
            <div className="tele-bot-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
            </div>
            <div>
              <div className="tele-title">Telegram Bot · @InterdistOpsBot</div>
              <div className="tele-sub">Soạn & gửi thông báo</div>
            </div>
          </div>
          <button className="tele-close" onClick={onClose}>✕</button>
        </div>

        <div className="tele-body">
          {/* Left: Templates + Channel */}
          <div className="tele-left">
            <div className="tele-section">
              <div className="tele-section-title">TEMPLATE</div>
              <div className="tele-templates">
                {dynTemplates.map(t => (
                  <button key={t.id} className={`tele-tmpl ${tmplId === t.id ? 'active' : ''}`} onClick={() => setTmplId(t.id)}>
                    <span className="tele-tmpl-icon">{t.icon}</span>
                    <div className="tele-tmpl-meta">
                      <div className="tele-tmpl-name">{t.name}</div>
                      <div className="tele-tmpl-desc">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="tele-section">
              <div className="tele-section-title">GỬI TỚI</div>
              <div className="tele-channels">
                {TELE_CHANNELS.map(c => (
                  <label key={c.id} className={`tele-channel ${channelId === c.id ? 'active' : ''}`}>
                    <input type="radio" name="channel" checked={channelId === c.id} onChange={() => setChannelId(c.id)} />
                    <span className="tele-ch-name">{c.name}</span>
                    <span className="tele-ch-members">{c.members} mem</span>
                    {c.badge && <span className="tele-ch-badge">{c.badge}</span>}
                  </label>
                ))}
              </div>
            </div>

            <div className="tele-section">
              <div className="tele-section-title">LỊCH GỬI</div>
              <div className="tele-schedule">
                <label className="tele-radio">
                  <input type="radio" checked={!scheduled} onChange={() => setScheduled(false)} />
                  <span>Gửi ngay</span>
                </label>
                <label className="tele-radio">
                  <input type="radio" checked={scheduled} onChange={() => setScheduled(true)} />
                  <span>Đặt lịch lặp lại lúc</span>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} disabled={!scheduled} className="tele-time" />
                </label>
                <label className="tele-check">
                  <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
                  <span>Pin tin nhắn lên đầu kênh</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="tele-right">
            <div className="tele-section-title">PREVIEW</div>
            <div className="tele-preview">
              <div className="tele-preview-head">
                <div className="tele-preview-avatar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
                </div>
                <div>
                  <div className="tele-preview-bot">InterdistOpsBot</div>
                  <div className="tele-preview-ch">to {channel.name}</div>
                </div>
              </div>
              <div className="tele-preview-bubble">
                <pre className="tele-preview-text">{body}</pre>
                {pinned && <div className="tele-preview-pin">📌 PINNED</div>}
                <div className="tele-preview-time">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ✓✓</div>
              </div>
            </div>

            <div className="tele-section" style={{ marginTop: 20 }}>
              <div className="tele-section-title">LỊCH SỬ GẦN ĐÂY</div>
              <div className="tele-history">
                {TELE_HISTORY.map((h, i) => {
                  const t = dynTemplates.find(x => x.id === h.tmpl);
                  return (
                    <div key={i} className="tele-hist-row">
                      <span className="tele-hist-icon">{t.icon}</span>
                      <div className="tele-hist-meta">
                        <div className="tele-hist-name">{t.name} · <span className="tele-hist-ch">{h.channel}</span></div>
                        <div className="tele-hist-time">{h.time}</div>
                      </div>
                      <div className="tele-hist-reads mono">{h.reads}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="tele-foot">
          <div className="tele-foot-info">
            <span className="mono">{body.length}</span> ký tự · Markdown enabled
          </div>
          <div className="tele-foot-actions">
            <button className="btn btn-ghost" onClick={onClose}>Huỷ</button>
            <button className={`btn btn-primary ${sent ? 'sent' : ''}`} onClick={handleSend} disabled={sent}>
              {sent ? '✓ Đã gửi tới ' + channel.members + ' thành viên' : (scheduled ? 'Lên lịch & lưu' : 'Gửi tới ' + channel.name)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

(window as any).TelegramComposer = TelegramComposer;

const catLabel = (k: string) => {
  const m: Record<string, string> = {
    HAIRCARE: 'Hair Care', SHAVECARE: 'Shave Care', SKINCARE: 'Skin Care', LAUNDRY: 'Laundry',
  };
  return m[k] || k;
};


// --- Component Source: export-report.jsx ---
/* === Export Report Preview === */
const ExportReport = ({ open, project, pdata, onClose, onPrint }) => {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const isCRV = project === 'crv';
  const title = isCRV ? 'CRV BA Long Term' : 'STMB';
  const totalRev = pdata.total.actual;
  const target   = pdata.total.target;
  const pct = pdata.total.pct;
  const timegone = pdata.meta.timegone;
  const stores = [...pdata.stores].sort((a, b) => b.pct - a.pct);
  const onTrack = stores.filter(s => s.pct >= timegone).length;
  const below70 = stores.filter(s => s.pct < timegone * 0.7).length;

  return (
    <div className="tele-overlay" onClick={onClose}>
      <div className="report-modal" id="printable-report" onClick={e => e.stopPropagation()}>
        <div className="report-head">
          <div>
            <div className="report-eyebrow mono">INTERDIST · P&G · {title.toUpperCase()}</div>
            <div className="report-title">Báo cáo Hiệu suất Kênh {title}</div>
            <div className="report-sub">Chu kỳ {pdata.meta.start_day} — {pdata.meta.end_day} · Updated {pdata.meta.updated_to}</div>
          </div>
          <button className="tele-close no-print" onClick={onClose}>✕</button>
        </div>

        <div className="report-body">
          <div className="report-cover">
            <div className="report-cover-main">
              <div className="report-cover-label mono">ACTUAL SO</div>
              <div className="report-cover-val mono">{fmtVNDfull(totalRev)} <span>VNĐ</span></div>
              <div className="report-cover-tgt mono">/ {fmtVNDfull(target)} target</div>
            </div>
            <div className="report-cover-side">
              <div className="report-cover-stat">
                <div className="mono">{pct.toFixed(1)}%</div>
                <div>%Ach Full Month</div>
              </div>
              <div className="report-cover-stat">
                <div className="mono">{stores.length}</div>
                <div>điểm bán active</div>
              </div>
              <div className="report-cover-stat">
                <div className="mono">{onTrack}</div>
                <div>on-track ≥ {timegone.toFixed(0)}%</div>
              </div>
              <div className="report-cover-stat">
                <div className="mono" style={{ color: 'var(--c-bad)' }}>{below70}</div>
                <div>dưới {(timegone * 0.7).toFixed(0)}%</div>
              </div>
            </div>
          </div>

          <div className="report-section">
            <div className="report-section-title">EXECUTIVE SUMMARY</div>
            <ul className="report-bullets">
              <li><b>Trạng thái:</b> Kênh đang ở <b style={{ color: pct >= timegone ? 'var(--c-good)' : 'var(--c-bad)' }}>{pct >= timegone ? 'ON-TRACK' : 'OFF-TRACK'}</b>, gap vs Timegone = <b className="mono">{(pct - timegone).toFixed(1)}pp</b>.</li>
              <li><b>Top performer:</b> {stores[0].store} ({stores[0].pct.toFixed(1)}% target).</li>
              <li><b>Worst:</b> {stores[stores.length - 1].store} ({stores[stores.length - 1].pct.toFixed(1)}%) — cần follow-up.</li>
              <li><b>WoW:</b> {pdata.wow ? pdata.wow.map(w => `${catLabel(w.cat)} ${w.change >= 100 ? '▲' : '▼'} ${w.change.toFixed(0)}%`).join(' · ') : 'N/A'}</li>
            </ul>
          </div>

          <div className="report-section">
            <div className="report-section-title">CATEGORY MIX · %ACH</div>
            <div className="report-stores">
              {pdata.cats.filter(c => c.actual > 0).map(c => {
                const cpct = c.target > 0 ? (c.actual / c.target * 100) : 0;
                const tier = cpct >= timegone ? 'good' : cpct >= timegone * 0.75 ? 'warn' : 'bad';
                return (
                  <div key={c.cat} className="report-store">
                    <div className="report-store-row">
                      <span className="report-store-name">{catLabel(c.cat)}</span>
                      <span className={`report-store-pct mono ${tier}`}>{cpct > 0 ? cpct.toFixed(1) + '%' : '—'}</span>
                    </div>
                    <div className="report-store-bar">
                      <div className={`report-store-fill ${tier}`} style={{ width: `${Math.min(cpct, 100)}%` }} />
                    </div>
                    <div className="report-store-rev mono">{fmtVNDfull(c.actual)} VNĐ</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="report-section">
            <div className="report-section-title">CHI TIẾT THEO ĐIỂM BÁN · {stores.length} STORES</div>
            <div className="report-stores">
              {stores.map(s => {
                const tier = s.pct >= timegone ? 'good' : s.pct >= timegone * 0.75 ? 'warn' : 'bad';
                return (
                  <div key={s.code + s.store} className="report-store">
                    <div className="report-store-row">
                      <span className="report-store-name">{s.store}{s.region ? ' · ' + s.region : ''}</span>
                      <span className={`report-store-pct mono ${tier}`}>{s.pct.toFixed(1)}%</span>
                    </div>
                    <div className="report-store-bar">
                      <div className={`report-store-fill ${tier}`} style={{ width: `${Math.min(s.pct, 100)}%` }} />
                    </div>
                    <div className="report-store-rev mono">{fmtVNDfull(s.actual)} / {fmtVNDfull(s.target)} VNĐ</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="report-foot no-print">
          <div className="report-foot-info mono">Báo cáo tự sinh · Interdist Analytics v2.0</div>
          <div className="tele-foot-actions">
            <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
            <button className="btn btn-ghost" onClick={() => { try { navigator.clipboard.writeText((document.querySelector('.report-body') as any).innerText); } catch(e){} }}>📋 Copy nội dung</button>
            <button className="btn btn-primary" onClick={onPrint}>⬇ Tải PDF</button>
          </div>
        </div>
      </div>
    </div>
  );
};

(window as any).ExportReport = ExportReport;


// --- Component Source: export-excel.jsx ---
/* === Clean Excel Export Dialog === */
const ExportExcelDialog = ({ open, onClose }) => {
  // NOTE: This component intentionally shadows the name to re-export to window below
  const [channel, setChannel] = React.useState('all');
  const [period, setPeriod] = React.useState('mtd');
  const [isExporting, setIsExporting] = React.useState(false);
  const [error, setError] = React.useState('');

  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, isExporting]);

  const D = (window as any).INTERDIST_DATA || {};
  const meta = D?.crv?.meta || { start_day: '', updated_to: '' };

  const safePct = (actual, target) => {
    actual = Number(actual) || 0;
    target = Number(target) || 0;
    return target > 0 ? actual / target : 0;
  };

  const fmtNum = (v) => Number(v) || 0;

  const addSheet = (wb, name, rows) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  const hasRawData = !!(D?.tables_data?.raw_rows?.length || D?.rawRows?.length);

  const dateRangeBounds = React.useMemo(() => {
    let flatRawRows: any[] = [];
    if (D.tables_data?.raw_rows && D.tables_data.raw_rows.length > 0) {
      flatRawRows = D.tables_data.raw_rows;
    } else if (D.rawRows && D.rawRows.length > 0) {
      flatRawRows = D.rawRows;
    } else {
      const synthRows: any[] = [];
      const processGroup = (group: any, label: string) => {
        const storesList = group?.stores || [];
        const dailyData = group?.daily || {};
        storesList.forEach((s: any) => {
          const storeCode = s.code || '';
          const region = s.region || '';
          const mtdActual = Number(s.actual || s.actual_mtd || s.actual_full || 0);
          const daysWithSales = Object.keys(dailyData).filter(dayStr => {
            const regData = dailyData[dayStr]?.[region];
            return regData && regData.TOTAL > 0;
          });
          if (mtdActual > 0 && daysWithSales.length > 0) {
            daysWithSales.forEach(dayStr => {
              const [d, m] = dayStr.split('/');
              synthRows.push({ time: new Date(2026, 4, Number(d)).getTime() });
            });
          }
        });
      };
      processGroup(D?.crv, 'CRV');
      processGroup(D?.stmb, 'STMB');
      flatRawRows = synthRows;
    }
    
    if (flatRawRows.length === 0) {
      return { min: '2026-05-01', max: '2026-05-31' };
    }
    
    const parsedTimes = flatRawRows.map(r => {
      const d = r['Ngày báo cáo'];
      if (d instanceof Date) return d.getTime();
      if (r.time) return r.time;
      if (d) return new Date(d).getTime();
      return null;
    }).filter(Boolean) as number[];
    
    if (parsedTimes.length === 0) {
      return { min: '2026-05-01', max: '2026-05-31' };
    }
    
    const minTime = Math.min(...parsedTimes);
    const maxTime = Math.max(...parsedTimes);
    
    const fmt = (time: number) => {
      const dt = new Date(time);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    return { min: fmt(minTime), max: fmt(maxTime) };
  }, [D]);

  React.useEffect(() => {
    if (dateRangeBounds) {
      setCustomStart(dateRangeBounds.min);
      setCustomEnd(dateRangeBounds.max);
    }
  }, [dateRangeBounds]);

  const exportExcel = () => {
    try {
      setError('');

      if (!hasRawData) {
        throw new Error('Bạn chưa import data');
      }

      setIsExporting(true);

      const wb = XLSX.utils.book_new();

      const rawRows: any[] = D?.tables_data?.raw_rows || D?.rawRows || [];

      const cols = [
        'Channel', 'Mã cửa hàng', 'Tên cửa hàng', 'Mã vùng',
        'Mã nhân viên', 'Ngày báo cáo', 'Category',
        'Item Name', 'Quantity', 'Unit Price', 'AMT', 'Project'
      ];

      const safeFormatDate = (dateVal: any) => {
        if (!dateVal) return '';
        if (dateVal instanceof Date) {
          const y = dateVal.getFullYear();
          const m = String(dateVal.getMonth() + 1).padStart(2, '0');
          const d = String(dateVal.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        if (typeof dateVal === 'string') return dateVal.split('T')[0];
        return String(dateVal);
      };

      const buildDetailRows = (proj: string) => {
        const rows: any[][] = [cols];
        const filtered = rawRows.filter((r: any) => {
          const p = String(r.Project || '').toLowerCase();
          return proj === 'all' ? true : p === proj;
        });
        filtered.forEach((r: any) => {
          rows.push([
            r['Channel'] || (String(r.Project || '').toLowerCase() === 'crv' ? 'CRV' : 'STMB'),
            r['Mã cửa hàng'] || '',
            r['Tên cửa hàng'] || '',
            r['Mã vùng'] || '',
            r['Mã nhân viên'] || '',
            safeFormatDate(r['Ngày báo cáo']),
            r['Category'] || '',
            r['Item Name'] || '',
            fmtNum(r['Quantity']),
            fmtNum(r['Unit Price']),
            fmtNum(r['AMT']),
            r['Project'] || ''
          ]);
        });
        return rows;
      };

      if (channel === 'all' || channel === 'crv') {
        addSheet(wb, 'Raw CRV', buildDetailRows('crv'));
      }
      if (channel === 'all' || channel === 'stmb') {
        addSheet(wb, 'Raw STMB', buildDetailRows('stmb'));
      }

      const fileName = `PG_Interdist_Export_${channel}_${period}_Raw_${new Date().toISOString().slice(0,10)}.xlsx`;

      XLSX.writeFile(wb, fileName);

      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 300);

    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
      setIsExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="tele-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting) onClose();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        background: 'rgba(10,25,47,0.4)',
        backdropFilter: 'blur(12px)'
      }}
    >
      <div
        className="report-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '28px',
          borderRadius: '20px',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)'
        }}
      >
        <h2 style={{ marginTop: 0 }}>Xuất Excel</h2>
        <p style={{ color: 'var(--c-text-2)', marginBottom: '20px' }}>
          Tải dữ liệu chi tiết (Raw Data) ra file Excel.
        </p>

        {!hasRawData && (
          <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '13px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
            ⚠️ Bạn chưa import data
          </div>
        )}

        <div style={{ display: 'grid', gap: '12px', margin: '0 0 20px 0' }}>
          <label>
            Kênh (Channel)
            <select value={channel} onChange={e => setChannel(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
              <option value="all">Tất cả (CRV + STMB)</option>
              <option value="crv">CRV</option>
              <option value="stmb">STMB</option>
            </select>
          </label>

          <label>
            Kỳ báo cáo (Period)
            <select value={period} onChange={e => setPeriod(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
              <option value="mtd">MTD (Month-to-Date)</option>
              <option value="weekly">Weekly (WTD)</option>
              <option value="fullMonth">Full Month</option>
            </select>
          </label>
        </div>

        {error && (
          <div style={{ color: '#ef4444', marginBottom: '12px', fontSize: '13px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)' }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={isExporting}>
            Đóng
          </button>
          <button className="btn btn-primary" onClick={exportExcel} disabled={isExporting || !hasRawData}>
            {isExporting ? '⏳ Đang xuất...' : '📥 Tải Excel'}
          </button>
        </div>
      </div>
    </div>
  );
};

(window as any).ExportExcelDialog = ExportExcelDialog;


/* === Glassmorphic Drag-and-Drop Import Portal === */
const DashboardImportPortal = ({ onClose, onDataParsed, theme = 'light', canClose = true }) => {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedList, setUploadedList] = useState<any[]>(() => {
    return (window as any)._IMPORTED_FILES || [];
  });

  const isLight = theme === 'light';

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading && canClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, loading, canClose]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const reprocessFiles = (newList) => {
    try {
      const baseline = DEFAULT_BASELINE_DATA;
      if (newList.length === 0) {
        onDataParsed(baseline, "", false);
        if ((window as any).addDashboardLog) {
          (window as any).addDashboardLog(`🗑 Đã xóa toàn bộ file, khôi phục dữ liệu mẫu.`);
        }
        return;
      }
      
      const processed = processExcelData(newList, baseline);
      
      const mergedName = newList.length === 1 ? newList[0].name : `${newList.length} tệp dữ liệu gộp`;
      onDataParsed(processed, mergedName, false);
      if ((window as any).addDashboardLog) {
        (window as any).addDashboardLog(`🔄 Đã cập nhật lại tổng số ${newList.length} tệp dữ liệu.`);
      }
    } catch (err: any) {
      if ((window as any).addDashboardLog) (window as any).addDashboardLog(`❌ Lỗi xử lý dữ liệu: ${err.message}`);
      setErrorMsg(`Lỗi phân tích dữ liệu: ${err.message}.`);
      setLoading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    const newList = [...uploadedList];
    newList.splice(index, 1);
    (window as any)._IMPORTED_FILES = newList;
    setUploadedList(newList);
    reprocessFiles(newList);
  };

  const processFiles = async (files: File[] | FileList) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const acceptedFiles = fileList.filter(file => {
      const name = file.name.toLowerCase();
      return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsb') || name.endsWith('.csv');
    });

    if (acceptedFiles.length === 0) {
      setErrorMsg("Định dạng file không hợp lệ! Vui lòng tải lên các tệp Excel hoặc CSV");
      setSuccessMsg("");
      return;
    }

    setErrorMsg("");
    setLoading(true);
    const count = acceptedFiles.length;
    setLoadingStep(`Đang nạp ${count} tệp...`);

    if ((window as any).addDashboardLog) {
      (window as any).addDashboardLog(`📁 Bắt đầu tải ${count} tệp dữ liệu`);
    }

    try {
      const newProcessed = await Promise.all(
        acceptedFiles.map(file => {
          return new Promise<any>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e: any) => {
              resolve({
                data: e.target.result,
                name: file.name,
                size: file.size
              });
            };
            reader.onerror = () => reject(new Error(`Không thể đọc file: ${file.name}`));
            if (file.name.toLowerCase().endsWith('.csv')) {
              reader.readAsText(file, 'UTF-8');
            } else {
              reader.readAsArrayBuffer(file);
            }
          });
        })
      );

      const newList = [...uploadedList, ...newProcessed];
      (window as any)._IMPORTED_FILES = newList;
      setUploadedList(newList);

      setLoadingStep("Đang phân tích và gộp dữ liệu các tệp...");
      const baseline = DEFAULT_BASELINE_DATA;
      const processed = processExcelData(newList, baseline);
      
      setLoadingStep("Hoàn thành! Đang nạp giao diện báo cáo...");
      if ((window as any).addDashboardLog) {
        (window as any).addDashboardLog(`✅ Phân tích và gộp thành công ${count} tệp! Tổng cộng ${newList.length} tệp.`);
      }
      setSuccessMsg(`Đọc và gộp thành công. Vui lòng đóng cổng dữ liệu hoặc thêm file khác.`);
      
      setTimeout(() => {
        const mergedName = newList.length === 1 ? newList[0].name : `${newList.length} tệp dữ liệu gộp`;
        onDataParsed(processed, mergedName);
        setLoading(false);
      }, 800);
    } catch (err: any) {
      if ((window as any).addDashboardLog) {
        (window as any).addDashboardLog(`❌ Lỗi xử lý dữ liệu: ${err.message}`);
      }
      setErrorMsg(`Lỗi phân tích dữ liệu: ${err.message}`);
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isLight ? 'rgba(15, 23, 42, 0.3)' : 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(6px)',
        color: isLight ? '#0F172A' : '#F8FAFC',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px',
        overflowY: 'auto',
        animation: 'overlayFade 0.25s ease forwards'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && canClose) onClose();
      }}
    >
      <div 
        className="anim-rise"
        style={{
          width: '100%',
          maxWidth: '620px',
          background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(16px)',
          borderRadius: '24px',
          border: isLight ? '1px solid rgba(148, 163, 184, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isLight
            ? '0 24px 64px rgba(15, 23, 42, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.6)'
            : '0 24px 64px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.05)',
          padding: '40px',
          zIndex: 10,
          position: 'relative',
          animation: 'telePop 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
        }}
      >
        {/* Brand Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img 
            src="https://i.ibb.co/DDQVDRbH/image.png" 
            alt="Logo" 
            style={{ 
              height: '44px', 
              marginBottom: '16px', 
              filter: isLight ? 'none' : 'brightness(1.1)' 
            }} 
          />
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0', letterSpacing: '-0.5px', color: isLight ? '#0F172A' : '#F1F5F9' }}>P&G Sales Operations</h2>
          <p style={{ margin: 0, fontSize: '14.5px', color: isLight ? '#475569' : '#94A3B8', fontWeight: '400' }}>Cổng nhập file báo cáo doanh số & Quản lý ca làm</p>
        </div>

        {/* Drag & Drop Area */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          style={{
            border: dragActive ? '2px dashed #3B82F6' : (isLight ? '1px dashed rgba(15, 23, 42, 0.2)' : '1px dashed rgba(255, 255, 255, 0.2)'),
            background: dragActive ? (isLight ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.08)') : (isLight ? 'rgba(15, 23, 42, 0.02)' : 'rgba(0, 0, 0, 0.15)'),
            borderRadius: '16px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            marginBottom: '24px'
          }}
          onMouseEnter={e => { e.currentTarget.style.border = '1px dashed rgba(59, 130, 246, 0.5)'; e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255, 255, 255, 0.02)'; }}
          onMouseLeave={e => { e.currentTarget.style.border = dragActive ? '2px dashed #3B82F6' : (isLight ? '1px dashed rgba(15, 23, 42, 0.2)' : '1px dashed rgba(255, 255, 255, 0.2)'); e.currentTarget.style.background = dragActive ? (isLight ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.08)') : (isLight ? 'rgba(15, 23, 42, 0.02)' : 'rgba(0, 0, 0, 0.15)'); }}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            style={{ display: 'none' }} 
            onChange={handleChange}
            accept=".xlsx, .xls, .xlsb, .csv"
            multiple
          />

          {!loading ? (
            <>
              {/* Upload Icon */}
              <div style={{ marginBottom: '16px', color: dragActive ? '#3B82F6' : (isLight ? '#475569' : '#64748B') }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.3s' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <p style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600', color: isLight ? '#0F172A' : '#E2E8F0' }}>Kéo thả file Excel hoặc CSV của bạn vào đây</p>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: isLight ? '#475569' : '#64748B' }}>Thêm tệp mới vào tập dữ liệu (Hỗ trợ .xlsx, .csv)</p>
              <button 
                type="button" 
                style={{
                  background: isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.06)',
                  border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: isLight ? '#0F172A' : '#E2E8F0',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={(e) => { e.stopPropagation(); triggerFileInput(); }}
                onMouseEnter={e => { e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.borderColor = isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.borderColor = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)'; }}
              >
                Chọn file từ thiết bị
              </button>
            </>
          ) : (
            <div style={{ padding: '20px 0' }}>
              {/* Spinner */}
              <div 
                style={{
                  width: '40px',
                  height: '40px',
                  border: isLight ? '3px solid rgba(59, 130, 246, 0.1)' : '3px solid rgba(59, 130, 246, 0.2)',
                  borderTop: '3px solid #3B82F6',
                  borderRadius: '50%',
                  margin: '0 auto 16px auto',
                  animation: 'spin 1s linear infinite'
                }}
              />
              <p style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '600', color: isLight ? '#0F172A' : '#F1F5F9' }}>{loadingStep}</p>
            </div>
          )}
        </div>

        {/* Uploaded Files List */}
        {uploadedList.length > 0 && (
          <div style={{ marginBottom: '24px', textAlign: 'left' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: isLight ? '#334155' : '#94A3B8', marginBottom: '12px' }}>Tệp Dữ Liệu Đã Nạp ({uploadedList.length})</h3>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {uploadedList.map((f, i) => (
                <div key={i} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', 
                  borderRadius: '10px', background: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
                  border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '500', color: isLight ? '#0F172A' : '#F1F5F9', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{f.name}</span>
                      <span style={{ fontSize: '12px', color: isLight ? '#64748B' : '#94A3B8' }}>{f.size ? (f.size / 1024 / 1024).toFixed(2) + ' MB' : 'Đã nạp'}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveFile(i)}
                    style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                    onMouseEnter={e => e.currentTarget.style.background = isLight ? '#FEE2E2' : 'rgba(239, 68, 68, 0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    title="Xóa tệp"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status / Error Notification */}
        {errorMsg && (
          <div style={{ background: isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '12px', color: isLight ? '#DC2626' : '#FCA5A5', fontSize: '13.5px', display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '24px' }}>
            <span style={{ fontSize: '16px', lineHeight: '1' }}>⚠️</span>
            <span style={{ flex: 1 }}>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ background: isLight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 16px', borderRadius: '12px', color: isLight ? '#059669' : '#A7F3D0', fontSize: '13.5px', display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '24px' }}>
            <span style={{ fontSize: '16px', lineHeight: '1' }}>✅</span>
            <span style={{ flex: 1 }}>{successMsg}</span>
          </div>
        )}

        {/* Action Panel Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
          {!canClose && (
            <div style={{ fontSize: '13.5px', color: '#EF4444', textAlign: 'center', fontWeight: '600', padding: '0 8px' }}>
              ⚠️ Vui lòng nạp file báo cáo hoặc chọn dùng dữ liệu mẫu để tiếp tục
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {uploadedList.length > 0 && (
              <button 
                type="button" 
                onClick={onClose}
                style={{
                  width: '100%',
                  background: isLight 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '14.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                }}
              >
                Hoàn tất & Tiếp tục xem Dashboard
              </button>
            )}

            {/* Skip / Use Sample Data Button */}
            <button 
              type="button" 
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setLoadingStep("Đang nạp dữ liệu mẫu tháng 05/2026...");
                if ((window as any).addDashboardLog) {
                  (window as any).addDashboardLog("⚡ Kích hoạt tải dữ liệu mẫu mặc định (Tháng 05/2026)...");
                }
                setTimeout(() => {
                  (window as any)._IMPORTED_FILES = [];
                  setUploadedList([]);
                  onDataParsed(DEFAULT_BASELINE_DATA, "Dữ liệu mẫu (May 2026)");
                  setLoading(false);
                }, 800);
              }}
              style={{
                width: '100%',
                background: uploadedList.length === 0 ? (isLight ? 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.8) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)') : 'transparent',
                border: uploadedList.length === 0 ? (isLight ? '1px solid rgba(148, 163, 184, 0.3)' : '1px solid rgba(255, 255, 255, 0.12)') : '1px solid transparent',
                color: uploadedList.length === 0 ? (isLight ? '#0F172A' : '#F1F5F9') : (isLight ? '#64748B' : '#94A3B8'),
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '14.5px',
                fontWeight: uploadedList.length === 0 ? '600' : '500',
                textDecoration: uploadedList.length === 0 ? 'none' : 'underline',
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: loading ? 0.5 : 1,
                textAlign: 'center',
                boxShadow: uploadedList.length === 0 && isLight ? '0 2px 4px rgba(15, 23, 42, 0.05)' : 'none'
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'; e.currentTarget.style.background = isLight ? 'rgba(59, 130, 246, 0.04)' : 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.color = isLight ? '#0F172A' : '#F1F5F9'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.borderColor = uploadedList.length === 0 ? (isLight ? 'rgba(148, 163, 184, 0.3)' : 'rgba(255, 255, 255, 0.12)') : 'transparent'; e.currentTarget.style.background = uploadedList.length === 0 ? (isLight ? 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.8) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)') : 'transparent'; e.currentTarget.style.color = uploadedList.length === 0 ? (isLight ? '#0F172A' : '#F1F5F9') : (isLight ? '#64748B' : '#94A3B8'); } }}
            >
              Hoặc khôi phục & dùng dữ liệu mẫu (Sample Data)
            </button>
          </div>

          {uploadedList.length === 0 && canClose && (
            <button 
              type="button" 
              disabled={loading}
              onClick={onClose}
              style={{
                background: 'transparent',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.15)' : '1px solid rgba(255, 255, 255, 0.15)',
                color: isLight ? '#475569' : '#94A3B8',
                padding: '10px 20px',
                borderRadius: '12px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = isLight ? '#0F172A' : '#F1F5F9'; e.currentTarget.style.background = isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = isLight ? '#475569' : '#94A3B8'; e.currentTarget.style.background = 'transparent'; }}
            >
              Đóng cổng dữ liệu
            </button>
          )}
        </div>
      </div>

      {/* Embedded CSS for Loading Keyframes */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};



// Explicit ESM Exports for Vite modular layout
export { 
  fmtVND, fmtVNDfull, fmtTy, Kpi, Chip, AnimatedNumber, Sparkline, ProgressBar, RegionRow, 
  TrendChart, TelegramComposer, ExportReport, ExportExcelDialog, DashboardImportPortal, 
  useTweaks, TweaksPanel, TweakSection, TweakRadio 
};
