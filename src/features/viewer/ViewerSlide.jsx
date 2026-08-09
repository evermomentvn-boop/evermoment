import MobileVideoPlayer from "../../MobileVideoPlayer";
import { isVideo } from "./viewerUtils";

function ViewerSlide({
  item,
  active,
  imageTransform,
  imageTransition,
  controlsVisible,
  setVideoRef,
  onTap,
}) {
  if (!item) {
    return <div className="ev-viewer-slide" aria-hidden="true" />;
  }

  const video = isVideo(item);

  return (
    <div className="ev-viewer-slide" onClick={onTap}>
      <div className="ev-viewer-media-frame">
        {video ? (
          <MobileVideoPlayer
            src={item.url}
            poster={item.thumbnail}
            active={active}
            controlsVisible={controlsVisible}
            onMediaTap={onTap}
            setVideoRef={setVideoRef}
          />
        ) : (
          <img
            className="ev-viewer-image"
            src={item.url}
            alt={item.name || "Ảnh EverMoment"}
            draggable={false}
            decoding="async"
            fetchPriority={active ? "high" : "auto"}
            onContextMenu={(event) => event.preventDefault()}
            style={{
              transform: active ? imageTransform : "translate3d(0,0,0) scale(1)",
              transition: active ? imageTransition : "none",
            }}
          />
        )}
      </div>
    </div>
  );
}

export default ViewerSlide;
