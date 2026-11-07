import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabase";
import GalleryViewer from "./GalleryViewer";
import { uploadFile } from "./services/uploadService";
import Home from "./pages/Home/Home";
import Journey from "./pages/Home/Journey/Journey";
import Onboarding from "./pages/Home/Onboarding/Onboarding";
function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [screen, setScreen] = useState("onboarding");
  const [authUser, setAuthUser] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [files, setFiles] = useState([]);
 const [journeyMomentsById, setJourneyMomentsById] = useState({});
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [sharedJourneyContext, setSharedJourneyContext] = useState(null);
  const [sharedJourneyMoments, setSharedJourneyMoments] = useState([]);
  const [sharedJourneyLoading, setSharedJourneyLoading] = useState(false);
  const [sharedJourneyError, setSharedJourneyError] = useState("");
  const [returnHousehold, setReturnHousehold] = useState(null);

  async function openSharedJourney(journey, household) {
    if (!journey?.journey_id || !household?.id) return;
    setSharedJourneyContext({ householdId: household.id });
    setReturnHousehold(household);
    setSharedJourneyMoments([]);
    setSharedJourneyError("");
    setSharedJourneyLoading(true);
    setSelectedJourney({
      ...journey,
      id: journey.journey_id,
      subtitle: journey.description || "Hành trình của Nhà",
    });
    setScreen("journey");
    const { data, error } = await supabase
      .from("journey_moments")
      .select("moment_data")
      .eq("journey_id", journey.journey_id);
    if (error) {
      console.error("Không tải được khoảnh khắc Nhà:", error);
      setSharedJourneyError(error.message);
    } else {
      setSharedJourneyMoments((data || []).map(row => row.moment_data).filter(Boolean));
    }
    setSharedJourneyLoading(false);
  }

  const [journeys, setJourneys] = useState({});
const createJourney = async (title, description) => {
  const customerId = localStorage.getItem("customerId");

  if (!customerId) {
    alert("Không xác định được kho đang đăng nhập.");
    return;
  }

  const id = `journey-${Date.now()}`;

  const newJourney = {
    id,
    title,
    subtitle: description || "Hành trình mới",
    icon: "✨",
    description: description || "Những khoảnh khắc của hành trình này.",
  };

  const { error } = await supabase.functions.invoke("save-journey", {
    body: {
      customerId,
      journeyId: id,
      title,
      description: description || "",
    },
  });

  if (error) {
    console.error("Không lưu được hành trình:", error);
    alert("Không lưu được hành trình. Vui lòng thử lại.");
    return;
  }

  setJourneys((current) => ({
    ...current,
    [id]: newJourney,
  }));
  setSelectedJourney(id);
};
const deleteJourney = async (journeyId) => {
  const customerId = localStorage.getItem("customerId");

  if (!customerId || !journeyId) {
    alert("Không xác định được hành trình cần xóa.");
    return;
  }

  const { data, error } = await supabase.functions.invoke(
    "delete-journey",
    {
      body: {
        customerId,
        journeyId,
      },
    }
  );

  if (error) {
    console.error("Không xóa được hành trình:", error);
    alert("Không xóa được hành trình. Vui lòng thử lại.");
    return;
  }

  if (!data?.success) {
    console.error("Xóa hành trình thất bại:", data);
    alert(data?.error || "Không xóa được hành trình.");
    return;
  }

  setJourneys((current) => {
    const next = { ...current };
    delete next[journeyId];
    return next;
  });

  if (selectedJourney?.id === journeyId) {
    setSelectedJourney(null);
  }
};
const updateJourney = async (
  journeyId,
  title,
  description,
  imageFile
) => {
  const customerId = localStorage.getItem("customerId");

  if (!customerId) {
    alert("Không xác định được kho đang đăng nhập.");
    return false;
  }
  let journeyImage = null;

if (imageFile) {
  try {
    const uploadedImage = await uploadFile(imageFile, customerId);
journeyImage = uploadedImage.url;
  } catch (error) {
    console.error("Không tải được ảnh hành trình:", error);
    alert("Không tải được ảnh đại diện. Vui lòng thử lại.");
    return false;
  }
}

  const { data, error } = await supabase.functions.invoke(
    "update-journey",
    {
      body: {
        customerId,
        journeyId,
        title,
        description,
        journeyImage,
      },
    }
  );

  if (error) {
    console.error("Không cập nhật được hành trình:", error);
    alert("Không cập nhật được hành trình. Vui lòng thử lại.");
    return false;
  }

  if (!data?.success) {
    console.error("Cập nhật hành trình thất bại:", data);
    alert(data?.error || "Không cập nhật được hành trình.");
    return false;
  }

 setJourneys((current) => ({
  ...current,
  [journeyId]: {
    ...current[journeyId],
    title,
    subtitle: description || "Hành trình mới",
    description: description || "",
    image_url: journeyImage || current[journeyId]?.image_url || null,
  },
}));

setSelectedJourney((current) =>
  current?.id === journeyId
    ? {
        ...current,
        title,
        subtitle: description || "Hành trình mới",
        description: description || "",
        image_url: journeyImage || current.image_url || null,
      }
    : current
);
};
  const [uploadStatus, setUploadStatus] = useState(null);
