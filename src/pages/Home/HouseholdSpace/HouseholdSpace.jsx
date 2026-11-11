import { useEffect, useState } from "react";
import { supabase } from "../../../supabase";
import "./HouseholdSpace.css";

export default function HouseholdSpace({
  household,
  onBack,
  onOpenJourney,
}) {
    const [householdJourneys, setHouseholdJourneys] = useState([]);
const [journeysLoading, setJourneysLoading] = useState(true);
const [journeysError, setJourneysError] = useState("");
const [shareOpen, setShareOpen] = useState(false);
const [shareCandidates, setShareCandidates] = useState([]);
const [shareError, setShareError] = useState("");
const [shareBusy, setShareBusy] = useState(false);
const [shareLoading, setShareLoading] = useState(false);
const [reloadKey, setReloadKey] = useState(0);

async function showShareDialog() {
  setShareError("");
  setShareCandidates([]);
  setShareLoading(true);
  setShareOpen(true);
  const { data: userResult, error: authError } = await supabase.auth.getUser();
  if (authError || !userResult?.user) {
    setShareError("Vui lòng đăng nhập lại.");
    setShareLoading(false);
    return;
  }
  const { data: owners, error: ownersError } = await supabase
    .from("customers").select("id").eq("auth_user_id", userResult.user.id);
  if (ownersError) { setShareError(ownersError.message); setShareLoading(false); return; }
  if (!owners?.length) { setShareLoading(false); return; }
  const { data, error } = await supabase.from("journeys")
    .select("id, journey_id, title, customer_id")
    .in("customer_id", owners.map((owner) => owner.id))
    .order("created_at", { ascending: false });
  if (error) setShareError(error.message);
  else setShareCandidates(data || []);
  setShareLoading(false);
}

async function shareJourney(journey) {
  if (!household?.id || shareBusy) return;
  setShareBusy(true);
  setShareError("");
  const { error } = await supabase.rpc("share_journey_to_household", {
    p_journey_row_id: journey.id,
    p_household_id: household.id,
  });
  if (error) {
    setShareError(["42883", "PGRST202"].includes(error.code)
      ? "Chức năng chia sẻ chưa được kích hoạt trên Supabase. Dữ liệu cũ vẫn được giữ nguyên."
      : error.message);
  } else { setShareOpen(false); setReloadKey((n) => n + 1); }
  setShareBusy(false);
}

useEffect(() => {
  let cancelled = false;

  async function loadHouseholdJourneys() {
    if (!household?.id) {
      setHouseholdJourneys([]);
      setJourneysLoading(false);
      return;
    }

    setJourneysLoading(true);
    setJourneysError("");

    const legacy = await supabase.from("journeys")
      .select("id, journey_id, customer_id, title, description, image_url, created_at")
      .eq("household_id", household.id);
    const links = await supabase.from("household_journeys")
      .select("journey_row_id").eq("household_id", household.id);
    const ids = (links.data || []).map((row) => row.journey_row_id);
    const shared = ids.length
      ? await supabase.from("journeys")
          .select("id, journey_id, customer_id, title, description, image_url, created_at")
          .in("id", ids)
      : { data: [], error: null };
    const linksNotReady = ["42P01", "PGRST205"].includes(links.error?.code);
    const error = legacy.error || (linksNotReady ? null : links.error) || shared.error;
    const byId = new Map();
    for (const row of [...(legacy.data || []), ...(shared.data || [])]) {
      byId.set(row.id, row);
    }
    const data = [...byId.values()].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    if (cancelled) return;





if (error) {
  console.error("Lỗi tải hành trình Nhà:", error);
  setJourneysError(error.message);
  setHouseholdJourneys([]);
} else {
  setHouseholdJourneys(data || []);
}

    setJourneysLoading(false);
  }

  loadHouseholdJourneys();

  return () => {
    cancelled = true;
  };
}, [household?.id, reloadKey]);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      if (!household?.id) {
        setMembers([]);
        setLoadingMembers(false);
        return;
      }

      setLoadingMembers(true);
      setMembersError("");
      setMembers([]);
      setSelectedMember(null);

      const { data, error } = await supabase
        .from("household_members")
        .select(`
          user_id,
          role,
          profiles (
            display_name,
            avatar_url
          )
        `)
        .eq("household_id", household.id);

      if (cancelled) return;

      if (error) {
        console.error("Load household members error:", error);
        setMembersError("Không thể tải danh sách thành viên.");
        setMembers([]);
      } else {
        setMembers(data || []);
      }

      setLoadingMembers(false);
    }

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [household?.id]);

  if (!household) return null;

  return (
    <main className="household-space">

      {/* THANH ĐẦU TRANG */}
      <header className="hs-header">
        <button
          className="hs-back"
          type="button"
          onClick={onBack}
        >
          ← Trang chủ
        </button>

        <span className="hs-brand">EverMoment</span>
      </header>

      {/* ẢNH BÌA NHÀ */}
      <section className="hs-cover">
        <div className="hs-cover-content">
          <span className="hs-house-icon">🏠</span>

          <h1>{household.name || "Nhà của chúng ta"}</h1>

          <p>Không gian lưu giữ yêu thương</p>

          <span className="hs-member-badge">
            ♡ Bạn là thành viên
          </span>
        </div>
      </section>

      {/* THÀNH VIÊN */}
      <section className="hs-members">
        <div className="hs-section-heading">
          <h2>Thành viên trong Nhà</h2>
          <span>›</span>
        </div>

        <div className="hs-member-list">

  {loadingMembers && (
    <p>Đang tải thành viên...</p>
  )}

  {membersError && (
    <p>{membersError}</p>
  )}

  {!loadingMembers && !membersError && members.length === 0 && (
    <p>Chưa có thông tin thành viên.</p>
  )}

  {!loadingMembers && !membersError &&
    members.map((member) => {
      const name =
        member.profiles?.display_name || "Thành viên";

      return (
        <button
          key={member.user_id}
          type="button"
          className="hs-member-button"
          onClick={() => setSelectedMember(member)}
          title={name}
        >
          <div className="hs-member-avatar">
            {member.profiles?.avatar_url ? (
              <img
                src={member.profiles.avatar_url}
                alt={name}
              />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>

          <span className="hs-member-name">
            {name}
          </span>

          <small>
            {member.role === "owner"
              ? "Chủ Nhà"
              : "Thành viên"}
          </small>
        </button>
      );
    })
  }

</div>

{selectedMember && (
  <div className="hs-member-profile">
    <button
      type="button"
      onClick={() => setSelectedMember(null)}
      className="hs-profile-close"
    >
      ✕
    </button>

    <h3>
      {selectedMember.profiles?.display_name || "Thành viên"}
    </h3>

    <p>
      Vai trò:{" "}
      {selectedMember.role === "owner"
        ? "Chủ Nhà"
        : "Thành viên"}
    </p>
  </div>
)}
      </section>

      {/* KHOẢNH KHẮC */}
      <section className="hs-section">
        <div className="hs-section-heading">
          <h2>Khoảnh khắc gần đây</h2>
          <span>›</span>
        </div>

        <div className="hs-empty-card">
          <span>📸</span>
          <p>Khoảnh khắc từ các hành trình được chia sẻ vào Nhà sẽ xuất hiện ở đây.</p>
        </div>

        <button className="hs-share-button" type="button" onClick={showShareDialog}>
          ＋ Chia sẻ hành trình
        </button>
        {shareOpen && (
          <div className="hs-empty-card" role="dialog" aria-label="Chia sẻ hành trình">
            <h3>Chọn hành trình đưa vào Nhà</h3>
            <p>Toàn bộ thành viên Nhà sẽ xem được hành trình được chia sẻ.</p>
            {shareError && <p role="alert" style={{ color: "#c0392b" }}>{shareError}</p>}
            {shareLoading && <p>Đang tải hành trình...</p>}
            {!shareLoading && !shareError && shareCandidates.length === 0 && <p>Chưa có hành trình cá nhân.</p>}
            {!shareLoading && shareCandidates.map((journey) => (
              <button key={journey.id} type="button" disabled={shareBusy}
                onClick={() => shareJourney(journey)}
                style={{ display: "block", width: "100%", padding: "10px", margin: "8px 0" }}>
                🌿 {journey.title || "Hành trình chưa đặt tên"}
              </button>
            ))}
            <button type="button" onClick={() => setShareOpen(false)}>Đóng</button>
          </div>
        )}
      </section>

      {/* HÀNH TRÌNH */}
<section className="hs-section">
  <div className="hs-section-heading">
    <h2>Hành trình của Nhà</h2>
    <span>{householdJourneys.length} hành trình</span>
  </div>

  {journeysLoading ? (
    <p>Đang tải hành trình...</p>
  ) : journeysError ? (
    <p style={{ color: "#c0392b" }}>
      Không tải được hành trình: {journeysError}
    </p>
  ) : householdJourneys.length === 0 ? (
    <div className="hs-empty-card">
      <span>🌿</span>
      <p>Nhà chưa có hành trình nào.</p>
    </div>
  ) : (
    <div style={{ display: "grid", gap: "12px" }}>
      {householdJourneys.map((journey) => (
        <div
          key={journey.id}
          onClick={() => onOpenJourney?.(journey)}
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px",
            borderRadius: "12px",
            background: "#f6f8fb",
          }}
        >
          {journey.image_url ? (
            <img
              src={journey.image_url}
              alt={journey.title || "Ảnh hành trình"}
              style={{
                width: "68px",
                height: "68px",
                objectFit: "cover",
                borderRadius: "10px",
              }}
            />
          ) : (
            <span style={{ fontSize: "30px" }}>🌿</span>
          )}

          <div style={{ minWidth: 0 }}>
            <strong>{journey.title || "Hành trình chưa đặt tên"}</strong>
            <p style={{ fontSize: "12px", color: "#777" }}>
              {journey.description || "Kỷ niệm của gia đình"}
            </p>
          </div>
        </div>
      ))}
    </div>
  )}
</section>

      {/* THANH ĐIỀU HƯỚNG */}
      <nav className="hs-bottom-nav">
        <span>🏠<small>Nhà</small></span>
        <span>📸<small>Khoảnh khắc</small></span>
        <span>🌿<small>Hành trình</small></span>
        <span>♡<small>Gia đình</small></span>
      </nav>

    </main>
  );
}