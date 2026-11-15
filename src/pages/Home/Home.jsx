import { useState, useEffect } from "react";
import "./Home.css";
import { supabase } from "../../supabase";
import HouseholdSpace from "./HouseholdSpace/HouseholdSpace";
export default function Home({
  onOpenSharedJourney,
  initialOpenedHousehold = null,
    customerId,
    authUser,
  customerCode,
  files = [],
  journeys = {},
  journeyMomentsById = {},
  onLogout,
  onOpenMemory,
 onOpenJourney,
onSelectJourney,
  onOpenFile,
  onPickImage,
onPickVideo,
onCreateJourney,
onDeleteJourney,
onUpdateJourney,
}) {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const recentFiles = files.slice(0, 3);
  const today = new Date();

const lookbackFiles = files.filter((file) => {
  if (!file.created_at) return false;

  const fileDate = new Date(file.created_at);

  return (
    fileDate.getDate() === today.getDate() &&
    fileDate.getMonth() === today.getMonth() &&
    fileDate.getFullYear() === today.getFullYear() - 1
  );
});

const lookbackDate =
  lookbackFiles.length > 0
    ? new Date(lookbackFiles[0].created_at)
    : null;
  const [showCreateJourney, setShowCreateJourney] = useState(false);
  const [editingJourneyId, setEditingJourneyId] = useState(null);
const [editJourneyTitle, setEditJourneyTitle] = useState("");
const [editJourneyDescription, setEditJourneyDescription] = useState("");
const [editJourneyImage, setEditJourneyImage] = useState(null);
  const [newJourneyTitle, setNewJourneyTitle] = useState("");
const [newJourneyDescription, setNewJourneyDescription] = useState("");
const [openJourneyMenuId, setOpenJourneyMenuId] = useState(null);
const [household, setHousehold] = useState(null);
const [receivedJourneys, setReceivedJourneys] = useState([]);
const [receivedError, setReceivedError] = useState("");
useEffect(() => {
  if (!household?.id || household.created_by !== authUser?.id) {
    setReceivedJourneys([]);
    setReceivedError("");
    return;
  }
  let active = true;
  async function refresh() {
    const { data: links, error: linkError } = await supabase.from("household_journeys")
      .select("journey_row_id").eq("household_id", household.id);
    if (!active) return;
    if (linkError) { setReceivedError(linkError.message); return; }
    const ids = [...new Set((links || []).map(row => row.journey_row_id))];
    if (!ids.length) { setReceivedJourneys([]); setReceivedError(""); return; }
    const { data, error } = await supabase.from("journeys")
      .select("id, journey_id, customer_id, household_id, title, description, image_url, created_at")
      .in("id", ids);
    if (!active) return;
    if (error) { setReceivedError(error.message); return; }
    setReceivedJourneys((data || []).filter(row =>
      row.household_id !== household.id && row.customer_id !== customerId
    ));
    setReceivedError("");
  }
  refresh();
  const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    active = false;
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", onVisible);
  };
}, [household?.id, household?.created_by, authUser?.id, customerId]);

