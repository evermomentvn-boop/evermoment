import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import GalleryViewer from "./GalleryViewer";
import { uploadFile } from "./services/uploadService";
function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [screen, setScreen] = useState("home");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [files, setFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState(null);
const [isUploading, setIsUploading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [mediaFilter, setMediaFilter] = useState("all");

const mediaFiles = files.filter(
  (file) =>
    file.type.startsWith("image/") ||
    file.type.startsWith("video/")
);

const filteredMediaFiles = mediaFiles.filter((file) => {
  if (mediaFilter === "image") {
    return file.type.startsWith("image/");
  }

  if (mediaFilter === "video") {
    return file.type.startsWith("video/");
  }

  return true;
});
const [customerCode, setCustomerCode] = useState("");
const [customerName, setCustomerName] = useState("");
const [folderName, setFolderName] = useState("");
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const codeFromUrl = params.get("code");

  if (codeFromUrl) {
    const code = codeFromUrl.trim().toUpperCase();
    setCustomerCode(code);
    checkWarehouse(code);
    } else {
  setScreen("login");
  }
}, []);
useEffect(() => {
  if (screen === "memory" && folderName) {
    loadFiles(folderName);
  }
}, [screen, folderName]);

  async function checkWarehouse(code) {
  const { data: customer, error } = await supabase
    .from("customers")
    .select("password_hash")
    .eq("customer_code", code)
    .maybeSingle();

  if (error || !customer) {
    alert("Không tìm thấy mã kho.");
    return;
  }

  if (customer.password_hash) {
    setScreen("login");
  } else {
    setScreen("create-password");
  }
}
  async function openMemory() {
  setLoginPassword("");

  const code = customerCode.trim().toUpperCase();

  if (!code) {
    setScreen("create-password");
    return;
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select("password_hash")
    .eq("customer_code", code)
    .maybeSingle();

  if (error || !customer) {
    alert("Không tìm thấy mã kho.");
    return;
  }

  if (customer.password_hash) {
    setScreen("login");
  } else {
    setScreen("create-password");
  }
}

  async function createPassword() {
  const code = customerCode.trim().toUpperCase();

  if (!code) {
    alert("Vui lòng nhập mã kho.");
    return;
  }

  if (password.length < 6) {
    alert("Mật khẩu phải có ít nhất 6 ký tự.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Hai mật khẩu không giống nhau.");
    return;
  }

  try {
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, customer_code, customer_name, folder_name, password_hash")
      .eq("customer_code", code)
      .maybeSingle();

    if (error) {
      console.error(error);
      alert("Không thể kiểm tra mã kho. Vui lòng thử lại.");
      return;
    }

    if (!customer) {
      alert("Mã kho không tồn tại. Vui lòng kiểm tra lại mã được cấp.");
      return;
    }

    if (customer.password_hash) {
      alert("Kho này đã thiết lập mật khẩu. Vui lòng đăng nhập.");
      setLoginPassword("");
      setScreen("login");
      return;
    }

    const { data: result, error: saveError } =
  await supabase.functions.invoke("set-memory-password", {
    body: {
      customerCode: code,
      password,
    },
  });

if (saveError) {
  alert("Không lưu được mật khẩu.");
  return;
}

if (!result.success) {
  alert(result.error);
  return;
}

localStorage.setItem("folderName", customer.folder_name);


setFolderName(customer.folder_name);
setScreen("memory");
  } catch (error) {
    console.error(error);
    alert("Không thể kết nối máy chủ. Vui lòng thử lại.");
  }
}

  async function login() {
  const code = customerCode.trim().toUpperCase();
  const password = loginPassword;

  if (!code || !password) {
    alert("Vui lòng nhập mã kho và mật khẩu.");
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke("login-memory", {
      body: {
        customerCode: code,
        password,
      },
    });

    if (error) {
      console.error(error);
      alert("Mã kho hoặc mật khẩu không đúng.");
      return;
    }

    if (!data?.success) {
      alert(data?.error || "Đăng nhập không thành công.");
      return;
    }

    setCustomerName(data.customer.name);

setFolderName(data.customer.folderName);

localStorage.setItem("folderName", data.customer.folderName);

setScreen("memory");
  } catch (error) {
    console.error(error);
    alert("Không thể kết nối máy chủ. Vui lòng thử lại.");
  }
}
async function uploadFiles(event) {
  const selectedFiles = Array.from(event.target.files || []);

  if (selectedFiles.length === 0) {
    return;
  }

  if (isUploading) {
    return;
  }

  setIsUploading(true);

  try {
    for (const file of selectedFiles) {
      try {
        setUploadStatus({
          stage: "starting",
          progress: 0,
          message: "Đang chuẩn bị...",
          fileName: file.name,
        });

        const uploadedFile = await uploadFile(
          file,
          folderName,
          {
            onStatus: (status) => {
              setUploadStatus({
                ...status,
                fileName: file.name,
              });
            },
          }
        );

        setFiles((current) => [
          ...current,
          uploadedFile,
        ]);
      } catch (error) {
        console.error("Upload failed:", error);

        alert(
          `Không tải được "${file.name}": ${
            error?.message || "Vui lòng thử lại."
          }`
        );
      }
    }

    setUploadStatus({
      stage: "finished",
      progress: 100,
      message: "Đã lưu thành công.",
    });

    setTimeout(() => {
      setUploadStatus(null);
    }, 2000);

  } finally {
    setIsUploading(false);
    event.target.value = "";
  }
}

async function deleteFile(fileToDelete) {
  const ok = window.confirm(`Xóa "${fileToDelete.name}"?`);

  if (!ok) return;

  const { error } = await supabase.storage
    .from("memories")
    .remove([fileToDelete.path]);

  if (error) {
    alert(error.message);
    console.error(error);
    return;
  }

  setFiles((current) =>
    current.filter((file) => file.path !== fileToDelete.path)
  );
}
async function loadFiles(folder) {
  if (!folder) return;

  const { data, error } = await supabase.storage
    .from("memories")
    .list(folder, {
      limit: 100,
      sortBy: {
        column: "created_at",
        order: "desc",
      },
    });

  if (error) {
    console.error(error);
    alert(`Không thể tải kho ký ức: ${error.message}`);
    return;
  }

  const validItems = data.filter((item) => item.id);
  const allNames = new Set(validItems.map((item) => item.name));

  const loadedFiles = validItems
    // Không hiện thumbnail thành một ô riêng
    .filter(
      (item) =>
        !item.name.startsWith("thumb-") &&
        !item.name.startsWith("thumb-video-")
    )
    .map((item) => {
      const path = `${folder}/${item.name}`;

      const { data: urlData } = supabase.storage
        .from("memories")
        .getPublicUrl(path);

      const type = item.metadata?.mimetype || "";
      let thumbnail = null;

      const imageThumbName = `thumb-${item.name}.webp`;
      const videoThumbName = `thumb-video-${item.name}.webp`;

      let matchingThumbName = null;

      if (type.startsWith("image/") && allNames.has(imageThumbName)) {
        matchingThumbName = imageThumbName;
      }

      if (type.startsWith("video/") && allNames.has(videoThumbName)) {
        matchingThumbName = videoThumbName;
      }

      if (matchingThumbName) {
        const { data: thumbUrlData } = supabase.storage
          .from("memories")
          .getPublicUrl(`${folder}/${matchingThumbName}`);

        thumbnail = thumbUrlData.publicUrl;
      }

      return {
        name: item.name,
        type,
        url: urlData.publicUrl,
        thumbnail,
        path,
      };
    });

  setFiles(loadedFiles);
}
  const cardStyle = {
    background: "white",
    padding: "40px",
    borderRadius: "20px",
    width: "min(500px, 85vw)",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
  };

  const inputStyle = {
    width: "100%",
    padding: "14px",
    marginTop: "12px",
    boxSizing: "border-box",
    borderRadius: "10px",
    border: "1px solid #ccc",
    fontSize: "16px",
  };

  const buttonStyle = {
    background: "#5b5cff",
    color: "white",
    border: "none",
    padding: "15px 28px",
    marginTop: "20px",
    borderRadius: "12px",
    fontSize: "16px",
    cursor: "pointer",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f6fa",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
        padding: "20px",
      }}
    >
      {screen === "home" && (
        <div style={cardStyle}>
          <h1 style={{ fontSize: "44px", marginBottom: "8px" }}>
            EverMoment
          </h1>

          <p style={{ color: "#666" }}>
            Lưu giữ những khoảnh khắc quý giá nhất.
          </p>

          <button style={buttonStyle} onClick={openMemory}>
            MỞ KHO KÝ ỨC 
          </button>

          <div
            style={{
              marginTop: "40px",
              textAlign: "left",
              lineHeight: "36px",
            }}
          >
            <div>🔒 Bảo mật bằng mật khẩu</div>
            <div>🖼️ Lưu ảnh và video</div>
            <div>📱 Truy cập bằng QR</div>
          </div>
        </div>
      )}

      {screen === "create-password" && (
        <div style={cardStyle}>
          <h2>Thiết lập kho ký ức</h2>

          <p style={{ color: "#666" }}>
            Đây là lần truy cập đầu tiên. Hãy tạo mật khẩu riêng.
          </p>
<input
  type="text"
  placeholder="Nhập mã kho (VD: EV0001)"
  value={customerCode}
  onChange={(e) => setCustomerCode(e.target.value)}
  style={inputStyle}
/>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Tạo mật khẩu"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={inputStyle}
          />
<div style={{ position: "relative", width: "100%" }}>
          <input
           type={showPassword ? "text" : "password"}
            placeholder="Nhập lại mật khẩu"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            style={{
  ...inputStyle,
  width: "100%",
  paddingRight: "50px",
  boxSizing: "border-box",
}}
          />
          <button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  style={{
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "20px",
    padding: "4px",
  }}
>
  {showPassword ? "🙈" : "👁️"}
</button>
</div>

          <button style={buttonStyle} onClick={createPassword}>
            TẠO KHO KÝ ỨC
          </button>
        </div>
      )}

      {screen === "login" && (
        <div style={cardStyle}>
          <h2>Kho ký ức riêng tư</h2>

          <p style={{ color: "#666" }}>
            Nhập mật khẩu để mở kho ký ức.
          </p>
<input
  type="text"
  placeholder="Nhập mã kho (VD: EV0001)"
  value={customerCode}
  onChange={(event) => setCustomerCode(event.target.value)}
  style={inputStyle}
/>
          <div style={{ position: "relative", width: "100%" }}>
  <input
    type={showPassword ? "text" : "password"}
    placeholder="Nhập mật khẩu"
    value={loginPassword}
    onChange={(event) => setLoginPassword(event.target.value)}
    style={{
      ...inputStyle,
      width: "100%",
      paddingRight: "50px",
      boxSizing: "border-box",
    }}
  />

  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    style={{
      position: "absolute",
      right: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: "20px",
      padding: "4px",
    }}
    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
  >
    {showPassword ? "🙈" : "👁"}
  </button>
</div>
          <button style={buttonStyle} onClick={login}>
            MỞ KHO
          </button>
        </div>
      )}

      {screen === "memory" && (
        <div
  style={{
    ...cardStyle,
    width: "calc(100vw - 32px)",
    maxWidth: "1400px",
  }}
>
          <h2>Kho ký ức của bạn</h2>
          {uploadStatus && (
  <div
    style={{
      margin: "18px 0",
      padding: "16px",
      borderRadius: "12px",
      background: "#eef3ff",
      border: "1px solid #c8d6ff",
    }}
  >
    <div
      style={{
        fontWeight: "bold",
        marginBottom: "8px",
      }}
    >
      {uploadStatus.message}
    </div>

    {uploadStatus.fileName && (
      <div
        style={{
          fontSize: 13,
          color: "#666",
          marginBottom: "10px",
        }}
      >
        {uploadStatus.fileName}
      </div>
    )}

    <div
      style={{
        width: "100%",
        height: "10px",
        background: "#ddd",
        borderRadius: "999px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${
            uploadStatus.progress ?? 100
          }%`,
          height: "100%",
          background: "#5b6cff",
          transition: "0.3s",
        }}
      />
    </div>

    {typeof uploadStatus.progress === "number" && (
      <div
        style={{
          marginTop: "6px",
          fontSize: "13px",
          textAlign: "right",
        }}
      >
        {uploadStatus.progress}%
      </div>
    )}
  </div>
)}
<div
  style={{
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    marginTop: "18px",
    marginBottom: "4px",
  }}
>
  <button
    type="button"
    onClick={() => {
      setMediaFilter("all");
      setSelectedImageIndex(null);
    }}
    style={{
      padding: "10px 18px",
      borderRadius: "999px",
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      background:
        mediaFilter === "all" ? "#5b5cff" : "#ececf3",
      color:
        mediaFilter === "all" ? "white" : "#444",
    }}
  >
    Tất cả
  </button>

  <button
    type="button"
    onClick={() => {
      setMediaFilter("image");
      setSelectedImageIndex(null);
    }}
    style={{
      padding: "10px 18px",
      borderRadius: "999px",
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      background:
        mediaFilter === "image" ? "#5b5cff" : "#ececf3",
      color:
        mediaFilter === "image" ? "white" : "#444",
    }}
  >
    Ảnh
  </button>

  <button
    type="button"
    onClick={() => {
      setMediaFilter("video");
      setSelectedImageIndex(null);
    }}
    style={{
      padding: "10px 18px",
      borderRadius: "999px",
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      background:
        mediaFilter === "video" ? "#5b5cff" : "#ececf3",
      color:
        mediaFilter === "video" ? "white" : "#444",
    }}
  >
    Video
  </button>
</div>
          <label
            style={{
              ...buttonStyle,
              display: "inline-block",
            }}
          >
            {isUploading
           ? "⏳ ĐANG XỬ LÝ..."
           : "+ TẢI ẢNH HOẶC VIDEO"}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={uploadFiles}
              disabled={isUploading}
              style={{ display: "none" }}
            />
          </label>

          <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "4px",
    marginTop: "30px",
  }}
>
            {filteredMediaFiles.map((file, index) => (
              <div key={`${file.name}-${index}`}>
                {file.type.startsWith("image/") ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    onClick={() => {
  const mediaIndex = filteredMediaFiles.findIndex(
    (mediaFile) => mediaFile.name === file.name
  );

  setSelectedImageIndex(mediaIndex);
}}
                    style={{
  width: "100%",
  aspectRatio: "1 / 1",
  height: "auto",
  objectFit: "cover",
  borderRadius: "4px",
  cursor: "pointer",
}}
                  />
                ) : (
                  <div
  onClick={() => {
    const mediaIndex = filteredMediaFiles.findIndex(
      (mediaFile) => mediaFile.name === file.name
    );

    setSelectedImageIndex(mediaIndex);
  }}
  style={{
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    borderRadius: "4px",
    cursor: "pointer",
  }}
>
{file.thumbnail ? (
  <img
    src={file.thumbnail}
    alt={file.name}
    loading="lazy"
    style={{
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      pointerEvents: "none",
    }}
  />
) : (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: "#222",
    }}
  />
)}

<div
  style={{
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.12)",
    color: "white",
    fontSize: "30px",
    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
    pointerEvents: "none",
  }}
>
  {file.type?.startsWith("video") ? "▶" : ""}
</div>
</div>
                )}

                
 
              </div>
            ))}
          </div>
        </div>
      )}
      <GalleryViewer
  media={filteredMediaFiles}
  selectedIndex={selectedImageIndex}
  setSelectedIndex={setSelectedImageIndex}
  onClose={() => setSelectedImageIndex(null)}
  onDelete={deleteFile}
/>
    </main>
  );
}

export default App;