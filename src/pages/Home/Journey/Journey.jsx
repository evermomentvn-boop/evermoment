import { useState } from "react";
import { supabase } from "../../../supabase";
import "./Journey.css";

export default function Journey({
    selectedJourney,
    allFiles = [],
    journeyMoments = [],
    setJourneyMoments,
    onOpenFile,
    onBack,
    readOnly = false,
    momentsLoading = false,
    momentsError = "",
}) {
    const [showPicker, setShowPicker] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [showMomentMenu, setShowMomentMenu] = useState(false);
    const [isSelectingMoments, setIsSelectingMoments] = useState(false);
const [selectedMomentFiles, setSelectedMomentFiles] = useState([]);
    return (
        <main className="journey-page">
            <header className="journey-header">
                <button
                    type="button"
                    className="journey-back"
                    onClick={onBack}
                    aria-label="Trở về trang trước"
                >
                    ←
                </button>

                <div>
                    <h1>{selectedJourney?.title || "Con lớn lên – An"}</h1>
                    <p>{selectedJourney?.subtitle || "2 tuổi 4 tháng"}</p>
                </div>
            </header>

            <section className="journey-intro">
  <span>
  {selectedJourney?.image_url ? (
    <img
      src={selectedJourney.image_url}
      alt={selectedJourney?.title || "Ảnh hành trình"}
      className="journey-intro-image"
    />
  ) : (
    selectedJourney?.icon || "👶"
  )}
</span>

  <div>
    <strong>{selectedJourney?.title || "Con lớn lên – An"}</strong>
    <p>
      {selectedJourney?.description ||
        "Những khoảnh khắc trên hành trình con lớn lên."}
    </p>
  </div>
</section>

            <section className="journey-moments">
                <div className="journey-section-title">
    <h2>Khoảnh khắc</h2>

    {!readOnly && <div className="journey-section-actions">
        <button
            type="button"
            className="journey-add-moment"
            onClick={() => setShowPicker(true)}
        >
            + Thêm khoảnh khắc
        </button>

        <button
            type="button"
            className="journey-more-button"
            onClick={() => setShowMomentMenu((current) => !current)}
            aria-label="Tùy chọn khoảnh khắc"
        >
            •••
        </button>
    </div>}
</div>
{momentsLoading && <p>Đang tải khoảnh khắc...</p>}
{momentsError && <p role="alert">Không thể tải khoảnh khắc: {momentsError}</p>}
{!readOnly && isSelectingMoments && (
    <div className="journey-selection-bar">
        <button
            type="button"
            onClick={() => {
                setIsSelectingMoments(false);
                setSelectedMomentFiles([]);
            }}
        >
            Hủy
        </button>

        <span>Đã chọn {selectedMomentFiles.length}</span>

    <button
  type="button"
  className="journey-remove-selected"
  disabled={selectedMomentFiles.length === 0}
  onClick={async () => {
    const customerId = localStorage.getItem("customerId");

    if (!customerId) {
      alert("Không xác định được kho đang đăng nhập.");
      return;
    }

    const selectedPaths = new Set(
      selectedMomentFiles.map((file) => file.path)
    );

    const momentsToUpdate = journeyMoments
      .map((moment) => ({
        ...moment,
        files: moment.files.filter(
          (file) => !selectedPaths.has(file.path)
        ),
      }));

    for (const oldMoment of journeyMoments) {
      const updatedMoment = momentsToUpdate.find(
        (moment) => moment.id === oldMoment.id
      );

      if (!updatedMoment) continue;

      if (updatedMoment.files.length === 0) {
        const { error } = await supabase.functions.invoke(
          "delete-journey-moment",
          {
            body: {
              customerId,
              journeyId: selectedJourney.id,
              momentId: oldMoment.id,
            },
          }
        );

        if (error) {
          console.error("Không xóa được khoảnh khắc:", error);
          alert("Không xóa được khoảnh khắc. Vui lòng thử lại.");
          return;
        }
      }
    else {
  const { error } = await supabase.functions.invoke(
    "update-journey-moment",
    {
      body: {
        customerId,
        journeyId: selectedJourney.id,
        momentId: oldMoment.id,
        momentData: updatedMoment,
      },
    }
  );

  if (error) {
    console.error("Không cập nhật được khoảnh khắc:", error);
    alert("Không cập nhật được khoảnh khắc. Vui lòng thử lại.");
    return;
  }
}
 }   
    setJourneyMoments(
      momentsToUpdate.filter((moment) => moment.files.length > 0)
    );

    setSelectedMomentFiles([]);
    setIsSelectingMoments(false);
  }}
>
  Xóa khỏi hành trình
</button>
    </div>
)}
{!readOnly && showMomentMenu && (
    <div className="journey-moment-menu">
        <button
            type="button"
            onClick={() => {
                setIsSelectingMoments(true);
                setSelectedMomentFiles([]);
                setShowMomentMenu(false);
            }}
        >
            Chọn khoảnh khắc
        </button>
    </div>
)}
                {journeyMoments.map((moment) => (
                    <div className="journey-timeline-entry" key={moment.id}>
                        <div className="journey-timeline-date">
                            <span>{moment.date.day}</span>

                            <div>
                                <strong>{moment.date.month}</strong>
                                {selectedJourney?.id === "an" && (
                                <small>{selectedJourney.subtitle}</small>
                                )}
                            </div>
                        </div>

                        <div className="journey-moment-grid">
                            {moment.files.map((file, index) => (
                                <div
    className="journey-moment-item"
    key={file.path || index}
    onClick={() => {
    if (isSelectingMoments) {
        setSelectedMomentFiles((current) => {
            const exists = current.some(
                (item) => item.path === file.path
            );

            if (exists) {
                return current.filter(
                    (item) => item.path !== file.path
                );
            }

            return [...current, file];
        });

        return;
    }

    onOpenFile?.(file, moment.files);
}}
    role="button"
    tabIndex={0}
>
                                    {file.type?.startsWith("video") ? (
    <>
        <video
            src={file.url}
            poster={file.thumbnail || undefined}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
                if (!file.thumbnail && e.currentTarget.duration > 0.2) {
                    e.currentTarget.currentTime = 0.2;
                }
            }}
        />

        <span className="journey-video-play">▶</span>
    </>
) : (
    
                                        <img
                                            src={file.thumbnail || file.url}
                                            alt=""
                                        />
                                    )}
                                    {isSelectingMoments &&
    selectedMomentFiles.some((item) => item.path === file.path) && (
        <span className="journey-selected-mark">✓</span>
    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {!readOnly && showPicker && (
                    <div className="journey-picker">
                        <div className="journey-picker-header">
                            <h3>Chọn khoảnh khắc</h3>

                            <div className="journey-picker-actions">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedFiles([]);
                                        setShowPicker(false);
                                    }}
                                >
                                    Hủy
                                </button>

                                <button
                                    type="button"
                                    className="journey-picker-done"
                                    disabled={selectedFiles.length === 0}
                                    onClick={async () => {
                                        const today = new Date();

                                        const newMoment = {
                                            id: Date.now(),
                                            date: {
                                                day: today.getDate(),
                                                month: `Tháng ${today.getMonth() + 1}, ${today.getFullYear()}`,
                                            },
                                            files: [...selectedFiles],
                                        };
                                        const customerId = localStorage.getItem("customerId");
                                        if (!customerId) {
    alert("Không xác định được kho đang đăng nhập.");
    return;
}

const { error: saveError } = await supabase.functions.invoke(
  "save-journey-moment",
  {
    body: {
      customerId: customerId,
      journeyId: selectedJourney.id,
      momentData: newMoment,
    },
  }
);

if (saveError) {
    console.error("Không lưu được hành trình:", saveError);
    alert("Không lưu được khoảnh khắc. Vui lòng thử lại.");
    return;
}
                                        setJourneyMoments((current) => {
                                            const sameDayIndex = current.findIndex(
                                                (moment) =>
                                                    moment.date.day === newMoment.date.day &&
                                                    moment.date.month === newMoment.date.month
                                            );

                                            // Chưa có ngày này → tạo cụm mới
                                            if (sameDayIndex === -1) {
                                                return [newMoment, ...current];
                                            }

                                            // Đã có ngày này → thêm ảnh/video vào cụm cũ
                                            return current.map((moment, index) => {
                                                if (index !== sameDayIndex) return moment;

                                                const existingPaths = new Set(
                                                    moment.files.map((file) => file.path)
                                                );

                                                const newFiles = newMoment.files.filter(
                                                    (file) => !existingPaths.has(file.path)
                                                );

                                                return {
                                                    ...moment,
                                                    files: [...moment.files, ...newFiles],
                                                };
                                            });
                                        });

                                        setSelectedFiles([]);
                                        setShowPicker(false);
                                    }}
                                >
                                    Xong ({selectedFiles.length})
                                </button>
                            </div>
                        </div>

                        <div className="journey-picker-grid">
                            {allFiles.map((file, index) => (
                                <div
                                    className={`journey-picker-item ${selectedFiles.some((item) => item.path === file.path)
                                            ? "selected"
                                            : ""
                                        }`}
                                    key={file.path || index}
                                    onClick={() => {
                                        setSelectedFiles((current) => {
                                            const alreadySelected = current.some(
                                                (item) => item.path === file.path
                                            );

                                            if (alreadySelected) {
                                                return current.filter(
                                                    (item) => item.path !== file.path
                                                );
                                            }

                                            return [...current, file];
                                        });
                                    }}
                                >
                                    {file.type?.startsWith("video") ? (
                                        <video src={file.thumbnail || file.url} muted />
                                    ) : (
                                        <img
                                            src={file.thumbnail || file.url}
                                            alt=""
                                        />
                                    )}
                                    {selectedFiles.some((item) => item.path === file.path) && (
                                        <span className="journey-selected-check">✓</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}