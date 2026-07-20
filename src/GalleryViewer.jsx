import { useRef, useState } from "react";

function GalleryViewer({
  images,
  selectedIndex,
  setSelectedIndex,
  onClose,
}) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(null);

  if (selectedIndex === null || images.length === 0) {
    return null;
  }

  function handlePointerDown(event) {
    startXRef.current = event.clientX;
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!isDragging || startXRef.current === null) return;

    let offset = event.clientX - startXRef.current;

    // Tạo cảm giác cản nhẹ khi kéo quá ảnh đầu hoặc ảnh cuối
    if (
      (selectedIndex === 0 && offset > 0) ||
      (selectedIndex === images.length - 1 && offset < 0)
    ) {
      offset *= 0.25;
    }

    setDragOffset(offset);
  }

  function handlePointerEnd() {
    if (!isDragging) return;

    const threshold = 60;

    if (
      dragOffset < -threshold &&
      selectedIndex < images.length - 1
    ) {
      setSelectedIndex(selectedIndex + 1);
    } else if (dragOffset > threshold && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }

    setDragOffset(0);
    setIsDragging(false);
    startXRef.current = null;
  }

  function closeViewer() {
    setDragOffset(0);
    setIsDragging(false);
    startXRef.current = null;
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.97)",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={closeViewer}
        style={{
          position: "absolute",
          top: "18px",
          right: "18px",
          zIndex: 10002,
          width: "44px",
          height: "44px",
          border: "none",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.18)",
          color: "white",
          fontSize: "24px",
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          touchAction: "pan-y",
          cursor: isDragging ? "grabbing" : "grab",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            transform: `translateX(calc(-${
              selectedIndex * 100
            }% + ${dragOffset}px))`,
            transition: isDragging
              ? "none"
              : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {images.map((image) => (
            <div
              key={image.name}
              style={{
                minWidth: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "70px 12px 80px",
                boxSizing: "border-box",
              }}
            >
              <img
                src={image.url}
                alt={image.name}
                draggable="false"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {selectedIndex > 0 && (
        <button
          type="button"
          className="gallery-desktop-arrow"
          onClick={() => setSelectedIndex(selectedIndex - 1)}
          style={{
            position: "absolute",
            left: "18px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10001,
            width: "48px",
            height: "48px",
            border: "none",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            color: "white",
            fontSize: "30px",
            cursor: "pointer",
          }}
        >
          ‹
        </button>
      )}

      {selectedIndex < images.length - 1 && (
        <button
          type="button"
          className="gallery-desktop-arrow"
          onClick={() => setSelectedIndex(selectedIndex + 1)}
          style={{
            position: "absolute",
            right: "18px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10001,
            width: "48px",
            height: "48px",
            border: "none",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            color: "white",
            fontSize: "30px",
            cursor: "pointer",
          }}
        >
          ›
        </button>
      )}

      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10001,
          background: "rgba(0,0,0,0.55)",
          color: "white",
          padding: "6px 14px",
          borderRadius: "20px",
          fontSize: "14px",
        }}
      >
        {selectedIndex + 1} / {images.length}
      </div>
    </div>
  );
}

export default GalleryViewer;