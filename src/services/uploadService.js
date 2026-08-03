import { supabase } from "../supabase";
import { createImageThumbnail } from "../utils/imageThumbnail";
import { createVideoThumbnail } from "../utils/videoThumbnail";

function getFileType(file) {
  const isImage =
    file.type?.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(file.name);

  const isVideo =
    file.type?.startsWith("video/") ||
    /\.(mp4|mov|m4v|webm)$/i.test(file.name);

  return { isImage, isVideo };
}

function createFallbackVideoThumbnail() {
  return new Promise((resolve, reject) => {
    const size = 500;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Không tạo được ảnh đại diện video."));
      return;
    }

    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = "#202124";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 92px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("▶", size / 2, size / 2 - 18);

    ctx.font = "24px Arial";
    ctx.fillText("VIDEO", size / 2, size / 2 + 86);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Không tạo được ảnh đại diện video."));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      0.8
    );
  });
}

export async function uploadFile(file, folderName) {
  if (!file || !folderName) {
    throw new Error("Thiếu file hoặc tên thư mục.");
  }

  const { isImage, isVideo } = getFileType(file);

  if (!isImage && !isVideo) {
    throw new Error(`Định dạng "${file.name}" chưa được hỗ trợ.`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uploadId =
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const storedName = `${uploadId}-${safeName}`;
  const filePath = `${folderName}/${storedName}`;

  // 1. Luôn tải file gốc trước
  const { error: uploadError } = await supabase.storage
    .from("memories")
    .upload(filePath, file, {
      contentType:
        file.type ||
        (isVideo ? "video/mp4" : isImage ? "image/jpeg" : undefined),
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: fileUrlData } = supabase.storage
    .from("memories")
    .getPublicUrl(filePath);

  let thumbnailUrl = null;

  // 2. Tạo thumbnail sau, lỗi cũng không làm mất file gốc
  try {
    let thumbnailBlob = null;
    let thumbnailName = "";

    if (isImage) {
      thumbnailBlob = await createImageThumbnail(file);
      thumbnailName = `thumb-${storedName}.webp`;
    }

    if (isVideo) {
      try {
        thumbnailBlob = await createVideoThumbnail(file);
      } catch (error) {
        console.warn(
          "Không lấy được khung hình thật, dùng ảnh video mặc định:",
          error
        );

        thumbnailBlob = await createFallbackVideoThumbnail();
      }

      thumbnailName = `thumb-video-${storedName}.webp`;
    }

    if (thumbnailBlob && thumbnailName) {
      const thumbnailPath = `${folderName}/${thumbnailName}`;

      const { error: thumbnailError } = await supabase.storage
        .from("memories")
        .upload(thumbnailPath, thumbnailBlob, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });

      if (!thumbnailError) {
        const { data: thumbnailData } = supabase.storage
          .from("memories")
          .getPublicUrl(thumbnailPath);

        thumbnailUrl = thumbnailData.publicUrl;
      } else {
        console.warn("Thumbnail upload error:", thumbnailError);
      }
    }
  } catch (thumbnailError) {
    console.warn(
      "Không tạo được thumbnail nhưng file gốc vẫn đã lưu:",
      thumbnailError
    );
  }

  return {
    name: file.name,
    type:
      file.type ||
      (isVideo ? "video/mp4" : isImage ? "image/jpeg" : ""),
    url: fileUrlData.publicUrl,
    thumbnail: thumbnailUrl,
    path: filePath,
  };
}