const [isRenamingHousehold, setIsRenamingHousehold] = useState(false);
const [newHouseholdName, setNewHouseholdName] = useState("");
const [joinedHouseholds, setJoinedHouseholds] = useState([]);
const [householdRefreshKey, setHouseholdRefreshKey] = useState(0);
const [openedHousehold, setOpenedHousehold] = useState(initialOpenedHousehold);
const [openedHouseholdTab, setOpenedHouseholdTab] = useState("home");
const [familyActivities, setFamilyActivities] = useState([]);
const [familyActivityError, setFamilyActivityError] = useState("");
const [showJoinedHouseholds, setShowJoinedHouseholds] = useState(false);
useEffect(() => {
  if (!authUser?.id || (!household?.id && joinedHouseholds.length === 0)) { setFamilyActivities([]); return; }
  let alive = true;
  async function refreshFamilyActivity() {
    const houses = [household, ...joinedHouseholds.map(item => item.households)]
      .filter(item => item?.id);
    const uniqueHouses = [...new Map(houses.map(item => [item.id, item])).values()];
    if (!uniqueHouses.length) return;
    const { data, error } = await supabase.from("household_family_posts")
      .select("id,household_id,author_id,kind,body,created_at")
      .in("household_id", uniqueHouses.map(item => item.id))
      .order("created_at", { ascending: false }).limit(30);
    if (!alive) return;
    if (error) { setFamilyActivityError(error.message); return; }
    const authorIds = [...new Set((data || []).map(item => item.author_id))];
    let ownerNames = {};
    if (authorIds.length) {
      const { data: ownedHouses } = await supabase.from("households")
        .select("created_by,name").in("created_by", authorIds);
      ownerNames = Object.fromEntries((ownedHouses || []).map(item => [item.created_by, item.name]));
    }
    if (!alive) return;
    setFamilyActivities((data || []).map(item => ({
      ...item, house: uniqueHouses.find(h => h.id === item.household_id),
      authorName: ownerNames[item.author_id] || "Thành viên Nhà",
    })));
    setFamilyActivityError("");
  }
  refreshFamilyActivity();
  const onFocus = () => refreshFamilyActivity();
  window.addEventListener("focus", onFocus);
  return () => { alive = false; window.removeEventListener("focus", onFocus); };
}, [authUser?.id, household?.id, joinedHouseholds]);

const [householdMembers, setHouseholdMembers] = useState([]);
const [selectedMember, setSelectedMember] = useState(null);
const [showOwnerMembers, setShowOwnerMembers] = useState(false);
const [memberActionBusy, setMemberActionBusy] = useState(false);
const [memberActionError, setMemberActionError] = useState("");
async function removeHouseMember(member) {
  if (!household?.id || household.created_by !== currentUser?.id || member.user_id === currentUser.id || memberActionBusy) return;
  if (!window.confirm("Xóa thành viên khỏi Nhà? Mọi Hành trình người này đã chia sẻ vào Nhà sẽ bị thu hồi. Ảnh/video và Hành trình gốc vẫn được giữ nguyên.")) return;
  setMemberActionBusy(true);
  setMemberActionError("");
  const { error } = await supabase.rpc("remove_household_member_and_shares", {
    p_household_id: household.id,
    p_member_user_id: member.user_id,
  });
  if (error) {
    setMemberActionError("Không thể xóa thành viên: " + error.message);
  } else {
    setSelectedMember(null);
    setHouseholdRefreshKey(value => value + 1);
  }
  setMemberActionBusy(false);
}
const [currentUser, setCurrentUser] = useState(null);
const [customerHouseholds, setCustomerHouseholds] = useState([]);
const [joinHouseCode, setJoinHouseCode] = useState("");
const activeCustomerHousehold =
  customerHouseholds.length > 0
    ? customerHouseholds[0].customer_households
    : null;
