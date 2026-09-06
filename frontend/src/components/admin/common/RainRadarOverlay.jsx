import React, { useEffect, useState, useRef, useCallback } from 'react';
import { TileLayer } from 'react-leaflet';

/**
 * RainRadarOverlay — REAL precipitation coverage drawn from RainViewer radar
 * tiles (free, no API key). Shows the latest observed frame and, when a
 * nowcast is available, animates the next ~30 minutes of movement.
 *
 * The radar is real coverage data. If a frame is unavailable or the network
 * is down we render nothing and surface an honest state via `onState`.
 */
const MANIFEST_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const REFRESH_MS = 5 * 60 * 1000;   // frames update every 10 min anyway
const FRAME_STEP_MS = 1800;          // animation pace between nowcast frames

export const RainRadarOverlay = ({ onState, opacity = 0.5 }) => {
  const [frames, setFrames] = useState(null);   // { host, past:[..], nowcast:[..] }
  const [activeIdx, setActiveIdx] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0); // past + nowcast combined
  const [state, setState] = useState('loading');     // loading | live | unavailable
  const timerRef = useRef(null);

  const report = useCallback((s, meta) => {
    setState(s);
    if (onState) onState(s, meta);
  }, [onState]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('manifest ' + res.status);
        const m = await res.json();
        if (cancelled) return;
        const host = m?.host;
        const past = m?.radar?.past || [];
        const nowcast = m?.radar?.nowcast || [];
        if (!host || past.length === 0) {
          report('unavailable', { reason: 'no radar frames' });
          return;
        }
        const combined = [
          ...past.map(f => ({ ...f, kind: 'past' })),
          ...nowcast.map(f => ({ ...f, kind: 'nowcast' })),
        ];
        // Start on the newest observed frame (end of `past`)
        const start = past.length - 1;
        setFrames({ host, list: combined });
        setActiveIdx(start);
        setTotalFrames(combined.length);
        report('live', {
          frameTime: combined[start]?.time,
          frameKind: 'past',
          total: combined.length,
          nowcastCount: nowcast.length,
        });
      } catch (e) {
        if (!cancelled) report('unavailable', { reason: String(e?.message || e) });
      }
    };
    load();
    const iv = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate forward through nowcast frames (rain movement preview), then hold.
  // The timer increments the index; React re-renders on every index change,
  // but the TileLayer key includes frame identity so a single frame that is
  // reprojected on a zoom change does not force Leaflet to rebuild tiles.
  useEffect(() => {
    if (!frames || frames.list.length < 2) return undefined;
    timerRef.current = setInterval(() => {
      setActiveIdx(prev => {
        const next = prev + 1;
        if (!frames || next >= frames.list.length) return prev;
        return next;
      });
    }, FRAME_STEP_MS);
    return () => clearInterval(timerRef.current);
  }, [frames]);

  // Re-render only when the active frame identity changes. This prevents
  // TileLayer key churn on every index increment when the frame list has
  // been replaced, which would otherwise force Leaflet to rebuild tiles.
  const currentFrame = frames && activeIdx >= 0 && activeIdx < frames.list.length ? frames.list[activeIdx] : null;
  if (!currentFrame) return null;

  const frame = currentFrame;
  const url = `${frames.host}${frame.path}/256/{z}/{x}/{y}/1/0_0.png`;
  // Derive a stable display key from the frame identity so the animated radar
  // does not force Leaflet to discard and reload tiles across each nowcast step.
  const frameKey = `${frame.path}::${frame.kind}::${frame.time}`;

  return (
    <TileLayer
      key={frameKey}
      url={url}
      opacity={opacity}
      zIndex={300}
      maxNativeZoom={10}
      minZoom={3}
    />
  );
};

export const radarStateLabel = (state, meta) => {
  if (state === 'live' && meta?.frameTime) {
    const t = new Date(meta.frameTime * 1000);
    const kind = meta.frameKind === 'nowcast' ? 'forecast' : 'observed';
    const total = meta.total || 0;
    return `Rain radar: LIVE · ${kind} ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${total > 1 ? ` · ${total} frames` : ''}`;
  }
  if (state === 'live') return 'Rain radar: LIVE';
  if (state === 'unavailable') return 'Rain radar: UNAVAILABLE';
  return 'Rain radar: connecting…';
};

export default RainRadarOverlay;
