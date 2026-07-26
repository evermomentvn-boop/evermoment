import { useState } from "react";

function MobileGalleryToolbar({
  selectedItem,
  onClose,
  onDelete,
  visible = true,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  async function getMediaFile() {
    if (!selectedItem?.url) {
      throw new Error("Không tìm thấy tệp.");
    }

    const response = await fetch(selectedItem.url);

    if (!response.ok) {
      throw new Error("Không tải được tệp.");
    }

    const blob = await response.blob();

    return new File(
      [blob],
      selectedItem.name || `evermoment-${Date.now()}`,
      {
        type:
          blob.type ||
          selectedItem.type ||
          "application/octet-stream",
      }
    );
  }

  async function handleDownload() {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      const file = await getMediaFile();
      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = file.name;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);

      setShowMenu(false);
    } catch (error) {
      console.error("Không thể tải xuống:", error);
      window.open(
        selectedItem?.url,
        "_blank",
        "noopener,noreferrer"
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleShare() {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      const file = await getMediaFile();

      if (
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: selectedItem?.name || "EverMoment",
        });
      } else if (navigator.share) {
        await navigator.share({
          title: selectedItem?.name || "EverMoment",
          url: selectedItem?.url,
        });
      } else {
        await navigator.clipboard.writeText(selectedItem?.url);
        window.alert("Đã sao chép đường dẫn.");
      }

      setShowMenu(false);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Không thể chia sẻ:", error);
        window.alert("Không thể chia sẻ tệp này.");
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDelete() {
    setShowMenu(false);

    if (onDelete) {
      await onDelete();
    }
  }

  return (
    <>
      <div
        className={`mobile-gallery-toolbar ${
          visible ? "is-visible" : "is-hidden"
        }`}
      >
        <button
          type="button"
          className="mobile-gallery-close"
          aria-label="Đóng"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          ✕
        </button>

        <button
          type="button"
          className="mobile-gallery-more"
          aria-label="Thêm tùy chọn"
          onClick={(event) => {
            event.stopPropagation();
            setShowMenu(true);
          }}
        >
          •••
        </button>
      </div>

      {showMenu && (
        <div
          className="mobile-sheet-overlay"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="mobile-gallery-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-sheet-handle" />

            <button
              type="button"
              className="mobile-sheet-action"
              onClick={handleDownload}
              disabled={isProcessing}
            >
              <span>↓</span>
              <span>Tải xuống</span>
            </button>

            <button
              type="button"
              className="mobile-sheet-action"
              onClick={handleShare}
              disabled={isProcessing}
            >
              <span>↗</span>
              <span>Chia sẻ</span>
            </button>

            {onDelete && (
              <button
                type="button"
                className="mobile-sheet-action mobile-sheet-delete"
                onClick={handleDelete}
                disabled={isProcessing}
              >
                <span>⌫</span>
                <span>Xóa</span>
              </button>
            )}

            <button
              type="button"
              className="mobile-sheet-cancel"
              onClick={() => setShowMenu(false)}
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