useEffect(() => {
  async function loadCustomerHouseholds() {
    console.log("DEBUG ID:", {
  customerId,
  authUserId: authUser?.id,
  authUserEmail: authUser?.email,
});
    if (!customerId) {
      setCustomerHouseholds([]);
      return;
    }

    const { data, error } = await supabase
      .from("customer_household_members")
      .select(`
        role,
        household_id,
        customer_households (
          id,
          name,
          owner_customer_id
        )
      `)
      .eq("customer_id", customerId);

    if (error) {
      console.error("Load customer households error:", error);
      return;
    }

    setCustomerHouseholds(data || []);
    console.log("CUSTOMER HOUSEHOLDS:", data);
  }

  loadCustomerHouseholds();
}, [customerId]);
async function joinCustomerHousehold(inviteCode) {
  const code = (inviteCode || joinHouseCode).trim();
  if (!customerId) {
    alert("Không xác định được kho đang đăng nhập.");
    return;
  }

  if (!code) {
    alert("Hãy nhập mã mời.");
    return;
  }

  const { data, error } = await supabase.rpc(
    "join_customer_household_by_invite",
    {
      p_customer_id: customerId,
      p_invite_code: code,
    }
  );

  if (error) {
    console.error("Join household error:", error);
    alert("Mã mời không đúng hoặc không thể tham gia Nhà.");
    return;
  }

  console.log("JOINED HOUSEHOLD:", data);
  alert("Đã tham gia Nhà thành công.");
  setJoinHouseCode("");
}
useEffect(() => {
  async function loadHousehold() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;
setCurrentUser(user);
    // The house owner is recorded in households.created_by. Do not assume
    // there is also a separate owner row in household_members.
    const { data: house, error: houseError } = await supabase
      .from("households")
      .select("*")
      .eq("created_by", user.id)
      .limit(1)
      .maybeSingle();

    if (houseError) {
      console.error("Load owned household error:", houseError);
      return;
    }

    setHousehold(house || null);
    // Lấy danh sách tất cả Nhà mà tài khoản đã tham gia
// Fetch memberships and houses separately: no unverified FK relationship needed.
const { data: joinedMemberships, error: joinedError } = await supabase
  .from("household_members")
  .select("household_id, role")
  .eq("user_id", user.id)
  .eq("role", "member");

if (joinedError) {
  console.error("Load joined households error:", joinedError);
  setJoinedHouseholds([]);
} else {
  const ids = [...new Set((joinedMemberships || [])
    .map(row => row.household_id)
    .filter(id => id && id !== house?.id))];
  if (!ids.length) {
    setJoinedHouseholds([]);
  } else {
    const { data: houses, error: housesError } = await supabase
      .from("households")
      .select("id, name, created_by")
      .in("id", ids);
    if (housesError) {
      console.error("Load joined house details error:", housesError);
      setJoinedHouseholds([]);
    } else {
      const byId = new Map((houses || []).map(h => [h.id, h]));
      setJoinedHouseholds(ids.filter(id => byId.has(id)).map(id => ({
        household_id: id,
        role: "member",
        households: byId.get(id),
      })));
    }
  }
}
    if (!house) { setHouseholdMembers([]); return; }
    const { data: members, error: membersError } = await supabase
  .from("household_members")
  .select("user_id, role")
  .eq("household_id", house.id);

if (membersError) {
  console.error("Load household members error:", membersError);
  return;
}

const visibleMembers = (members || []).filter(member => member.user_id !== house.created_by);
const { data: names, error: namesError } = await supabase.rpc("get_household_member_names", { p_household_id: house.id });
if (namesError) console.warn("Member display names unavailable:", namesError.message);
const nameMap = new Map((names || []).map(row => [row.user_id, row.display_name]));
setHouseholdMembers(visibleMembers.map(member => ({
  ...member,
  display_name: nameMap.get(member.user_id) || "Chưa có tên hiển thị",
})));
console.log("DANH SÁCH THÀNH VIÊN:", members);
  }

  loadHousehold();
}, [householdRefreshKey]);
async function createHouseholdInvite() {
  if (!household?.id) {
    alert("Chưa tìm thấy Nhà của bạn.");
    return;
  }
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  alert("Bạn cần đăng nhập trước.");
  return;
}
  const inviteCode = crypto.randomUUID();

  const { data, error } = await supabase
    .from("household_invites")
    .insert({
      household_id: household.id,
      created_by: user.id,
      invite_code: inviteCode,
    })
    .select("invite_code, expires_at")
    .single();

  if (error) {
    console.error("Create invite error:", error);
    alert("Không thể tạo lời mời.");
    return;
  }

  console.log("INVITE CREATED:", data);
  alert(`Mã mời: ${data.invite_code}`);
}
if (openedHousehold) {
  return (
    <HouseholdSpace
      household={openedHousehold}
      onBack={(refresh) => { setOpenedHouseholdTab("home"); setOpenedHousehold(null); if (refresh) setHouseholdRefreshKey(value => value + 1); }}
      onOpenJourney={(journey) => onOpenSharedJourney?.(journey, openedHousehold)}
      onSelectJourney={onSelectJourney}
    />
  );
}
  return (
    <main className="home-page">
      <header className="home-header">
        <div className="brand">EverMoment</div>

        <div className="header-actions">
  <div style={{ fontSize: "11px", textAlign: "right", maxWidth: "170px" }}>
    <strong style={{ display: "block" }}>
      {currentUser?.user_metadata?.full_name || "Tài khoản"}
    </strong>

    <span style={{ display: "block", wordBreak: "break-all" }}>
      {currentUser?.email || ""}
    </span>
  </div>

  <button className="icon-button" aria-label="Thông báo">
    🔔
  </button>

  <button
    className="avatar"
    onClick={() => setShowAccountMenu(!showAccountMenu)}
    title="Tài khoản"
    type="button"
  >
    <span>
      {(currentUser?.email || "S").charAt(0).toUpperCase()}
    </span>
  </button>
  {showAccountMenu && (
  <div
    style={{
      position: "absolute",
      top: "65px",
      right: "20px",
      width: "250px",
      background: "#ffffff",
      borderRadius: "14px",
      padding: "16px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
      zIndex: 1000,
    }}
  >
    <div style={{ marginBottom: "12px" }}>
      <strong style={{ display: "block" }}>
        {currentUser?.user_metadata?.full_name || "Tài khoản"}
      </strong>

      <span style={{ fontSize: "12px", overflowWrap: "anywhere" }}>
        {currentUser?.email || ""}
      </span>
    </div>

    <hr style={{ border: 0, borderTop: "1px solid #eee" }} />

    <button
      type="button"
      onClick={() => {
        setShowAccountMenu(false);
        onLogout?.();
      }}
      style={{
        width: "100%",
        padding: "12px",
        marginTop: "8px",
        border: "none",
        borderRadius: "8px",
        background: "#fff1f1",
        color: "#d32f2f",
        cursor: "pointer",
        textAlign: "left",
        fontWeight: "600",
      }}
    >
      🚪 Đăng xuất
    </button>
  </div>
)}
</div>
      </header>
      <section className="family-card">
  <div className="family-card-overlay">
    <div className="family-card-top">
      <div className="family-title">
        <span className="family-home-icon">⌂</span>
        <span>
  {household?.name || "Nhà của mình"}
</span>
{household && household.created_by === currentUser?.id && (
  <button
    type="button"
    onClick={() => {
      setNewHouseholdName(household.name || "");
      setIsRenamingHousehold(true);
    }}
    title="Đổi tên Nhà"
    style={{
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: "16px",
      marginLeft: "6px",
    }}
  >
    ✏️
  </button>
)}
{isRenamingHousehold && (
  <div>
    <input
      type="text"
      value={newHouseholdName}
      onChange={(e) => setNewHouseholdName(e.target.value)}
      placeholder="Nhập tên Nhà mới"
      maxLength={60}
    />
<button
  type="button"
  onClick={async () => {
    const name = newHouseholdName.trim();

    if (!name || !household || !currentUser) return;

    const { data, error } = await supabase
      .from("households")
      .update({ name })
      .eq("id", household.id)
      .eq("created_by", currentUser.id)
      .select()
      .single();

    if (error) {
      console.error("Rename household error:", error);
      alert("Không thể đổi tên Nhà: " + error.message);
      return;
    }

    setHousehold(data);
    setIsRenamingHousehold(false);
    alert("Đã đổi tên Nhà thành công!");
  }}
>
  Lưu
</button>
    <button
      type="button"
      onClick={() => {
        setIsRenamingHousehold(false);
        setNewHouseholdName("");
      }}
    >
      Hủy
    </button>
  </div>
)}
        <span className="family-chevron"></span>
      </div>

     <button
  className="invite-button"
  onClick={async () => {
  const code = window.prompt("Nhập mã mời tham gia Nhà:");

  if (!code?.trim()) return;

  const { data, error } = await supabase.rpc(
    "join_household_by_invite",
    {
      p_invite_code: code.trim(),
    }
  );

  if (error) {
    console.error("Join household error:", error);
    alert("Không thể tham gia Nhà: " + error.message);
    return;
  }

  console.log("JOIN HOUSEHOLD SUCCESS:", data);
  setHouseholdRefreshKey(key => key + 1);
  alert("Đã tham gia Nhà thành công!");
}}
  type="button"
>
  Tham gia Nhà
</button>
<button
  type="button"
  className="invite-button"
  onClick={createHouseholdInvite}
>
  Tạo mã mời
</button>
    </div>

    <div className="family-members">
  {householdMembers.map((member) => {
    const name = member.user_id === currentUser?.id ? "Bạn" : member.display_name;

    return (
  <button
    key={member.user_id}
    type="button"
    className="member-avatar"
    title={name}
   onClick={() => {
  setSelectedMember(member);
}}
  >
    {name.charAt(0).toUpperCase()}
  </button>
);
  })}
</div>
{selectedMember && (
  <div className="member-profile-card">
    <button
      type="button"
      onClick={() => setSelectedMember(null)}
      style={{ float: "right" }}
    >
      ✕
    </button>

    <h3>
      {selectedMember.user_id === currentUser?.id ? "Bạn" : selectedMember.display_name}
    </h3>

    <p>
      Vai trò:{" "}
      {selectedMember.role === "owner"
        ? "Chủ Nhà"
        : "Thành viên"}
    </p>
  </div>
)}
<div className="family-meta">
  <button type="button" onClick={() => { setShowOwnerMembers(value => !value); setSelectedMember(null); }}
    aria-expanded={showOwnerMembers}
    style={{ border: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: 700, cursor: "pointer" }}>
    {householdMembers.filter(member => member.role !== "owner").length} thành viên {showOwnerMembers ? "⌄" : "›"}
  </button>
  <span>•</span> Riêng tư
</div>
  </div>
</section>
{showOwnerMembers && household?.created_by === currentUser?.id && (
  <section style={{ margin: "12px 16px", padding: 16, borderRadius: 16, background: "#f7f8fb" }}>
    <h3 style={{ marginTop: 0 }}>Quản lý thành viên Nhà</h3>
    <p>👑 Bạn · Chủ Nhà</p>
    {householdMembers.length === 0 && <p>Nhà chưa có thành viên.</p>}
    {householdMembers.map((member) => (
      <div key={member.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: "1px solid #e4e6eb" }}>
        <span style={{ overflowWrap: "anywhere" }}>👤 {member.display_name}</span>
        <button type="button" disabled={memberActionBusy} onClick={() => removeHouseMember(member)}
          style={{ marginLeft: "auto", border: "1px solid #e4b4b4", background: "#fff", color: "#b42318", borderRadius: 9, padding: "8px 10px", cursor: "pointer" }}>
          {memberActionBusy ? "Đang xử lý..." : "Xóa khỏi Nhà"}
        </button>
      </div>
    ))}
    {memberActionError && <p role="alert" style={{ color: "#b42318" }}>{memberActionError}</p>}
  </section>
)}
<section className="recent-section">
  {/* DANH SÁCH NHÀ ĐÃ THAM GIA */}