const [isUploading, setIsUploading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [journeyViewerFiles, setJourneyViewerFiles] = useState([]);
const [journeyViewerIndex, setJourneyViewerIndex] = useState(null);
  const [mediaFilter, setMediaFilter] = useState("all");
  const fileInputRef = useRef(null);
  const openImagePicker = () => {
  if (!fileInputRef.current) return;

  fileInputRef.current.accept = "image/*";
  fileInputRef.current.click();
};
const openVideoPicker = () => {
  if (!fileInputRef.current) return;

  fileInputRef.current.accept = "video/*";
  fileInputRef.current.click();
};

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
  async function routeAuthenticatedUser(user) {
  if (!user) return;

  let { data: customer, error } = await supabase
    .from("customers")
    .select("id, customer_code, customer_name, folder_name")
    .eq("auth_user_id", user.id)
    .order("created_at", { ascending: true })
.limit(1)
.maybeSingle();

  if (error) {
    console.error("Không tìm được kho của tài khoản Google:", error);
    return;
  }

  if (!customer) {
  const { data: newCustomer, error: createError } = await supabase
    .from("customers")
    .insert({
      auth_user_id: user.id,
      customer_name:
        user.user_metadata?.full_name ||
        user.email ||
        "Người dùng EverMoment",
      folder_name: user.id,
    })
    .select("id, customer_code, customer_name, folder_name")
    .single();

  if (createError) {
    console.error("Không thể tạo kho cho tài khoản mới:", createError);
    return;
  }

  customer = newCustomer;
}

  // Nối tài khoản Google với hệ thống kho cũ
  setCustomerCode(customer.customer_code);
  setCustomerName(customer.customer_name);
  setFolderName(customer.folder_name);

  localStorage.setItem("customerId", customer.id);
  localStorage.setItem("folderName", customer.folder_name);

  // Khôi phục dữ liệu của kho cũ
  await loadJourneys(customer.id);
  await loadJourneyMoments(customer.id);

  setScreen("dashboard");
}
  supabase.auth.getSession().then(({ data: { session } }) => {
    const user = session?.user ?? null;
    console.log("GET SESSION:", session);
console.log("GET SESSION USER:", user);
    setAuthUser(user);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    setAuthUser(user);

    if (user) {
  routeAuthenticatedUser(user);
}
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);
useEffect(() => {
  if ((screen === "memory" || screen === "dashboard") && folderName) {
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
setScreen("dashboard");
  } catch (error) {
    console.error(error);
    alert("Không thể kết nối máy chủ. Vui lòng thử lại.");
  }
}
async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: {
  prompt: "select_account",
},
    },
  });

  if (error) {
    console.error("Google login error:", error);
    alert("Không thể đăng nhập bằng Google. Vui lòng thử lại.");
  }
}
async function logoutGoogle() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Logout error:", error);
    alert("Không thể đăng xuất. Vui lòng thử lại.");
    return;
  }

  setAuthUser(null);
  setScreen("login");
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
    localStorage.setItem("customerId", data.customer.id);

setFolderName(data.customer.folderName);

