import { useEffect, useRef, useState } from "react";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainingSeconds).padStart(
    2,
    "0"
  )}`;
}

function MobileVideoPlayer({
  src,
  setVideoRef,
  controlsVisible = true,
  onMediaTap,
}) {
  const videoRef = useRef(null);
  const isSeekingRef = useRef(false);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return undefined;

    setVideoRef?.(video);

    return () => {
      video.pause();
      setVideoRef?.(null);
    };
  }, [setVideoRef]);

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

  function stopGalleryGesture(event) {
    event.stopPropagation();
  }
  function handleVideoTap(event) {
  event.stopPropagation();
  onMediaTap?.(event);
}

  async function handleLoadedMetadata() {
  const video = videoRef.current;

  if (!video) return;

  setDuration(
    Number.isFinite(video.duration)
      ? video.duration
      : 0
  );

  setIsReady(true);

  // Chỉ tự phát trên điện thoại
  if (window.matchMedia("(max-width: 768px)").matches) {
    try {
      await video.play();
    } catch (error) {
      console.warn("Không thể tự phát:", error);
    }
  }
}

  function handleTimeUpdate() {
    const video = videoRef.current;

    if (!video || isSeekingRef.current) return;

    setCurrentTime(video.currentTime);
  }

  async function togglePlayback(event) {
    stopGalleryGesture(event);

    const video = videoRef.current;

    if (!video || !isReady) return;

    try {
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch (error) {
      console.error("Không thể phát video:", error);
    }
  }

  function handleSeekStart(event) {
    stopGalleryGesture(event);
    isSeekingRef.current = true;
  }

  function handleSeek(event) {
    stopGalleryGesture(event);

    const nextTime = Number(event.target.value);

    setCurrentTime(nextTime);

    const video = videoRef.current;

    if (video && Number.isFinite(nextTime)) {
      video.currentTime = nextTime;
    }
  }

  function handleSeekEnd(event) {
    stopGalleryGesture(event);
    handleSeek(event);
    isSeekingRef.current = false;
  }

  const progress =
    duration > 0
      ? Math.min(100, (currentTime / duration) * 100)
      : 0;

  return (
    <div
  className="evermoment-video-player"
  onClick={handleVideoTap}
>
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        className="evermoment-video-element"
      />

      <div
  className={`evermoment-video-controls ${
    controlsVisible ? "is-visible" : "is-hidden"
  }`}
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

        <span className="evermoment-video-time">
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          className="evermoment-video-slider"
          min="0"
          max={duration || 0}
          step="0.05"
          value={Math.min(currentTime, duration || 0)}
          disabled={!isReady}
          aria-label="Thời gian video"
          style={{
            "--video-progress": `${progress}%`,
          }}
          onTouchStart={handleSeekStart}
          onPointerDown={handleSeekStart}
          onInput={handleSeek}
          onChange={handleSeekEnd}
          onTouchEnd={handleSeekEnd}
          onPointerUp={handleSeekEnd}
        />

        <span className="evermoment-video-time">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

export default MobileVideoPlayer;