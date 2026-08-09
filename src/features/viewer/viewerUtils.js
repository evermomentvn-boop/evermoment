export const MAX_SCALE = 4;
export const MIN_SCALE = 1;
export const SWIPE_DISTANCE = 72;
export const SWIPE_VELOCITY = 0.42;
export const CLOSE_DISTANCE = 128;
export const CLOSE_VELOCITY = 0.5;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function isVideo(item) {
  return Boolean(item?.type?.startsWith("video/"));
}

export function isControlTarget(target) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        [
          "button",
          "input",
          ".mobile-gallery-toolbar",
          ".mobile-sheet-overlay",
          ".mobile-gallery-sheet",
          ".gallery-toolbar",
          ".gallery-desktop-arrow",
          ".evermoment-video-controls",
          "[data-viewer-control=\"true\"]",
        ].join(",")
      )
    )
  );
}

export function distanceBetweenTouches(touches) {
  if (!touches || touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export function pointBetweenTouches(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}