localStorage.setItem("folderName", data.customer.folderName);
await loadJourneys(data.customer.id);
await loadJourneyMoments(data.customer.id);
setScreen("dashboard");
  } catch (error) {
    console.error(error);
    alert("Không thể kết nối máy chủ. Vui lòng thử lại.");
  }
}
async function loadJourneys(customerId) {
  if (!customerId) return;

  const { data, error } = await supabase.functions.invoke(
    "load-journeys",
    {
      body: {
        customerId,
      },
    }
  );

  if (error) {
    console.error("Không tải được danh sách hành trình:", error);
    return;
  }

  if (!data?.success) {
    console.error(
      "Không tải được danh sách hành trình:",
      data?.error
    );
    return;
  }

  const loadedJourneys = {};

  (data.journeys || []).forEach((journey) => {
  loadedJourneys[journey.journey_id] = {
    id: journey.journey_id,
    title: journey.title,
    subtitle: journey.description || "Hành trình mới",
    description:
      journey.description ||
      "Những khoảnh khắc của hành trình này.",
    icon: "✨",
    image_url: journey.image_url || null,
  };
});

  setJourneys((current) => ({
    ...current,
    ...loadedJourneys,
  }));
}
async function loadJourneyMoments(customerId) {
  if (!customerId) return false;

  const { data, error } = await supabase.functions.invoke(
    "load-journey-moments",
    {
      body: {
        customerId,
      },
    }
  );

  if (error) {
    console.error("Không tải được khoảnh khắc:", error);
    return false;
  }

  if (!data?.success) {
    console.error(
      "Không tải được khoảnh khắc:",
      data?.error
    );
    return false;
  }

  const loadedMoments = {};

  (data.moments || []).forEach((row) => {
    const journeyId = row.journey_id;

    if (!loadedMoments[journeyId]) {
      loadedMoments[journeyId] = [];
    }

    if (row.moment_data) {
      loadedMoments[journeyId].push(row.moment_data);
    }
  });

  setJourneyMomentsById(loadedMoments);
  return true;
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
        created_at: item.created_at,
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
          <button
  type="button"
  onClick={loginWithGoogle}
  style={buttonStyle}
>
  G&nbsp;&nbsp; Tiếp tục với Google
</button>

<div style={{ margin: "18px 0", color: "#888" }}>
  hoặc
</div>
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
      <input
  ref={fileInputRef}
  type="file"
  accept="image/*,video/*"
  multiple
  onChange={uploadFiles}
  disabled={isUploading}
  style={{ display: "none" }}
/>
{screen === "onboarding" && (
  <Onboarding
    user={authUser}
    onComplete={() => setScreen("dashboard")}
  />
)}
{console.log("APP AUTH USER:", authUser)}
      {screen === "dashboard" && (
  <Home
  customerId={localStorage.getItem("customerId")}
  authUser={authUser}
customerCode={customerCode}
  onLogout={logoutGoogle}
  files={mediaFiles}
  journeys={journeys}
  journeyMomentsById={journeyMomentsById}
  onOpenMemory={() => setScreen("memory")}
  onOpenJourney={() => setScreen("journey")}
  onSelectJourney={(id) => setSelectedJourney(journeys[id])}
  initialOpenedHousehold={returnHousehold}
  onOpenSharedJourney={openSharedJourney}
  onCreateJourney={createJourney}
  onDeleteJourney={deleteJourney}
  onUpdateJourney={updateJourney}
  onPickImage={openImagePicker}
  onPickVideo={openVideoPicker}
  onOpenFile={(file) => {
  const index = mediaFiles.findIndex(
    (item) => item.path === file.path
  );

  if (index === -1) return;

  setJourneyViewerFiles(mediaFiles);
  setJourneyViewerIndex(index);
}}
/>
)}
{screen === "journey" && (
  <Journey
  selectedJourney={selectedJourney}
    allFiles={sharedJourneyContext ? [] : mediaFiles}
    readOnly={Boolean(sharedJourneyContext)}
    momentsLoading={sharedJourneyContext ? sharedJourneyLoading : false}
    momentsError={sharedJourneyContext ? sharedJourneyError : ""}
    onOpenFile={(file, momentFiles) => {
  const index = momentFiles.findIndex(
    (item) => item.path === file.path
  );

  if (index === -1) return;

  setJourneyViewerFiles(momentFiles);
  setJourneyViewerIndex(index);
}}
    journeyMoments={
  sharedJourneyContext ? sharedJourneyMoments : (journeyMomentsById[selectedJourney?.id] || [])
}
setJourneyMoments={(updater) => {
  if (!selectedJourney?.id) return;

  setJourneyMomentsById((prev) => {
    const currentMoments =
      prev[selectedJourney.id] || [];

    const newMoments =
      typeof updater === "function"
        ? updater(currentMoments)
        : updater;

    return {
      ...prev,
      [selectedJourney.id]: newMoments,
    };
  });
}}
    onBack={() => {
      setScreen("dashboard");
      setSharedJourneyContext(null);
    }}
  />
)}
      {screen === "memory" && (
        <div
  style={{
    ...cardStyle,
    width: "calc(100vw - 32px)",
    maxWidth: "1400px",
  }}
>
          <div style={{ position: "relative" }}>
  <button
    type="button"
    onClick={() => setScreen("dashboard")}
    style={{
      position: "absolute",
      left: "0",
      top: "50%",
      transform: "translateY(-50%)",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: "16px",
    }}
  >
    ← Trang chủ
  </button>

  <h2>Kho ký ức của bạn</h2>
</div>
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
      {journeyViewerIndex !== null && (
  <GalleryViewer
    media={journeyViewerFiles}
    selectedIndex={journeyViewerIndex}
    setSelectedIndex={setJourneyViewerIndex}
    onClose={() => {
      setJourneyViewerIndex(null);
      setJourneyViewerFiles([]);
    }}
  />
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