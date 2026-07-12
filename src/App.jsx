import { useEffect, useState } from "react";
import { supabase } from "./supabase";
function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [screen, setScreen] = useState("home");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [files, setFiles] = useState([]);
const [customerCode, setCustomerCode] = useState("");
const [customerName, setCustomerName] = useState("");
const [folderName, setFolderName] = useState("");
useEffect(() => {
  if (screen === "memory" && folderName) {
    loadFiles(folderName);
  }
}, [screen, folderName]);

  const savedPassword = localStorage.getItem("evermoment-password");
const savedFolder = localStorage.getItem("folderName");
  function openMemory() {
    if (savedPassword) {

        if (savedFolder) {
            setFolderName(savedFolder);
        }

        setScreen("login");
    } else {
        setScreen("create-password");
    }
}

  function createPassword() {
    if (password.length < 6) {
      alert("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Hai mật khẩu không giống nhau.");
      return;
    }

    localStorage.setItem("evermoment-password", password);
    setScreen("memory");
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
  const selectedFiles = Array.from(event.target.files);

  for (const file of selectedFiles) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

const fileName = `${folderName}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from("memories")
      .upload(fileName, file);

    if (error) {
      console.error(error);
      alert(error.message);
      continue;
    }

    const { data } = supabase.storage
      .from("memories")
      .getPublicUrl(fileName);
console.log(data.publicUrl);
    setFiles((current) => [
      ...current,
      {
        name: file.name,
        type: file.type,
        url: data.publicUrl,
        path: fileName,
      },
    ]);
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

  const loadedFiles = data
    .filter((item) => item.id)
    .map((item) => {
      const path = `${folder}/${item.name}`;

      const { data: urlData } = supabase.storage
        .from("memories")
        .getPublicUrl(path);

      return {
        name: item.name,
        type: item.metadata?.mimetype || "",
        url: urlData.publicUrl,
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

          <input
            type="password"
            placeholder="Nhập lại mật khẩu"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            style={inputStyle}
          />

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
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Nhập mật khẩu"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            style={inputStyle}
          />
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
>
  {showPassword ? "🙈 Ẩn mật khẩu" : "👁 Hiện mật khẩu"}
</button>
          <button style={buttonStyle} onClick={login}>
            MỞ KHO
          </button>
        </div>
      )}

      {screen === "memory" && (
        <div style={{ ...cardStyle, width: "min(750px, 90vw)" }}>
          <h2>Kho ký ức của bạn</h2>

          <label
            style={{
              ...buttonStyle,
              display: "inline-block",
            }}
          >
            + TẢI ẢNH HOẶC VIDEO
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={uploadFiles}
              style={{ display: "none" }}
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "15px",
              marginTop: "30px",
            }}
          >
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`}>
                {file.type.startsWith("image/") ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    style={{
                      width: "100%",
                      height: "180px",
                      objectFit: "cover",
                      borderRadius: "12px",
                    }}
                  />
                ) : (
                  <video
                    src={file.url}
                    controls
                    style={{
                      width: "100%",
                      height: "180px",
                      borderRadius: "12px",
                    }}
                  />
                )}

                <p style={{ fontSize: "13px" }}>{file.name}</p>
                <button
  type="button"
  onClick={() => deleteFile(file)}
  style={{
    border: "none",
    background: "#dc3545",
    color: "white",
    padding: "6px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    marginTop: "6px",
  }}
>
  XÓA
</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export default App;