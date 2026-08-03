export async function createVideoThumbnail(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    let finished = false;

    function cleanup() {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    }

    function finish(blob) {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(blob);
    }

    function fail(error) {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error);
    }
        const timeout = setTimeout(() => {
      fail(new Error("Tạo thumbnail quá thời gian"));
    }, 15000);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) {
        clearTimeout(timeout);
        fail(new Error("Video không hợp lệ"));
        return;
      }

      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = () => {
      clearTimeout(timeout);

      const canvas = document.createElement("canvas");

      const SIZE = 500;

      canvas.width = SIZE;
      canvas.height = SIZE;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        fail(new Error("Không tạo được canvas"));
        return;
      }

      const scale = Math.max(
        SIZE / video.videoWidth,
        SIZE / video.videoHeight
      );

      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;

      const x = (SIZE - width) / 2;
      const y = (SIZE - height) / 2;

      ctx.drawImage(video, x, y, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            fail(new Error("Không tạo được thumbnail"));
            return;
          }

          finish(blob);
        },
        "image/webp",
        0.82
      );
    };

    video.onerror = () => {
      clearTimeout(timeout);
      fail(new Error("Không đọc được video"));
    };

    video.src = objectUrl;
  });
}