<section className="joined-households-section">
  <button
    type="button"
    onClick={() => setShowJoinedHouseholds(!showJoinedHouseholds)}
    style={{
      width: "100%",
      padding: "15px",
      borderRadius: "12px",
      border: "1px solid #ddd",
      background: "#fff",
      fontWeight: "bold",
      cursor: "pointer",
      marginBottom: "12px",
    }}
  >
    🏠 Nhà đã tham gia ({joinedHouseholds.length})
    {showJoinedHouseholds ? " ▲" : " ▼"}
  </button>

  {showJoinedHouseholds && (
    <div style={{ marginBottom: "20px" }}>
      {joinedHouseholds.length === 0 ? (
        <p>Bạn chưa tham gia Nhà nào.</p>
      ) : (
        joinedHouseholds.map((item) => (
          <div
            key={item.household_id}
            onClick={() => setOpenedHousehold(item.households)}
title="Bấm để vào không gian Nhà"
            style={{
              padding: "15px",
              marginBottom: "8px",
              background: "#f5f7fb",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            🏠 {item.households?.name || "Nhà chưa đặt tên"}
            <div style={{ fontSize: "12px", color: "#777" }}>
              Vai trò: Thành viên
            </div>
          </div>
        ))
      )}
    </div>
  )}
</section>
  <div className="section-heading">
    <h2>Khoảnh khắc gần đây</h2>
    <button
  className="see-all-button"
  type="button"
  onClick={onOpenMemory}
>
      Xem tất cả <span>›</span>
    </button>
  </div>

  <div className="recent-scroll">
    {recentFiles.map((file) => (
  <article
  className="moment-card"
  key={file.path}
  onClick={() => onOpenFile?.(file)}
>
    {file.type?.startsWith("video/") ? (
      <div className="moment-media">
        {file.thumbnail ? (
          <img src={file.thumbnail} alt={file.name} />
        ) : (
          <div className="moment-video-placeholder">▶</div>
        )}

        <span className="moment-video-icon">▶</span>
      </div>
    ) : (
      <img src={file.url} alt={file.name} />
    )}

    <div className="moment-info">
      <strong>Khoảnh khắc</strong>
      <span>{file.type?.startsWith("video/") ? "Video" : "Ảnh"}</span>
    </div>
  </article>
))}
  </div>
</section>
<section className="quick-save">
  <div className="quick-save-main">
    <div className="quick-plus">+</div>

    <div>
      <strong>Lưu một khoảnh khắc</strong>
      <p>Ảnh, video, ghi chú...</p>
    </div>
  </div>

  <div className="quick-actions">
    <button type="button" onClick={onPickImage}>
      <span>📷</span>
      Ảnh
    </button>

    <button type="button" onClick={onPickVideo}>
      <span>🎥</span>
      Video
    </button>
  </div>
</section>
<section className="journeys">
  <div className="section-heading">
    <h2>Hành trình của chúng ta</h2>
    <button type="button">Xem tất cả ›</button>
  </div>

  <div className="journey-list">
    
{Object.values(journeys)
  .map((journey) => (
    <div className="journey-custom-block" key={journey.id}>
      <article
        className="journey-item"
        onClick={() => {
          onSelectJourney?.(journey.id);
          onOpenJourney?.();
        }}
        role="button"
        tabIndex={0}
      >
        <div className="journey-icon">
          {journey.image_url ? (
            <img
              src={journey.image_url}
              alt={journey.title}
              className="journey-avatar-image"
            />
          ) : (
            journey.icon || "✨"
          )}
        </div>

        <div className="journey-content">
          <strong>{journey.title}</strong>
          <span>{journey.subtitle || "Hành trình mới"}</span>
        </div>

        <div className="journey-count">
          <span>
  {(journeyMomentsById[journey.id] || []).reduce(
    (total, moment) => total + (moment.files?.length || 0),
    0
  )}
</span>

          <div
            className="journey-menu-wrapper"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="journey-menu-button"
              aria-label="Tùy chọn hành trình"
              onClick={() =>
                setOpenJourneyMenuId((current) =>
                  current === journey.id ? null : journey.id
                )
              }
            >
              ...
            </button>

            {openJourneyMenuId === journey.id && (
              <div className="journey-menu">
                <button
                  type="button"
                  onClick={() => {
                    setOpenJourneyMenuId(null);
                    setEditingJourneyId(journey.id);
                    setEditJourneyTitle(journey.title || "");
                    setEditJourneyDescription(
                      journey.description || journey.subtitle || ""
                    );
                    setEditJourneyImage(null);
                  }}
                >
                  ✏️ Chỉnh sửa hành trình
                </button>

                <button
                  type="button"
                  className="journey-menu-delete"
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Bạn có chắc muốn xóa hành trình "${journey.title}"?\n\nẢnh và video gốc trong Kho media sẽ không bị xóa.`
                    );

                    if (!confirmed) return;

                    setOpenJourneyMenuId(null);
                    onDeleteJourney?.(journey.id);
                  }}
                >
                  🗑️ Xóa hành trình
                </button>
              </div>
            )}
          </div>

          <b>›</b>
        </div>
      </article>

      {editingJourneyId === journey.id && (
        <div className="journey-edit-box">
          <label className="journey-edit-avatar">
            {editJourneyImage ? (
              <img
                src={URL.createObjectURL(editJourneyImage)}
                alt="Ảnh đại diện hành trình"
              />
            ) : journey.image_url ? (
              <img
                src={journey.image_url}
                alt={journey.title}
              />
            ) : (
              <span>{journey.icon || "✨"}</span>
            )}

            <span className="journey-edit-camera">📷</span>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (file) {
                  setEditJourneyImage(file);
                }
              }}
            />
          </label>

          <input
            type="text"
            value={editJourneyTitle}
            onChange={(e) => setEditJourneyTitle(e.target.value)}
            placeholder="Tên hành trình"
          />

          <textarea
            value={editJourneyDescription}
            onChange={(e) => setEditJourneyDescription(e.target.value)}
            placeholder="Mô tả hành trình"
          />

          <div className="journey-edit-actions">
            <button
              type="button"
              onClick={() => {
                setEditingJourneyId(null);
                setEditJourneyImage(null);
              }}
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={async () => {
                const cleanTitle = editJourneyTitle.trim();

                if (!cleanTitle) {
                  alert("Tên hành trình không được để trống.");
                  return;
                }

                const success = await onUpdateJourney?.(
                  journey.id,
                  cleanTitle,
                  editJourneyDescription.trim(),
                  editJourneyImage
                );

                if (success !== false) {
                  setEditingJourneyId(null);
                  setEditJourneyImage(null);
                }
              }}
            >
              Lưu thay đổi
            </button>
          </div>
        </div>
      )}
    </div>
  ))}
    {receivedError && <p role="alert" style={{ color: "#b42318" }}>Lỗi tải hành trình Nhà: {receivedError}</p>}
    {receivedJourneys.map(journey => (
      <div className="journey-custom-block" key={`shared-${journey.id}`}>
        <button type="button" className="journey-item"
          onClick={() => onOpenSharedJourney?.(journey, household, "home")}
          style={{ width: "100%", textAlign: "left", cursor: "pointer", border: 0 }}>
          <div className="journey-icon">
            {journey.image_url
              ? <img src={journey.image_url} alt={journey.title || "Hành trình"} className="journey-avatar-image" />
              : "🌿"}
          </div>
          <div className="journey-content">
            <strong>{journey.title || "Hành trình chưa đặt tên"}</strong>
            <span>{journey.description || "Được chia sẻ vào Nhà"} · Chỉ xem</span>
          </div>
          <div className="journey-count"><b>›</b></div>
        </button>
      </div>
    ))}
    <button
  className="create-journey"
  type="button"
  onClick={() => setShowCreateJourney(true)}
>
      <span className="create-journey-plus">＋</span>

      <span>
        <strong>Tạo hành trình mới</strong>
        <small>Bắt đầu một hành trình mới của bạn</small>
      </span>
    </button>
    {showCreateJourney && (
  <div className="create-journey-form">
    <h3>Tạo hành trình mới</h3>

    <input
      type="text"
      placeholder="Tên hành trình..."
      value={newJourneyTitle}
  onChange={(e) => setNewJourneyTitle(e.target.value)}
    />

    <textarea
  placeholder="Mô tả hành trình..."
  rows="3"
  value={newJourneyDescription}
  onChange={(e) => setNewJourneyDescription(e.target.value)}
/>

    <div className="create-journey-form-actions">
      <button
        type="button"
        onClick={() => setShowCreateJourney(false)}
      >
        Hủy
      </button>

      <button
  type="button"
  onClick={() => {
    if (!newJourneyTitle.trim()) return;

    onCreateJourney?.(
      newJourneyTitle.trim(),
      newJourneyDescription.trim()
    );

    setNewJourneyTitle("");
    setNewJourneyDescription("");
    setShowCreateJourney(false);
  }}
>
  Tạo hành trình
</button>
    </div>
  </div>
)}
  </div>
</section>
<section className="memory-lookback">
  <div className="section-heading">
    <h2>Nhìn lại</h2>
    <button type="button">Xem thêm ›</button>
  </div>

  <div className="lookback-card">
    <div className="lookback-copy">
      <span className="lookback-label">
  {lookbackDate ? "Ngày này năm trước" : "Kỷ niệm đang chờ bạn"}
</span>

<h3>
  {lookbackDate
    ? "Một ngày bình thường của nhà mình"
    : "Chưa có kỷ niệm của ngày này"}
</h3>

<p>
  {lookbackDate
    ? `${String(lookbackDate.getDate()).padStart(2, "0")}/${String(
        lookbackDate.getMonth() + 1
      ).padStart(2, "0")}/${lookbackDate.getFullYear()} • ${
        lookbackFiles.length
      } khoảnh khắc`
    : "Những năm sau, kỷ niệm hôm nay sẽ xuất hiện ở đây"}
</p>

      {lookbackFiles.length > 0 && (
  <button
    type="button"
    className="lookback-button"
    onClick={() => {
      onOpenFile?.(lookbackFiles[0]);
    }}
  >
    Xem lại kỷ niệm
  </button>
)}
    </div>

   {lookbackFiles.length > 0 && (
  <div className="lookback-preview">
  {lookbackFiles.slice(0, 3).map((file, index) => (
    <div
      key={file.path}
      className={`lookback-photo ${
        index === 0
          ? "photo-one"
          : index === 1
          ? "photo-two"
          : "photo-three"
      }`}
    >
      <img
        src={
          file.type?.startsWith("video/")
            ? file.thumbnail
            : file.url
        }
        alt={file.name || "Kỷ niệm"}
      />
    </div>
  ))}

  {lookbackFiles.length === 0 && (
    <>
      <div className="lookback-photo photo-one"></div>
      <div className="lookback-photo photo-two"></div>
      <div className="lookback-photo photo-three"></div>
    </>
  )}
</div>
)}
  </div>
</section>
<section className="family-activity">
  <div className="section-heading">
    <h2>Hoạt động gia đình</h2>
    <button type="button" onClick={() => {
      const item = familyActivities[0];
      if (item?.house) { setOpenedHouseholdTab("family"); setOpenedHousehold(item.house); }
    }}>Xem thêm ›</button>
  </div>
  {familyActivityError && <p role="alert">Chưa tải được hoạt động: {familyActivityError}</p>}
  <div className="activity-list">
    {familyActivities.length === 0 && !familyActivityError && <p>Chưa có hoạt động gia đình mới.</p>}
    {familyActivities.slice(0, 3).map(item => (
      <button type="button" className="activity-item" key={item.id}
        style={{ width: "100%", border: 0, textAlign: "left", cursor: "pointer", background: "transparent" }}
        onClick={() => { if (item.house) { setOpenedHouseholdTab("family"); setOpenedHousehold(item.house); } }}>
        <div className="activity-avatar">{item.authorName.slice(0, 1).toUpperCase()}</div>
        <div className="activity-text">
          <strong>{item.authorName}</strong>
          <span>{item.kind === "date" ? "đã thêm ngày đặc biệt" : item.kind === "story" ? "đã đăng câu chuyện" : "đã gửi một lời nhắn"} vào {item.house?.name || "Nhà"}</span>
          <small>{new Date(item.created_at).toLocaleString("vi-VN")}</small>
        </div>
        <span className="activity-icon">{item.kind === "date" ? "🎂" : item.kind === "story" ? "📖" : "💌"}</span>
      </button>
    ))}
  </div>
</section>
<nav className="bottom-nav">
  <button className="nav-item active" type="button">
    <span>⌂</span>
    <small>Trang chủ</small>
  </button>

  <button className="nav-item" type="button">
    <span>▱</span>
    <small>Hành trình</small>
  </button>

  <button className="nav-add" type="button" aria-label="Thêm khoảnh khắc">
    +
  </button>

  <button className="nav-item" type="button">
    <span>♧</span>
    <small>Thông báo</small>
  </button>

  <button className="nav-item" type="button">
    <span>♙</span>
    <small>Cá nhân</small>
  </button>
</nav>
    </main>
  );
}