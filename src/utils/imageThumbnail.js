export async function createImageThumbnail(file) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");

      const SIZE = 500;

      canvas.width = SIZE;
      canvas.height = SIZE;

      const ctx = canvas.getContext("2d");

      const scale = Math.max(
        SIZE / img.width,
        SIZE / img.height
      );

      const width = img.width * scale;
      const height = img.height * scale;

      const x = (SIZE - width) / 2;
      const y = (SIZE - height) / 2;

      ctx.drawImage(img, x, y, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          resolve(blob);
        },
        "image/webp",
        0.82
      );
    };

    img.src = URL.createObjectURL(file);
  });
}