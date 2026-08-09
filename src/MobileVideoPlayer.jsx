import { useEffect, useRef, useState } from "react";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function MobileVideoPlayer({
  src,
  poster,
  active = true,
  setVideoRef,
  controlsVisible = true,
  onMediaTap,
}) {
  const videoRef = useRef(null);
  const setVideoRefCallbackRef = useRef(setVideoRef);
  const isSeekingRef = useRef(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Keep the latest parent callback without treating every parent re-render as
  // a video unmount. Previously, toggling viewer controls changed the inline
  // setVideoRef callback identity, ran this effect cleanup, and paused video.
  useEffect(() => {
    setVideoRefCallbackRef.current = setVideoRef;
  }, [setVideoRef]);

  useEffect(() => {
    const video = videoRef.current;
    setVideoRefCallbackRef.current?.(video);
    return () => {
      video?.pause();
      setVideoRefCallbackRef.current?.(null);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsReady(false);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || active) return;
    video.pause();
  }, [active]);

  function blockViewerGesture(event) {
    event.stopPropagation();
  }

  async function toggleVideo() {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused) await video.play();
      else video.pause();
    } catch (error) {
      console.error("Không thể phát/tạm dừng video:", error);
    }
  }

  function handleVideoTap(event) {
    // The transparent tap layer owns simple taps so mobile browsers never get a
    // direct click on <video> (some browsers toggle native playback on that click).
    // Swipes still bubble as touch events to the viewer gesture engine.
    event.stopPropagation();
    if (!isSeekingRef.current) onMediaTap?.(event);
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setIsReady(true);
  }

  function handleCanPlay() {
    setIsReady(true);
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || isSeekingRef.current) return;
    setCurrentTime(video.currentTime);
  }

  async function togglePlayback(event) {
    blockViewerGesture(event);
    await toggleVideo();
  }

  function seekToValue(value) {
    const nextTime = Number(value);
    if (!Number.isFinite(nextTime)) return;
    setCurrentTime(nextTime);
    if (videoRef.current) videoRef.current.currentTime = nextTime;
  }

  function handleSeekStart(event) {
    blockViewerGesture(event);
    isSeekingRef.current = true;
  }

  function handleSeekInput(event) {
    blockViewerGesture(event);
    seekToValue(event.currentTarget.value);
  }

  function handleSeekEnd(event) {
    blockViewerGesture(event);
    seekToValue(event.currentTarget.value);
    isSeekingRef.current = false;
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="evermoment-video-player">
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        playsInline
        preload={active ? "metadata" : "none"}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        className="evermoment-video-element"
      />

      <div
        className="evermoment-video-tap-layer"
        aria-hidden="true"
        onClick={handleVideoTap}
      />

      <div
        className={`evermoment-video-controls ${controlsVisible ? "is-visible" : "is-hidden"}`}
        data-viewer-control="true"
        onClick={blockViewerGesture}
        onTouchStart={blockViewerGesture}
        onTouchMove={blockViewerGesture}
        onTouchEnd={blockViewerGesture}
        onPointerDown={blockViewerGesture}
        onPointerMove={blockViewerGesture}
        onPointerUp={blockViewerGesture}
        onPointerCancel={blockViewerGesture}
      >
        <button
          type="button"
          className="evermoment-video-play"
          onClick={togglePlayback}
          disabled={!isReady}
          aria-label={isPlaying ? "Tạm dừng" : "Phát"}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <span className="evermoment-video-time">{formatTime(currentTime)}</span>

        <input
          type="range"
          className="evermoment-video-slider"
          data-viewer-control="true"
          min="0"
          max={duration || 0}
          step="0.05"
          value={Math.min(currentTime, duration || 0)}
          disabled={!isReady}
          aria-label="Thời gian video"
          style={{ "--video-progress": `${progress}%` }}
          onClick={blockViewerGesture}
          onTouchStart={handleSeekStart}
          onTouchMove={handleSeekInput}
          onTouchEnd={handleSeekEnd}
          onTouchCancel={handleSeekEnd}
          onPointerDown={handleSeekStart}
          onPointerMove={blockViewerGesture}
          onPointerUp={handleSeekEnd}
          onPointerCancel={handleSeekEnd}
          onInput={handleSeekInput}
          onChange={handleSeekEnd}
        />

        <span className="evermoment-video-time">{formatTime(duration)}</span>
      </div>
    </div>
  );
}

export default MobileVideoPlayer;
