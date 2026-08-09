import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import MobileGalleryToolbar from "./MobileGalleryToolbar";
import ViewerSlide from "./features/viewer/ViewerSlide";
import {
  CLOSE_DISTANCE,
  CLOSE_VELOCITY,
  MAX_SCALE,
  MIN_SCALE,
  SWIPE_DISTANCE,
  SWIPE_VELOCITY,
  clamp,
  distanceBetweenTouches,
  isControlTarget,
  isVideo,
  pointBetweenTouches,
} from "./features/viewer/viewerUtils";

const HORIZONTAL_EASING = "cubic-bezier(0.22, 0.72, 0.18, 1)";
const RETURN_EASING = "cubic-bezier(0.2, 0.9, 0.2, 1)";
const CLOSE_EASING = "cubic-bezier(0.18, 0.82, 0.22, 1)";

function GalleryViewer({ media, selectedIndex, setSelectedIndex, onClose, onDelete }) {
  const [showControls, setShowControls] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const viewerRef = useRef(null);
  const stageRef = useRef(null);
  const trackRef = useRef(null);
  const dismissRef = useRef(null);
  const rafRef = useRef(0);
  const tapTimerRef = useRef(0);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const videoRefs = useRef(new Map());
  const trackAnimationRef = useRef(null);
  const dismissAnimationRef = useRef(null);
  const backdropAnimationRef = useRef(null);
  const pendingRebaseRef = useRef(false);

  const gestureRef = useRef({
    mode: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
    moved: false,
    pinchDistance: 0,
    pinchScale: 1,
    dragX: 0,
    dragY: 0,
    dismissX: 0,
    panX: 0,
    panY: 0,
    activePointerId: null,
  });

  const current = selectedIndex == null ? null : media[selectedIndex];
  const currentIsVideo = isVideo(current);

  const visibleSlides = useMemo(() => {
    if (selectedIndex == null) return [];
    return [-1, 0, 1].map((offset) => {
      const index = selectedIndex + offset;
      return { offset, index, item: media[index] || null };
    });
  }, [media, selectedIndex]);

  const stopVideos = useCallback((exceptIndex = null) => {
    videoRefs.current.forEach((video, index) => {
      if (!video || index === exceptIndex) return;
      video.pause();
    });
  }, []);

  const cancelMotionAnimations = useCallback(() => {
    trackAnimationRef.current?.cancel();
    dismissAnimationRef.current?.cancel();
    backdropAnimationRef.current?.cancel();
    trackAnimationRef.current = null;
    dismissAnimationRef.current = null;
    backdropAnimationRef.current = null;
  }, []);

  function baseTrackX() {
    return -window.innerWidth;
  }

  function resetImperativeMotion() {
    cancelMotionAnimations();
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${baseTrackX()}px,0,0)`;
    if (dismissRef.current) dismissRef.current.style.transform = "translate3d(0,0,0) rotate(0deg) scale(1)";
    if (viewerRef.current) viewerRef.current.style.backgroundColor = "rgba(0,0,0,0.96)";
    gestureRef.current.dragX = 0;
    gestureRef.current.dragY = 0;
    gestureRef.current.dismissX = 0;
    gestureRef.current.mode = null;
    setIsDismissing(false);
  }

  const resetZoom = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
    gestureRef.current.panX = 0;
    gestureRef.current.panY = 0;
  }, []);

  const closeViewer = useCallback(() => {
    stopVideos();
    cancelMotionAnimations();
    resetZoom();
    onClose();
  }, [cancelMotionAnimations, onClose, resetZoom, stopVideos]);

  const goTo = useCallback(
    (index) => {
      if (index < 0 || index >= media.length || index === selectedIndex) return;
      stopVideos();
      pendingRebaseRef.current = true;
      resetZoom();
      setSelectedIndex(index);
    },
    [media.length, resetZoom, selectedIndex, setSelectedIndex, stopVideos]
  );

  useLayoutEffect(() => {
    if (selectedIndex == null) return;
    // Rebase the 3-slide strip before the browser paints the new index.
    // This is the key step that removes the one-frame flash after a swipe.
    cancelMotionAnimations();
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${baseTrackX()}px,0,0)`;
    if (dismissRef.current) dismissRef.current.style.transform = "translate3d(0,0,0) rotate(0deg) scale(1)";
    if (viewerRef.current) viewerRef.current.style.backgroundColor = "rgba(0,0,0,0.96)";
    gestureRef.current.dragX = 0;
    gestureRef.current.dragY = 0;
    gestureRef.current.dismissX = 0;
    gestureRef.current.mode = null;
    pendingRebaseRef.current = false;
    setIsDismissing(false);
  }, [cancelMotionAnimations, selectedIndex]);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (!pendingRebaseRef.current && trackRef.current) {
        trackRef.current.style.transform = `translate3d(${baseTrackX()}px,0,0)`;
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (selectedIndex == null) return undefined;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft" && scale === 1) goTo(selectedIndex - 1);
      if (event.key === "ArrowRight" && scale === 1) goTo(selectedIndex + 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeViewer, goTo, scale, selectedIndex]);

  useEffect(() => {
    if (selectedIndex == null) return undefined;
    stopVideos(selectedIndex);

    const preload = [selectedIndex - 1, selectedIndex + 1]
      .map((index) => media[index])
      .filter((item) => item && !isVideo(item) && item.url)
      .map((item) => {
        const image = new Image();
        image.decoding = "async";
        image.src = item.url;
        image.decode?.().catch(() => {});
        return image;
      });

    return () => preload.forEach((image) => { image.src = ""; });
  }, [media, selectedIndex, stopVideos]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    window.clearTimeout(tapTimerRef.current);
    cancelMotionAnimations();
  }, [cancelMotionAnimations]);

  function paintGestureNow() {
    const gesture = gestureRef.current;
    if (gesture.mode === "horizontal" && trackRef.current) {
      trackRef.current.style.transform = `translate3d(${baseTrackX() + gesture.dragX}px,0,0)`;
    }

    if (gesture.mode === "vertical") {
      const progress = clamp(Math.max(0, gesture.dragY) / Math.max(320, window.innerHeight * 0.58), 0, 1);
      const visualScale = 1 - progress * 0.16;
      const rotation = clamp((gesture.dismissX / Math.max(1, window.innerWidth)) * 4.2, -2.8, 2.8);
      if (dismissRef.current) {
        dismissRef.current.style.transform = `translate3d(${gesture.dismissX}px,${gesture.dragY}px,0) rotate(${rotation}deg) scale(${visualScale})`;
      }
      if (viewerRef.current) {
        const opacity = 0.96 * (1 - progress * 0.9);
        viewerRef.current.style.backgroundColor = `rgba(0,0,0,${opacity})`;
      }
    }
  }

  function updateDragVisuals(next) {
    const gesture = gestureRef.current;
    if (Object.hasOwn(next, "dragX")) gesture.dragX = next.dragX;
    if (Object.hasOwn(next, "dragY")) gesture.dragY = next.dragY;
    if (Object.hasOwn(next, "dismissX")) gesture.dismissX = next.dismissX;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(paintGestureNow);
  }

  function flushGestureFrame() {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    paintGestureNow();
  }

  function beginSinglePointer(x, y) {
    cancelMotionAnimations();
    gestureRef.current = {
      ...gestureRef.current,
      mode: null,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      startTime: performance.now(),
      moved: false,
      dragX: 0,
      dragY: 0,
      dismissX: 0,
    };
  }

  function handleTouchStart(event) {
    if (isControlTarget(event.target)) return;

    if (event.touches.length === 2 && !currentIsVideo) {
      gestureRef.current.mode = "pinch";
      gestureRef.current.pinchDistance = distanceBetweenTouches(event.touches);
      gestureRef.current.pinchScale = scale;
      gestureRef.current.pinchCenter = pointBetweenTouches(event.touches);
      return;
    }

    if (event.touches.length === 1) {
      beginSinglePointer(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  function handleTouchMove(event) {
    if (event.touches.length === 2 && gestureRef.current.mode === "pinch" && !currentIsVideo) {
      event.preventDefault();
      const ratio = distanceBetweenTouches(event.touches) / Math.max(1, gestureRef.current.pinchDistance);
      setScale(clamp(gestureRef.current.pinchScale * ratio, MIN_SCALE, MAX_SCALE));
      return;
    }

    if (event.touches.length !== 1) return;
    movePointer(event.touches[0].clientX, event.touches[0].clientY, event);
  }

  function movePointer(x, y, event) {
    const gesture = gestureRef.current;
    const totalX = x - gesture.startX;
    const totalY = y - gesture.startY;
    const stepX = x - gesture.lastX;
    const stepY = y - gesture.lastY;
    gesture.lastX = x;
    gesture.lastY = y;

    if (scale > 1 && !currentIsVideo) {
      event?.preventDefault?.();
      gesture.mode = "pan";
      gesture.moved = true;
      const maxX = (window.innerWidth * (scale - 1)) / 2;
      const maxY = (window.innerHeight * (scale - 1)) / 2;
      const nextX = clamp(gesture.panX + stepX, -maxX, maxX);
      const nextY = clamp(gesture.panY + stepY, -maxY, maxY);
      gesture.panX = nextX;
      gesture.panY = nextY;
      setPanX(nextX);
      setPanY(nextY);
      return;
    }

    if (!gesture.mode) {
      // A slightly larger direction lock prevents diagonal jitter.
      if (Math.abs(totalX) > Math.abs(totalY) + 9) gesture.mode = "horizontal";
      else if (Math.abs(totalY) > Math.abs(totalX) + 9) {
        // Do not set React state here. Re-rendering the whole viewer at the exact
        // moment a vertical gesture locks can create the one-frame "flash" users see.
        gesture.mode = "vertical";
      }
    }

    if (!gesture.mode) return;
    gesture.moved = true;
    event?.preventDefault?.();

    if (gesture.mode === "horizontal") {
      let nextX = totalX;
      if ((selectedIndex === 0 && nextX > 0) || (selectedIndex === media.length - 1 && nextX < 0)) {
        // iOS-like rubber band at the ends.
        nextX = Math.sign(nextX) * Math.pow(Math.abs(nextX), 0.82) * 0.72;
      }
      updateDragVisuals({ dragX: nextX, dragY: 0, dismissX: 0 });
    } else if (gesture.mode === "vertical") {
      // Down follows the finger almost 1:1; upward movement is resisted.
      const nextY = totalY < 0 ? totalY * 0.16 : totalY;
      const nextX = totalX * 0.42;
      updateDragVisuals({ dragY: nextY, dismissX: nextX, dragX: 0 });
    }
  }

  async function animateTrackTo(targetX, duration) {
    const track = trackRef.current;
    if (!track) return;
    trackAnimationRef.current?.cancel();
    const fromX = baseTrackX() + gestureRef.current.dragX;
    const animation = track.animate(
      [
        { transform: `translate3d(${fromX}px,0,0)` },
        { transform: `translate3d(${targetX}px,0,0)` },
      ],
      { duration, easing: HORIZONTAL_EASING, fill: "forwards" }
    );
    trackAnimationRef.current = animation;
    try { await animation.finished; } catch { /* cancelled */ }
  }

  async function returnDismissToCenter() {
    const layer = dismissRef.current;
    const viewer = viewerRef.current;
    if (!layer || !viewer) return;
    const gesture = gestureRef.current;
    dismissAnimationRef.current?.cancel();
    backdropAnimationRef.current?.cancel();

    const progress = clamp(Math.max(0, gesture.dragY) / Math.max(320, window.innerHeight * 0.58), 0, 1);
    const currentScale = 1 - progress * 0.16;
    const currentRotation = clamp((gesture.dismissX / Math.max(1, window.innerWidth)) * 4.2, -2.8, 2.8);
    const currentOpacity = 0.96 * (1 - progress * 0.9);

    const layerAnimation = layer.animate(
      [
        { transform: `translate3d(${gesture.dismissX}px,${gesture.dragY}px,0) rotate(${currentRotation}deg) scale(${currentScale})` },
        { transform: "translate3d(0,0,0) rotate(0deg) scale(1)" },
      ],
      { duration: 310, easing: RETURN_EASING, fill: "forwards" }
    );
    const backdropAnimation = viewer.animate(
      [{ backgroundColor: `rgba(0,0,0,${currentOpacity})` }, { backgroundColor: "rgba(0,0,0,0.96)" }],
      { duration: 280, easing: RETURN_EASING, fill: "forwards" }
    );
    dismissAnimationRef.current = layerAnimation;
    backdropAnimationRef.current = backdropAnimation;
    try { await Promise.all([layerAnimation.finished, backdropAnimation.finished]); } catch { /* cancelled */ }
    // Write the resting frame before cancelling fill-forwards animations, so the
    // browser never paints the pre-animation transform for a frame.
    layer.style.transform = "translate3d(0,0,0) rotate(0deg) scale(1)";
    viewer.style.backgroundColor = "rgba(0,0,0,0.96)";
    layerAnimation.cancel();
    backdropAnimation.cancel();
    gesture.dragY = 0;
    gesture.dismissX = 0;
    setIsDismissing(false);
  }

  async function animateDismissAndClose() {
    const layer = dismissRef.current;
    const viewer = viewerRef.current;
    if (!layer || !viewer) {
      closeViewer();
      return;
    }
    const gesture = gestureRef.current;

    // A final touchmove can still be queued in rAF when touchend fires. Paint that
    // exact last finger position synchronously before starting the release animation.
    flushGestureFrame();

    const startY = gesture.dragY;
    const startX = gesture.dismissX;
    const progress = clamp(Math.max(0, startY) / Math.max(320, window.innerHeight * 0.58), 0, 1);
    const currentScale = 1 - progress * 0.16;
    const currentRotation = clamp((startX / Math.max(1, window.innerWidth)) * 4.2, -2.8, 2.8);
    const targetX = startX * 1.15;
    const targetY = Math.max(window.innerHeight * 0.88, startY + 260);
    const startTransform = `translate3d(${startX}px,${startY}px,0) rotate(${currentRotation}deg) scale(${currentScale})`;
    const startBackground = getComputedStyle(viewer).backgroundColor;

    // Freeze the exact release frame inline. No React state change is allowed between
    // finger-up and the close animation.
    layer.style.transform = startTransform;
    viewer.style.backgroundColor = startBackground;

    stopVideos();
    const layerAnimation = layer.animate(
      [
        { transform: startTransform },
        { transform: `translate3d(${targetX}px,${targetY}px,0) rotate(${currentRotation * 1.1}deg) scale(0.82)` },
      ],
      { duration: 260, easing: CLOSE_EASING, fill: "forwards" }
    );
    const backdropAnimation = viewer.animate(
      [{ backgroundColor: startBackground }, { backgroundColor: "rgba(0,0,0,0)" }],
      { duration: 250, easing: "linear", fill: "forwards" }
    );
    dismissAnimationRef.current = layerAnimation;
    backdropAnimationRef.current = backdropAnimation;
    try { await Promise.all([layerAnimation.finished, backdropAnimation.finished]); } catch { /* cancelled */ }

    // Do NOT call closeViewer() here: it cancels the fill-forwards animation before
    // React unmounts, which can reveal the centered image for one frame. Keep the
    // final visual frame in place and let the parent unmount the viewer directly.
    layer.style.transform = `translate3d(${targetX}px,${targetY}px,0) rotate(${currentRotation * 1.1}deg) scale(0.82)`;
    viewer.style.backgroundColor = "rgba(0,0,0,0)";
    stopVideos();
    onClose();
  }

  async function finishGesture() {
    const gesture = gestureRef.current;
    const elapsed = Math.max(1, performance.now() - gesture.startTime);
    const latestDragX = gesture.dragX;
    const latestDragY = gesture.dragY;
    const vx = latestDragX / elapsed;
    const vy = latestDragY / elapsed;

    if (gesture.mode === "pinch") {
      if (scale <= 1.03) resetZoom();
      gesture.mode = null;
      return;
    }

    if (gesture.mode === "horizontal" && scale === 1) {
      const next = latestDragX < -SWIPE_DISTANCE || vx < -SWIPE_VELOCITY;
      const previous = latestDragX > SWIPE_DISTANCE || vx > SWIPE_VELOCITY;
      const width = window.innerWidth;

      if (next && selectedIndex < media.length - 1) {
        // Duration follows remaining distance, so a fast flick feels light instead of delayed.
        const remaining = Math.max(0, width - Math.abs(latestDragX));
        const duration = clamp(160 + (remaining / width) * 90 - Math.abs(vx) * 55, 150, 245);
        await animateTrackTo(-2 * width, duration);
        if (trackAnimationRef.current?.playState === "finished") {
          pendingRebaseRef.current = true;
          stopVideos();
          resetZoom();
          setSelectedIndex(selectedIndex + 1);
        }
        return;
      }

      if (previous && selectedIndex > 0) {
        const remaining = Math.max(0, width - Math.abs(latestDragX));
        const duration = clamp(160 + (remaining / width) * 90 - Math.abs(vx) * 55, 150, 245);
        await animateTrackTo(0, duration);
        if (trackAnimationRef.current?.playState === "finished") {
          pendingRebaseRef.current = true;
          stopVideos();
          resetZoom();
          setSelectedIndex(selectedIndex - 1);
        }
        return;
      }

      await animateTrackTo(-width, clamp(190 - Math.abs(vx) * 40, 150, 210));
      trackAnimationRef.current?.cancel();
      if (trackRef.current) trackRef.current.style.transform = `translate3d(${-width}px,0,0)`;
      gesture.dragX = 0;
      gesture.mode = null;
      return;
    }

    if (gesture.mode === "vertical" && scale === 1) {
      if (latestDragY > CLOSE_DISTANCE || vy > CLOSE_VELOCITY) {
        await animateDismissAndClose();
        return;
      }
      await returnDismissToCenter();
      gesture.mode = null;
      return;
    }

    gesture.mode = null;
    setIsDismissing(false);
  }

  function handleTouchEnd(event) {
    if (event.touches.length > 0) return;
    finishGesture();
  }

  function handlePointerDown(event) {
    if (event.pointerType === "touch" || isControlTarget(event.target)) return;
    if (event.button !== 0) return;
    beginSinglePointer(event.clientX, event.clientY);
    gestureRef.current.activePointerId = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (event.pointerType === "touch") return;
    const gesture = gestureRef.current;
    if (gesture.activePointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) {
      gesture.activePointerId = null;
      gesture.startTime = 0;
      gesture.mode = null;
      return;
    }
    movePointer(event.clientX, event.clientY, event);
  }

  function handlePointerUp(event) {
    if (event.pointerType === "touch") return;
    const gesture = gestureRef.current;
    if (gesture.activePointerId !== event.pointerId) return;
    gesture.activePointerId = null;
    finishGesture().finally(() => {
      gesture.startTime = 0;
    });
  }

  function toggleZoom(clientX, clientY) {
    if (currentIsVideo) return;
    if (scale > 1) {
      resetZoom();
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    setScale(2.2);
    const nextPanX = clamp((centerX - clientX) * 0.55, -window.innerWidth * 0.45, window.innerWidth * 0.45);
    const nextPanY = clamp((centerY - clientY) * 0.55, -window.innerHeight * 0.4, window.innerHeight * 0.4);
    gestureRef.current.panX = nextPanX;
    gestureRef.current.panY = nextPanY;
    setPanX(nextPanX);
    setPanY(nextPanY);
  }

  function handleTap(event) {
    if (gestureRef.current.moved || isControlTarget(event.target)) {
      gestureRef.current.moved = false;
      return;
    }
    const now = performance.now();
    const previous = lastTapRef.current;
    window.clearTimeout(tapTimerRef.current);

    if (now - previous.time < 290 && !currentIsVideo) {
      toggleZoom(event.clientX, event.clientY);
      lastTapRef.current = { time: 0, x: 0, y: 0 };
      return;
    }

    lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };
    tapTimerRef.current = window.setTimeout(() => setShowControls((value) => !value), 150);
  }

  async function saveCurrentMedia() {
    if (!current || isSaving) return;
    setIsSaving(true);
    try {
      const response = await fetch(current.url);
      if (!response.ok) throw new Error("Không tải được tệp");
      const blob = await response.blob();
      const file = new File([blob], current.name || `evermoment-${Date.now()}`, {
        type: blob.type || current.type || "application/octet-stream",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: current.name || "EverMoment" });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        window.alert("Không thể chuẩn bị tệp để lưu/chia sẻ. EverMoment sẽ không mở đường dẫn Supabase.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCurrentMedia() {
    if (!current || !onDelete) return;
    if (!window.confirm(`Xóa "${current.name}" khỏi kho ký ức?`)) return;
    await onDelete(current);
    if (media.length <= 1) closeViewer();
    else if (selectedIndex === media.length - 1) setSelectedIndex(selectedIndex - 1);
  }

  if (selectedIndex == null || !current || media.length === 0) return null;

  const imageTransform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
  const imageTransition = scale === 1 ? "transform 260ms cubic-bezier(0.2,0.9,0.2,1)" : "none";

  return (
    <div ref={viewerRef} className="ev-viewer" style={{ backgroundColor: "rgba(0,0,0,0.96)" }}>
      <div
        ref={stageRef}
        className="ev-viewer-stage"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div ref={dismissRef} className="ev-viewer-dismiss-layer">
          <div
            ref={trackRef}
            className="ev-viewer-track"
            style={{ transform: `translate3d(${-window.innerWidth}px,0,0)` }}
          >
            {visibleSlides.map(({ offset, index, item }) => (
              <ViewerSlide
                key={`viewer-slot-${offset}`}
                item={item}
                active={offset === 0}
                controlsVisible={showControls && !isDismissing}
                onTap={handleTap}
                imageTransform={imageTransform}
                imageTransition={imageTransition}
                setVideoRef={(video) => {
                  if (video) videoRefs.current.set(index, video);
                  else videoRefs.current.delete(index);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {isMobile ? (
        <MobileGalleryToolbar
          selectedItem={current}
          onClose={closeViewer}
          onDelete={onDelete ? deleteCurrentMedia : null}
          visible={showControls && !isDismissing}
        />
      ) : (
        <>
          <button
            type="button"
            className="gallery-desktop-close"
            data-viewer-control="true"
            aria-label="Đóng ảnh hoặc video"
            onClick={closeViewer}
          >
            ✕
          </button>
          <div className="gallery-toolbar gallery-toolbar-top" style={{ opacity: showControls ? 1 : 0 }}>
            <div className="gallery-counter">{selectedIndex + 1} / {media.length}</div>
            <button type="button" className="gallery-icon-button" onClick={saveCurrentMedia} disabled={isSaving}>{isSaving ? "…" : "⇩"}</button>
          </div>
          {selectedIndex > 0 && scale === 1 && (
            <button type="button" className="gallery-desktop-arrow gallery-arrow-left" onClick={() => goTo(selectedIndex - 1)}>‹</button>
          )}
          {selectedIndex < media.length - 1 && scale === 1 && (
            <button type="button" className="gallery-desktop-arrow gallery-arrow-right" onClick={() => goTo(selectedIndex + 1)}>›</button>
          )}
          <div className="gallery-toolbar gallery-toolbar-bottom" style={{ opacity: showControls ? 1 : 0 }}>
            <button type="button" className="gallery-action-button" onClick={saveCurrentMedia} disabled={isSaving}>{isSaving ? "Đang xử lý…" : "Lưu / Tải xuống"}</button>
            {onDelete && <button type="button" className="gallery-action-button gallery-delete-button" onClick={deleteCurrentMedia}>Xóa</button>}
          </div>
        </>
      )}
    </div>
  );
}

export default GalleryViewer;
