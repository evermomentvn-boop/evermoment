import { useEffect, useState } from "react";

async function getMediaFile(item) {
  const response = await fetch(item.url);
  if (!response.ok) throw new Error("Không tải được tệp từ kho ký ức.");
  const blob = await response.blob();
  return new File([blob], item.name || `evermoment-${Date.now()}`, {
    type: blob.type || item.type || "application/octet-stream",
  });
}

function downloadBlob(file) {
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

function MobileGalleryToolbar({ selectedItem, onClose, onDelete, visible = true }) {
  const [showMenu, setShowMenu] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);

  useEffect(() => {
    setShowMenu(false);
    setProcessingAction(null);
  }, [selectedItem?.url]);

  function stopGalleryGesture(event) {
    event.stopPropagation();
  }

  async function openSystemShare(file, title) {
    if (!navigator.share) return false;
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title });
    return true;
  }

  async function handleSave(event) {
    stopGalleryGesture(event);
    if (processingAction || !selectedItem?.url) return;
    setProcessingAction("save");
    try {
      const file = await getMediaFile(selectedItem);
      const shared = await openSystemShare(file, selectedItem.name || "EverMoment");
      if (!shared) {
        downloadBlob(file);
        window.alert("Tệp đã được tải xuống. Trên điện thoại, tệp thường nằm trong mục Tải về/Tệp.");
      }
      setShowMenu(false);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        window.alert("Không thể chuẩn bị tệp. EverMoment sẽ không chuyển bạn sang đường dẫn Supabase.");
      }
    } finally {
      setProcessingAction(null);
    }
  }

  async function handleShare(event) {
    stopGalleryGesture(event);
    if (processingAction || !selectedItem?.url) return;
    setProcessingAction("share");
    try {
      const file = await getMediaFile(selectedItem);
      const shared = await openSystemShare(file, selectedItem.name || "EverMoment");
      if (!shared) {
        downloadBlob(file);
        window.alert("Trình duyệt này chưa hỗ trợ bảng chia sẻ tệp. EverMoment đã tải tệp xuống để bạn gửi qua Email hoặc ứng dụng khác.");
      }
      setShowMenu(false);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        window.alert("Không thể mở bảng chia sẻ tệp.");
      }
    } finally {
      setProcessingAction(null);
    }
  }

  async function handleDelete(event) {
    stopGalleryGesture(event);
    if (processingAction || !onDelete) return;
    setProcessingAction("delete");
    setShowMenu(false);
    try {
      await onDelete();
    } finally {
      setProcessingAction(null);
    }
  }

  const isProcessing = Boolean(processingAction);

  return (
    <>
      <div
        className={`mobile-gallery-toolbar ${visible ? "is-visible" : "is-hidden"}`}
        data-viewer-control="true"
        onTouchStart={stopGalleryGesture}
        onTouchMove={stopGalleryGesture}
        onTouchEnd={stopGalleryGesture}
        onPointerDown={stopGalleryGesture}
        onPointerMove={stopGalleryGesture}
        onPointerUp={stopGalleryGesture}
        onClick={stopGalleryGesture}
      >
        <button type="button" className="mobile-gallery-close" aria-label="Đóng" disabled={isProcessing} onClick={(event) => { stopGalleryGesture(event); onClose?.(); }}>
          ✕
        </button>
        <button type="button" className="mobile-gallery-more" aria-label="Thêm tùy chọn" aria-expanded={showMenu} disabled={isProcessing} onClick={(event) => { stopGalleryGesture(event); setShowMenu((value) => !value); }}>
          •••
        </button>
      </div>

      {showMenu && (
        <div className="mobile-sheet-overlay" data-viewer-control="true" onClick={() => setShowMenu(false)} onTouchMove={stopGalleryGesture}>
          <div className="mobile-gallery-sheet" onClick={stopGalleryGesture}>
            <div className="mobile-sheet-handle" />
            <button type="button" className="mobile-sheet-action" disabled={isProcessing} onClick={handleSave}>
              <span>⇩</span><span>{processingAction === "save" ? "Đang chuẩn bị…" : "Lưu vào Ảnh / Tệp"}</span>
            </button>
            <button type="button" className="mobile-sheet-action" disabled={isProcessing} onClick={handleShare}>
              <span>↗</span><span>{processingAction === "share" ? "Đang chuẩn bị…" : "Chia sẻ qua ứng dụng / Email"}</span>
            </button>
            {onDelete && (
              <button type="button" className="mobile-sheet-action mobile-sheet-delete" disabled={isProcessing} onClick={handleDelete}>
                <span>⌫</span><span>Xóa khỏi kho ký ức</span>
              </button>
            )}
            <button type="button" className="mobile-sheet-cancel" disabled={isProcessing} onClick={() => setShowMenu(false)}>Hủy</button>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileGalleryToolbar;
