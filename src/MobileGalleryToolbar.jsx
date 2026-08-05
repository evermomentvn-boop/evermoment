import { useEffect, useRef, useState } from "react";

function MobileGalleryToolbar({
  selectedItem,
  onClose,
  onDelete,
  visible = true,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [processingAction, setProcessingAction] =
    useState(null);

  const lastButtonTapRef = useRef(0);

  useEffect(() => {
    setShowMenu(false);
    setProcessingAction(null);
  }, [selectedItem?.url]);

  function stopGalleryGesture(event) {
    event.stopPropagation();
  }

  function canPressButton() {
    const now = Date.now();

    if (now - lastButtonTapRef.current < 180) {
      return false;
    }

    lastButtonTapRef.current = now;
    return true;
  }

  function openOriginalFile() {
    if (!selectedItem?.url) {
      window.alert("Không tìm thấy tệp.");
      return;
    }

    /*
     * Không tải video lớn vào RAM.
     * Safari sẽ mở tệp gốc:
     * - Ảnh: có thể nhấn giữ để lưu.
     * - Video: có thể dùng nút Chia sẻ/Lưu của Safari.
     */
    const newWindow = window.open(
      selectedItem.url,
      "_blank"
    );

    if (newWindow) {
      newWindow.opener = null;
    } else {
      window.location.assign(selectedItem.url);
    }
  }

  function handleClose(event) {
    stopGalleryGesture(event);

    if (!canPressButton() || processingAction) {
      return;
    }

    setShowMenu(false);
    onClose?.();
  }

  function handleToggleMenu(event) {
    stopGalleryGesture(event);

    if (!canPressButton() || processingAction) {
      return;
    }

    setShowMenu((current) => !current);
  }
async function handleDownload(event) {
  stopGalleryGesture(event);

  if (processingAction || !selectedItem?.url) {
    return;
  }

  setProcessingAction("download");

  try {
    const response = await fetch(selectedItem.url);

    if (!response.ok) {
      throw new Error("Không tải được tệp.");
    }

    const blob = await response.blob();

    const file = new File(
      [blob],
      selectedItem.name || `evermoment-${Date.now()}`,
      {
        type:
          blob.type ||
          selectedItem.type ||
          "application/octet-stream",
      }
    );

    if (
      navigator.share &&
      navigator.canShare?.({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        title: selectedItem.name || "EverMoment",
      });

      setShowMenu(false);
      return;
    }

    window.alert(
      "Thiết bị này chưa hỗ trợ lưu trực tiếp. Hãy mở bằng Safari trên iPhone."
    );
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("Không thể lưu tệp:", error);
      window.alert("Không thể chuẩn bị tệp để lưu.");
    }
  } finally {
    setProcessingAction(null);
  }
}

  async function handleShare(event) {
    stopGalleryGesture(event);

    if (processingAction || !selectedItem?.url) {
      return;
    }

    setProcessingAction("share");

    try {
      /*
       * Chia sẻ URL thay vì tải toàn bộ video vào RAM.
       * Cách này nhẹ và ổn định hơn trên Safari.
       */
      if (navigator.share) {
        await navigator.share({
          title: selectedItem.name || "EverMoment",
          url: selectedItem.url,
        });

        setShowMenu(false);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(
          selectedItem.url
        );

        window.alert("Đã sao chép đường dẫn.");
        setShowMenu(false);
        return;
      }

      setShowMenu(false);
      openOriginalFile();
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Không thể chia sẻ:", error);
        window.alert(
          "Không thể mở bảng chia sẻ. Hãy thử Mở để lưu."
        );
      }
    } finally {
      setProcessingAction(null);
    }
  }

  async function handleDelete(event) {
    stopGalleryGesture(event);

    if (processingAction || !onDelete) {
      return;
    }

    setProcessingAction("delete");
    setShowMenu(false);

    try {
      await onDelete();
    } catch (error) {
      console.error("Không thể xóa:", error);
    } finally {
      setProcessingAction(null);
    }
  }

  const isProcessing = Boolean(processingAction);

  return (
    <>
      <div
        className={`mobile-gallery-toolbar ${
          visible ? "is-visible" : "is-hidden"
        }`}
        onTouchStart={stopGalleryGesture}
        onTouchMove={stopGalleryGesture}
        onTouchEnd={stopGalleryGesture}
        onPointerDown={stopGalleryGesture}
        onPointerUp={stopGalleryGesture}
        onClick={stopGalleryGesture}
      >
        <button
          type="button"
          className="mobile-gallery-close"
          aria-label="Đóng"
          disabled={isProcessing}
          onClick={handleClose}
        >
          ✕
        </button>

        <button
          type="button"
          className="mobile-gallery-more"
          aria-label="Thêm tùy chọn"
          aria-expanded={showMenu}
          disabled={isProcessing}
          onClick={handleToggleMenu}
        >
          •••
        </button>
      </div>

      {showMenu && (
        <div
          className="mobile-sheet-overlay"
          onTouchStart={stopGalleryGesture}
          onTouchMove={stopGalleryGesture}
          onTouchEnd={stopGalleryGesture}
          onPointerDown={stopGalleryGesture}
          onPointerUp={stopGalleryGesture}
          onClick={(event) => {
            stopGalleryGesture(event);

            if (!isProcessing) {
              setShowMenu(false);
            }
          }}
        >
          <div
            className="mobile-gallery-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Tùy chọn ảnh hoặc video"
            onClick={stopGalleryGesture}
          >
            <div className="mobile-sheet-handle" />

            <button
              type="button"
              className="mobile-sheet-action"
              onClick={handleDownload}
              disabled={isProcessing}
            >
              <span>↓</span>
              <span>
             {processingAction === "download"
             ? "Đang chuẩn bị…"
             : "Lưu vào Ảnh"}
             </span>
            </button>

            <button
              type="button"
              className="mobile-sheet-action"
              onClick={handleShare}
              disabled={isProcessing}
            >
              <span>↗</span>
              <span>
                {processingAction === "share"
                  ? "Đang mở chia sẻ…"
                  : "Chia sẻ"}
              </span>
            </button>

            {onDelete && (
              <button
                type="button"
                className="mobile-sheet-action mobile-sheet-delete"
                onClick={handleDelete}
                disabled={isProcessing}
              >
                <span>⌫</span>
                <span>
                  {processingAction === "delete"
                    ? "Đang xóa…"
                    : "Xóa"}
                </span>
              </button>
            )}

            <button
              type="button"
              className="mobile-sheet-cancel"
              disabled={isProcessing}
              onClick={(event) => {
                stopGalleryGesture(event);
                setShowMenu(false);
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileGalleryToolbar;