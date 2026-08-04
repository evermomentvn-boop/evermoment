import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/**
 * QUY TẮC NÉN EVERMOMENT V1
 *
 * - Video <= 25 MB: giữ nguyên, không nén.
 * - Video > 25 MB: cố gắng nén còn khoảng 32 MB.
 * - Kích thước cuối cùng không được vượt 48 MB.
 * - Nếu phải giảm chất lượng quá thấp mới đạt yêu cầu:
 *   dừng và báo khách chọn video ngắn hơn.
 */

const MB = 1024 * 1024;

const COMPRESSION_THRESHOLD_BYTES = 25 * MB;
const TARGET_SIZE_BYTES = 32 * MB;
const MAX_OUTPUT_SIZE_BYTES = 48 * MB;

// Bitrate thấp hơn mức này thường làm video quá mờ.
const MIN_VIDEO_BITRATE_KBPS = 350;

// Giới hạn để tiết kiệm dung lượng cho giai đoạn thử nghiệm.
const MAX_VIDEO_BITRATE_KBPS = 2200;
const AUDIO_BITRATE_KBPS = 96;

let ffmpeg = null;
let ffmpegLoadingPromise = null;

/**
 * Chuyển byte thành MB để hiện thông tin dễ đọc.
 */
export function bytesToMB(bytes) {
  return Number((bytes / MB).toFixed(2));
}

/**
 * Kiểm tra video có cần nén không.
 */
export function shouldCompressVideo(file) {
  return file.size > COMPRESSION_THRESHOLD_BYTES;
}

/**
 * Đọc thời lượng video ngay trong trình duyệt.
 */
function getVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Không đọc được thông tin video."));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeout);
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    }

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const metadata = {
        duration: Number(video.duration),
        width: Number(video.videoWidth),
        height: Number(video.videoHeight),
      };

      cleanup();

      if (
        !Number.isFinite(metadata.duration) ||
        metadata.duration <= 0 ||
        !metadata.width ||
        !metadata.height
      ) {
        reject(new Error("Video không hợp lệ."));
        return;
      }

      resolve(metadata);
    };

    video.onerror = () => {
      cleanup();
      reject(
        new Error("Không đọc được video. Hãy thử chọn video khác.")
      );
    };

    video.src = objectUrl;
  });
}

/**
 * Khởi động FFmpeg một lần.
 * Những lần nén sau sẽ dùng lại, không tải lại từ đầu.
 */
async function loadFFmpeg(onStatus) {
  if (ffmpeg?.loaded) {
    return ffmpeg;
  }

  if (ffmpegLoadingPromise) {
    return ffmpegLoadingPromise;
  }

  ffmpegLoadingPromise = (async () => {
    onStatus?.({
      stage: "loading-engine",
      progress: 0,
      message: "Đang khởi động bộ tối ưu video…",
    });

    const instance = new FFmpeg();

    // Vite phải dùng đường dẫn ESM.
    const baseURL =
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

    await instance.load({
      coreURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        "text/javascript"
      ),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    ffmpeg = instance;

    onStatus?.({
      stage: "loading-engine",
      progress: 100,
      message: "Bộ tối ưu video đã sẵn sàng.",
    });

    return instance;
  })();

  try {
    return await ffmpegLoadingPromise;
  } catch (error) {
    ffmpegLoadingPromise = null;
    ffmpeg = null;

    throw new Error(
      `Không khởi động được bộ tối ưu video: ${
        error?.message || "Lỗi không xác định."
      }`
    );
  }
}

/**
 * Tính bitrate phù hợp dựa theo thời lượng video.
 *
 * File càng dài thì bitrate cần càng thấp để giữ file
 * trong khoảng dung lượng mục tiêu.
 */
function calculateVideoBitrate(durationSeconds) {
  const targetTotalKbps =
    (TARGET_SIZE_BYTES * 8) / durationSeconds / 1000;

  const calculatedVideoKbps = Math.floor(
    targetTotalKbps - AUDIO_BITRATE_KBPS
  );

  if (calculatedVideoKbps < MIN_VIDEO_BITRATE_KBPS) {
    throw new Error(
      "Video quá dài để nén xuống dưới giới hạn mà vẫn giữ hình ảnh rõ. " +
        "Vui lòng cắt ngắn hoặc chia video thành nhiều phần."
    );
  }

  return Math.min(
    calculatedVideoKbps,
    MAX_VIDEO_BITRATE_KBPS
  );
}

/**
 * Chọn độ phân giải dựa theo bitrate.
 *
 * Bitrate tốt: 720p
 * Bitrate trung bình: 540p
 * Bitrate thấp: 480p
 */
function getVideoScale(videoBitrateKbps) {
  if (videoBitrateKbps >= 1200) {
    return 1280;
  }

  if (videoBitrateKbps >= 700) {
    return 960;
  }

  return 854;
}

/**
 * Xóa file tạm trong bộ nhớ FFmpeg.
 */
async function safelyDeleteFile(instance, fileName) {
  try {
    await instance.deleteFile(fileName);
  } catch {
    // File tạm có thể chưa tồn tại, không cần báo lỗi.
  }
}

/**
 * Nén video cho EverMoment.
 *
 * Kết quả:
 * - Nếu video <= 25 MB: trả lại file gốc.
 * - Nếu video > 25 MB: trả về File MP4 đã nén.
 */
export async function compressVideoForUpload(
  file,
  { onStatus } = {}
) {
  if (!file) {
    throw new Error("Không tìm thấy video cần tối ưu.");
  }

  if (!shouldCompressVideo(file)) {
    onStatus?.({
      stage: "skipped",
      progress: 100,
      message: "Video đủ nhẹ, giữ nguyên chất lượng.",
      originalSizeMB: bytesToMB(file.size),
      outputSizeMB: bytesToMB(file.size),
    });

    return file;
  }

  onStatus?.({
    stage: "reading",
    progress: 0,
    message: "Đang kiểm tra video…",
    originalSizeMB: bytesToMB(file.size),
  });

 const metadata = await getVideoMetadata(file);
const { duration, width, height } = metadata;

const videoBitrateKbps =
  calculateVideoBitrate(duration);

// Video 1080p trở xuống giữ nguyên kích thước.
// Chỉ video 2K/4K mới thu xuống tối đa 1080p.
const needsScaling =
  width > 1920 || height > 1920;

  const instance = await loadFFmpeg(onStatus);

  const uniqueId =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "mov";

  const inputName = `input-${uniqueId}.${extension}`;
  const outputName = `output-${uniqueId}.mp4`;

  let progressHandler = null;

  try {
    onStatus?.({
      stage: "preparing",
      progress: 0,
      message: "Đang chuẩn bị video…",
      originalSizeMB: bytesToMB(file.size),
    });

    await instance.writeFile(
      inputName,
      await fetchFile(file)
    );

    progressHandler = ({ progress }) => {
      const safeProgress = Math.max(
        0,
        Math.min(100, Math.round(progress * 100))
      );

      onStatus?.({
        stage: "compressing",
        progress: safeProgress,
        message: `Đang tối ưu video… ${safeProgress}%`,
        originalSizeMB: bytesToMB(file.size),
      });
    };

    instance.on("progress", progressHandler);

    /**
     * Giải thích các thông số chính:
     *
     * - libx264: video MP4 H.264, tương thích rộng.
     * - scale: tối đa 720p/540p/480p tùy video.
     * - 30 fps: đủ mượt trên điện thoại.
     * - bitrate tính theo thời lượng để giữ dung lượng nhỏ.
     * - AAC 96 kbps: giữ giọng nói rõ, tiết kiệm dung lượng.
     * - faststart: video mở nhanh trên website.
     */
    const exitCode = await instance.exec([
      "-i",
      inputName,

      "-map_metadata",
      "-1",

     
      "-c:v",
      "libx264",

      "-preset",
      "superfast",

      "-b:v",
      `${videoBitrateKbps}k`,

      "-maxrate",
      `${videoBitrateKbps}k`,

      "-bufsize",
      `${videoBitrateKbps * 2}k`,

      "-pix_fmt",
      "yuv420p",

      "-c:a",
      "aac",

      "-b:a",
      `${AUDIO_BITRATE_KBPS}k`,

      "-ac",
      "2",

      "-movflags",
      "+faststart",

      "-y",
      outputName,
    ]);

    if (exitCode !== 0) {
      throw new Error(
        "Bộ tối ưu không xử lý được video này."
      );
    }

    const outputData =
      await instance.readFile(outputName);

    const outputBlob = new Blob(
      [outputData.buffer],
      {
        type: "video/mp4",
      }
    );

    if (!outputBlob.size) {
      throw new Error(
        "Video sau khi tối ưu không có dữ liệu."
      );
    }

    if (outputBlob.size > MAX_OUTPUT_SIZE_BYTES) {
      throw new Error(
        `Video sau khi tối ưu vẫn còn ${bytesToMB(
          outputBlob.size
        )} MB. Vui lòng cắt ngắn hoặc chia video thành nhiều phần.`
      );
    }

    const baseName =
      file.name.replace(/\.[^/.]+$/, "") ||
      "evermoment-video";

    const optimizedFile = new File(
      [outputBlob],
      `${baseName}-evermoment.mp4`,
      {
        type: "video/mp4",
        lastModified: Date.now(),
      }
    );

    onStatus?.({
      stage: "completed",
      progress: 100,
      message: `Đã tối ưu: ${bytesToMB(
        file.size
      )} MB → ${bytesToMB(optimizedFile.size)} MB`,
      originalSizeMB: bytesToMB(file.size),
      outputSizeMB: bytesToMB(optimizedFile.size),
      duration,
    });

    return optimizedFile;
  } catch (error) {
    console.error("Video compression error:", error);

    throw new Error(
      error?.message ||
        "Không thể tối ưu video. Vui lòng thử video khác."
    );
  } finally {
    if (progressHandler) {
      instance.off("progress", progressHandler);
    }

    await safelyDeleteFile(instance, inputName);
    await safelyDeleteFile(instance, outputName);
  }
}