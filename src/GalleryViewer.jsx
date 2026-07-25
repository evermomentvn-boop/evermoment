import { useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD = 70;
const CLOSE_THRESHOLD = 120;
const MAX_SCALE = 4;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getTouchDistance(touches) {
  const x = touches[0].clientX - touches[1].clientX;
  const y = touches[0].clientY - touches[1].clientY;

  return Math.hypot(x, y);
}

function isVideoFile(file) {
  return file?.type?.startsWith("video/");
}

function GalleryViewer({
  media,
  selectedIndex,
  setSelectedIndex,
  onClose,
  onDelete,
}) {
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [scale, setScale] = useState(1);
  const [imageX, setImageX] = useState(0);
  const [imageY, setImageY] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    direction: null,
    pinching: false,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    startedOnVideoControls: false,
  });

  const lastTapRef = useRef(0);
  const videoRefs = useRef([]);

  const currentMedia =
    selectedIndex !== null ? media[selectedIndex] : null;

  const currentIsVideo = isVideoFile(currentMedia);

  function resetTransform() {
    setScale(1);
    setImageX(0);
    setImageY(0);
    setDragX(0);
    setDragY(0);
    setIsDragging(false);

    gestureRef.current.direction = null;
    gestureRef.current.pinching = false;
  }

  function stopAllVideos() {
    videoRefs.current.forEach((video) => {
      if (!video) return;

      video.pause();
    });
  }

  function goToIndex(nextIndex) {
    if (nextIndex < 0 || nextIndex >= media.length) return;

    stopAllVideos();
    resetTransform();
    setSelectedIndex(nextIndex);
  }

  function goPrevious() {
    if (selectedIndex > 0) {
      goToIndex(selectedIndex - 1);
    }
  }

  function goNext() {
    if (selectedIndex < media.length - 1) {
      goToIndex(selectedIndex + 1);
    }
  }

  function closeViewer() {
    stopAllVideos();
    resetTransform();
    onClose();
  }

  useEffect(() => {
    if (selectedIndex === null) return undefined;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeViewer();
      }

      if (event.key === "ArrowLeft" && scale === 1) {
        goPrevious();
      }

      if (event.key === "ArrowRight" && scale === 1) {
        goNext();
      }

      if (event.key === "+" || event.key === "=") {
        setScale((currentScale) =>
          clamp(currentScale + 0.5, 1, MAX_SCALE)
        );
      }

      if (event.key === "-") {
        setScale((currentScale) => {
          const nextScale = clamp(currentScale - 0.5, 1, MAX_SCALE);

          if (nextScale === 1) {
            setImageX(0);
            setImageY(0);
          }

          return nextScale;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIndex, scale, media.length]);

  useEffect(() => {
    stopAllVideos();
    resetTransform();
  }, [selectedIndex]);

  async function saveCurrentMedia() {
    if (!currentMedia || isSaving) return;

    setIsSaving(true);

    try {
      const response = await fetch(currentMedia.url);

      if (!response.ok) {
        throw new Error("Không tải được tệp.");
      }

      const blob = await response.blob();

      const file = new File(
        [blob],
        currentMedia.name || `evermoment-${Date.now()}`,
        {
          type:
            blob.type ||
            currentMedia.type ||
            "application/octet-stream",
        }
      );

      // iPhone/iPad/Android: ưu tiên bảng chia sẻ hệ thống.
      if (
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: currentMedia.name || "EverMoment",
        });

        return;
      }

      // Máy tính và trình duyệt không hỗ trợ chia sẻ tệp.
      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");

      downloadLink.href = objectUrl;
      downloadLink.download =
        currentMedia.name || `evermoment-${Date.now()}`;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (error) {
      // Một số trình duyệt iPhone không cho tải blob từ URL ngoài.
      // Khi đó mở tệp để người dùng giữ ảnh hoặc dùng nút Chia sẻ.
      if (error?.name !== "AbortError") {
        window.open(currentMedia.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCurrentMedia() {
    if (!currentMedia || !onDelete) return;

    const confirmed = window.confirm(
      `Xóa "${currentMedia.name}" khỏi kho ký ức?`
    );

    if (!confirmed) return;

    stopAllVideos();

    try {
      await onDelete(currentMedia);

      if (media.length <= 1) {
        closeViewer();
        return;
      }

      if (selectedIndex === media.length - 1) {
        setSelectedIndex(selectedIndex - 1);
      }

      resetTransform();
    } catch (error) {
      console.error("Không thể xóa tệp:", error);
      window.alert("Không thể xóa tệp. Vui lòng thử lại.");
    }
  }

  function handleTouchStart(event) {
    const target = event.target;

    gestureRef.current.startedOnVideoControls =
      target instanceof HTMLElement &&
      Boolean(target.closest("video"));

    if (event.touches.length === 2 && !currentIsVideo) {
      gestureRef.current.pinching = true;
      gestureRef.current.pinchStartDistance = getTouchDistance(
        event.touches
      );
      gestureRef.current.pinchStartScale = scale;

      setIsDragging(false);
      return;
    }

    if (event.touches.length !== 1) return;

    const touch = event.touches[0];

    gestureRef.current.startX = touch.clientX;
    gestureRef.current.startY = touch.clientY;
    gestureRef.current.lastX = touch.clientX;
    gestureRef.current.lastY = touch.clientY;
    gestureRef.current.direction = null;
    gestureRef.current.pinching = false;

    setIsDragging(true);
  }

  function handleTouchMove(event) {
    if (
      gestureRef.current.pinching &&
      event.touches.length === 2 &&
      !currentIsVideo
    ) {
      event.preventDefault();

      const currentDistance = getTouchDistance(event.touches);
      const ratio =
        currentDistance /
        gestureRef.current.pinchStartDistance;

      const nextScale = clamp(
        gestureRef.current.pinchStartScale * ratio,
        1,
        MAX_SCALE
      );

      setScale(nextScale);

      if (nextScale === 1) {
        setImageX(0);
        setImageY(0);
      }

      return;
    }

    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaFromStartX =
      touch.clientX - gestureRef.current.startX;
    const deltaFromStartY =
      touch.clientY - gestureRef.current.startY;

    const moveX = touch.clientX - gestureRef.current.lastX;
    const moveY = touch.clientY - gestureRef.current.lastY;

    gestureRef.current.lastX = touch.clientX;
    gestureRef.current.lastY = touch.clientY;

    // Khi ảnh đã phóng to, thao tác một ngón dùng để kéo ảnh.
    if (scale > 1 && !currentIsVideo) {
      event.preventDefault();

      const maxMoveX = (window.innerWidth * (scale - 1)) / 2;
      const maxMoveY = (window.innerHeight * (scale - 1)) / 2;

      setImageX((currentX) =>
        clamp(currentX + moveX, -maxMoveX, maxMoveX)
      );

      setImageY((currentY) =>
        clamp(currentY + moveY, -maxMoveY, maxMoveY)
      );

      return;
    }

    if (!gestureRef.current.direction) {
      if (
        Math.abs(deltaFromStartX) >
        Math.abs(deltaFromStartY) + 8
      ) {
        gestureRef.current.direction = "horizontal";
      } else if (
        Math.abs(deltaFromStartY) >
        Math.abs(deltaFromStartX) + 8
      ) {
        gestureRef.current.direction = "vertical";
      }
    }

    if (gestureRef.current.direction === "horizontal") {
      event.preventDefault();

      let nextDragX = deltaFromStartX;

      if (
        (selectedIndex === 0 && nextDragX > 0) ||
        (selectedIndex === media.length - 1 &&
          nextDragX < 0)
      ) {
        nextDragX *= 0.25;
      }

      setDragX(nextDragX);
      setDragY(0);
    }

    if (
      gestureRef.current.direction === "vertical" &&
      deltaFromStartY > 0
    ) {
      event.preventDefault();

      setDragY(deltaFromStartY);
      setDragX(0);
    }
  }

  function finishGesture() {
    if (gestureRef.current.pinching) {
      gestureRef.current.pinching = false;
      setIsDragging(false);
      return;
    }

    if (scale > 1) {
      setIsDragging(false);
      return;
    }

    if (
      gestureRef.current.direction === "horizontal"
    ) {
      if (
        dragX < -SWIPE_THRESHOLD &&
        selectedIndex < media.length - 1
      ) {
        goNext();
      } else if (
        dragX > SWIPE_THRESHOLD &&
        selectedIndex > 0
      ) {
        goPrevious();
      } else {
        setDragX(0);
      }
    }

    if (gestureRef.current.direction === "vertical") {
      if (dragY > CLOSE_THRESHOLD) {
        closeViewer();
        return;
      }

      setDragY(0);
    }

    setIsDragging(false);
    gestureRef.current.direction = null;
  }

  function handleTouchEnd(event) {
    // Vẫn còn ngón tay trong lúc pinch.
    if (event.touches.length > 0) return;

    finishGesture();
  }

  function handlePointerDown(event) {
    if (event.pointerType === "touch") return;

    // Không biến thao tác điều khiển video thành thao tác kéo.
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("video")
    ) {
      return;
    }

    gestureRef.current.startX = event.clientX;
    gestureRef.current.startY = event.clientY;
    gestureRef.current.lastX = event.clientX;
    gestureRef.current.lastY = event.clientY;
    gestureRef.current.direction = null;

    setIsDragging(true);

    event.currentTarget.setPointerCapture?.(
      event.pointerId
    );
  }

  function handlePointerMove(event) {
    if (
      event.pointerType === "touch" ||
      !isDragging
    ) {
      return;
    }

    const deltaX =
      event.clientX - gestureRef.current.startX;
    const deltaY =
      event.clientY - gestureRef.current.startY;

    if (scale > 1 && !currentIsVideo) {
      const moveX =
        event.clientX - gestureRef.current.lastX;
      const moveY =
        event.clientY - gestureRef.current.lastY;

      gestureRef.current.lastX = event.clientX;
      gestureRef.current.lastY = event.clientY;

      const maxMoveX =
        (window.innerWidth * (scale - 1)) / 2;
      const maxMoveY =
        (window.innerHeight * (scale - 1)) / 2;

      setImageX((currentX) =>
        clamp(currentX + moveX, -maxMoveX, maxMoveX)
      );

      setImageY((currentY) =>
        clamp(currentY + moveY, -maxMoveY, maxMoveY)
      );

      return;
    }

    if (!gestureRef.current.direction) {
      gestureRef.current.direction =
        Math.abs(deltaX) >= Math.abs(deltaY)
          ? "horizontal"
          : "vertical";
    }

    if (gestureRef.current.direction === "horizontal") {
      let nextDragX = deltaX;

      if (
        (selectedIndex === 0 && nextDragX > 0) ||
        (selectedIndex === media.length - 1 &&
          nextDragX < 0)
      ) {
        nextDragX *= 0.25;
      }

      setDragX(nextDragX);
    }

    if (
      gestureRef.current.direction === "vertical" &&
      deltaY > 0
    ) {
      setDragY(deltaY);
    }
  }

  function handlePointerEnd(event) {
    if (event.pointerType === "touch") return;

    finishGesture();
  }
  function handleWheel(event) {
  if (currentIsVideo) return;

  event.preventDefault();

  const zoomAmount = event.deltaY < 0 ? 0.25 : -0.25;

  setScale((currentScale) => {
    const nextScale = clamp(
      currentScale + zoomAmount,
      1,
      MAX_SCALE
    );

    if (nextScale === 1) {
      setImageX(0);
      setImageY(0);
    }

    return nextScale;
  });
}

  function handleDoubleClick() {
    if (currentIsVideo) return;

    if (scale > 1) {
      setScale(1);
      setImageX(0);
      setImageY(0);
    } else {
      setScale(2);
    }
  }

  function handleMediaTap() {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (
      timeSinceLastTap < 280 &&
      !currentIsVideo
    ) {
      handleDoubleClick();
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;

    window.setTimeout(() => {
      if (Date.now() - lastTapRef.current >= 260) {
        setShowControls((visible) => !visible);
      }
    }, 270);
  }

  if (
    selectedIndex === null ||
    !currentMedia ||
    media.length === 0
  ) {
    return null;
  }

  const closeProgress = clamp(
    dragY / 350,
    0,
    0.5
  );

  const viewerOpacity = 1 - closeProgress;

  const verticalScale = 1 - closeProgress * 0.18;

  return (
    <div
      className="gallery-viewer"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overflow: "hidden",
        background: `rgba(0,0,0,${
          0.97 * viewerOpacity
        })`,
        touchAction: "none",
        overscrollBehavior: "none",
      }}
    >
      <button
  type="button"
  onClick={closeViewer}
  aria-label="Đóng trình xem"
  style={{
    position: "absolute",
    top: "max(14px, env(safe-area-inset-top))",
    right: "16px",
    zIndex: 10020,
    width: "44px",
    height: "44px",
    border: "none",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.22)",
    color: "white",
    fontSize: "24px",
    lineHeight: 1,
    cursor: "pointer",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  }}
>
  ✕
</button>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={handleDoubleClick}
        onPointerUp={handlePointerEnd}
onPointerCancel={handlePointerEnd}
onDoubleClick={handleDoubleClick}
onWheel={handleWheel}S
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          cursor:
            scale > 1
              ? isDragging
                ? "grabbing"
                : "grab"
              : "default",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            transform: `translate3d(calc(-${
              selectedIndex * 100
            }% + ${dragX}px), ${dragY}px, 0) scale(${verticalScale})`,
            transition: isDragging
              ? "none"
              : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform",
          }}
        >
          {media.map((item, index) => {
            const itemIsVideo = isVideoFile(item);
            const isCurrentItem =
              index === selectedIndex;

            return (
              <div
                key={`${item.name}-${index}`}
                style={{
                  minWidth: "100%",
                  width: "100%",
                  height: "100%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding:
                    "max(70px, env(safe-area-inset-top)) 12px max(88px, env(safe-area-inset-bottom))",
                  boxSizing: "border-box",
                }}
                onClick={handleMediaTap}
              >
                {itemIsVideo ? (
                  <video
                    ref={(element) => {
                      videoRefs.current[index] = element;
                    }}
                    src={item.url}
                    controls
                    playsInline
                    preload={
                      Math.abs(index - selectedIndex) <= 1
                        ? "metadata"
                        : "none"
                    }
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      background: "black",
                    }}
                  />
                ) : (
                  <img
                    src={item.url}
                    alt={item.name || "Ảnh EverMoment"}
                    draggable="false"
                    loading={
                      Math.abs(index - selectedIndex) <= 1
                        ? "eager"
                        : "lazy"
                    }
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      userSelect: "none",
                      WebkitUserDrag: "none",
                      transform: isCurrentItem
                        ? `translate3d(${imageX}px, ${imageY}px, 0) scale(${scale})`
                        : "none",
                      transition:
                        isCurrentItem && !isDragging
                          ? "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)"
                          : "none",
                      transformOrigin: "center center",
                      willChange: "transform",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="gallery-toolbar gallery-toolbar-top"
        style={{
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls
            ? "auto"
            : "none",
        }}
      >
        <button
          type="button"
          className="gallery-icon-button"
          onClick={closeViewer}
          aria-label="Đóng"
        >
          ✕
        </button>

        <div className="gallery-counter">
          {selectedIndex + 1} / {media.length}
        </div>

        <button
          type="button"
          className="gallery-icon-button"
          onClick={saveCurrentMedia}
          disabled={isSaving}
          aria-label="Lưu hoặc tải xuống"
        >
          {isSaving ? "…" : "⇩"}
        </button>
      </div>

      {selectedIndex > 0 && scale === 1 && (
        <button
          type="button"
          className="gallery-desktop-arrow gallery-arrow-left"
          onClick={goPrevious}
          aria-label="Tệp trước"
        >
          ‹
        </button>
      )}

      {selectedIndex < media.length - 1 &&
        scale === 1 && (
          <button
            type="button"
            className="gallery-desktop-arrow gallery-arrow-right"
            onClick={goNext}
            aria-label="Tệp tiếp theo"
          >
            ›
          </button>
        )}

      <div
        className="gallery-toolbar gallery-toolbar-bottom"
        style={{
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls
            ? "auto"
            : "none",
        }}
      >
        <button
          type="button"
          className="gallery-action-button"
          onClick={saveCurrentMedia}
          disabled={isSaving}
        >
          {isSaving ? "Đang xử lý…" : "Lưu / Tải xuống"}
        </button>

        {onDelete && (
          <button
            type="button"
            className="gallery-action-button gallery-delete-button"
            onClick={deleteCurrentMedia}
          >
            Xóa
          </button>
        )}
      </div>
    </div>
  );
}

export default GalleryViewer;