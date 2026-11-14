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
const [selectedShareJourneyId, setSelectedShareJourneyId] = useState(null);
const [shareError, setShareError] = useState("");
const [shareBusy, setShareBusy] = useState(false);
const [shareLoading, setShareLoading] = useState(false);
const [reloadKey, setReloadKey] = useState(0);
const [sharingAvailable, setSharingAvailable] = useState(false);
const [ownedCustomerIds, setOwnedCustomerIds] = useState([]);
const [linkedJourneyIds, setLinkedJourneyIds] = useState([]);
const [legacyJourneyIds, setLegacyJourneyIds] = useState([]);
const [unshareBusyId, setUnshareBusyId] = useState(null);
const [currentUserId, setCurrentUserId] = useState(null);

useEffect(() => {
  let active = true;
  async function loadIdentity() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!active) return;
    setCurrentUserId(user?.id || null);
    if (!user) { setOwnedCustomerIds([]); return; }
    const { data, error } = await supabase.from("customers")
      .select("id").eq("auth_user_id", user.id);
    if (active) setOwnedCustomerIds(error ? [] : (data || []).map(row => row.id));
  }
  loadIdentity();
  return () => { active = false; };
}, []);

async function unshareJourney(journey) {
  if (!household?.id || !linkedJourneyIds.includes(journey.id) || legacyJourneyIds.includes(journey.id) || unshareBusyId !== null) return;
  if (!window.confirm("Ngừng chia sẻ hành trình này khỏi Nhà? Hành trình và ảnh/video gốc vẫn được giữ nguyên.")) return;
  setUnshareBusyId(journey.id);
  const { error } = await supabase.rpc("unshare_journey_from_household", {
    p_journey_row_id: journey.id, p_household_id: household.id,
  });
  if (error) {
    setJourneysError("Không thể ngừng chia sẻ: " + error.message);
  } else {
    setReloadKey(n => n + 1);
  }
  setUnshareBusyId(null);
}


async function showShareDialog() {
  setShareError("");
  setShareCandidates([]);
  setSelectedShareJourneyId(null);
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
  if (!owners?.length) { setShareError("Tài khoản này chưa có kho cá nhân để chia sẻ hành trình."); setShareLoading(false); return; }
  const { data, error } = await supabase.from("journeys")
    .select("id, journey_id, title, customer_id")
    .in("customer_id", owners.map((owner) => owner.id))
    .order("created_at", { ascending: false });
  if (error) setShareError(error.message);
  else setShareCandidates(data || []);
  setShareLoading(false);
}

async function shareJourney(journey) {
  if (!household?.id || shareBusy || !sharingAvailable) return;
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
      setLinkedJourneyIds([]);
      setLegacyJourneyIds([]);
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
    // Preserve existing household journeys if the optional sharing feature is unavailable.
    // A failed linked-journey query must not hide successfully loaded legacy journeys.
    const linksNotReady = ["42P01", "PGRST205"].includes(links.error?.code);
    if (!cancelled) {
      setSharingAvailable(!links.error);
      setLinkedJourneyIds(ids);
      setLegacyJourneyIds((legacy.data || []).map(row => row.id));
    }
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
      // Keep rows that were loaded successfully; never silently discard them.
      setHouseholdJourneys(data);
    } else {
      setHouseholdJourneys(data);
    }

    setJourneysLoading(false);
  }

  loadHouseholdJourneys();

  return () => {
    cancelled = true;
  };
}, [household?.id, reloadKey]);
  useEffect(() => {
    setShareOpen(false);
    setSelectedShareJourneyId(null);
    setShareError("");
  }, [household?.id]);
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
        .select("user_id, role")
        .eq("household_id", household.id);

      if (cancelled) return;

      if (error) {
        console.error("Load household members error:", error);
        setMembersError("Không thể tải danh sách thành viên.");
        setMembers([]);
      } else {
        setMembers((data || []).filter(member => member.user_id !== household.created_by));
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
            ♡ {household.created_by === currentUserId ? "Bạn là chủ Nhà" : "Bạn là thành viên"}
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
        member.user_id === currentUserId ? "Bạn" : "Thành viên";

      return (
        <button
          key={member.user_id}
          type="button"
          className="hs-member-button"
          onClick={() => setSelectedMember(member)}
          title={name}
        >
          <div className="hs-member-avatar">
            {name.charAt(0).toUpperCase()}
          </div>

          <span className="hs-member-name">
            {name}
          </span>

          <small>
            {member.user_id === household.created_by
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
      {selectedMember.user_id === currentUserId ? "Bạn" : "Thành viên"}
    </h3>

    <p>
      Vai trò:{" "}
      {selectedMember.user_id === household.created_by
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

        <button className="hs-share-button" type="button" disabled={!sharingAvailable || journeysLoading} onClick={showShareDialog}>
          ＋ Chia sẻ hành trình
        </button>
        {!journeysLoading && !sharingAvailable && (
          <p role="status" style={{ color: "#a43b3b", fontSize: "13px" }}>
            Chia sẻ hành trình chưa được kích hoạt trên Supabase. Các hành trình hiện có vẫn xem được bình thường.
          </p>
        )}
        {shareOpen && (
          <div className="hs-empty-card" role="dialog" aria-label="Chia sẻ hành trình">
            <h3>Chọn hành trình đưa vào Nhà</h3>
            <p>Toàn bộ thành viên Nhà sẽ xem được hành trình được chia sẻ.</p>
            {shareError && <p role="alert" style={{ color: "#c0392b" }}>{shareError}</p>}
            {shareLoading && <p>Đang tải hành trình...</p>}
            {!shareLoading && !shareError && shareCandidates.length === 0 && <p>Chưa có hành trình cá nhân.</p>}
            {!shareLoading && shareCandidates.map((journey) => {
              const alreadyInHouse = householdJourneys.some((item) => item.id === journey.id);
              const selected = selectedShareJourneyId === journey.id;
              return (
                <button key={journey.id} type="button" disabled={shareBusy || alreadyInHouse}
                  aria-pressed={selected}
                  onClick={() => setSelectedShareJourneyId(journey.id)}
                  style={{
                    display: "block", width: "100%", padding: "10px", margin: "8px 0",
                    border: selected ? "2px solid #ff4e70" : "1px solid #bbb",
                    borderRadius: "8px",
                    background: selected ? "#fff0f4" : "#fff",
                    opacity: alreadyInHouse ? 0.65 : 1,
                  }}>
                  {selected ? "✓ " : "🌿 "}{journey.title || "Hành trình chưa đặt tên"}
                  {alreadyInHouse ? " · Đã có trong Nhà" : ""}
                </button>
              );
            })}
            <button type="button" disabled={shareBusy || shareLoading || !sharingAvailable || !selectedShareJourneyId}
              onClick={() => {
                const journey = shareCandidates.find((item) => item.id === selectedShareJourneyId);
                if (journey) shareJourney(journey);
              }}
              style={{ padding: "10px 14px", borderRadius: "8px", background: "#ff4e70", color: "white", border: 0, marginRight: "8px" }}>
              {shareBusy ? "Đang chia sẻ..." : "Chia sẻ hành trình đã chọn vào Nhà"}
            </button>
            <button type="button" disabled={shareBusy} onClick={() => setShareOpen(false)}>Đóng</button>
          </div>
        )}
      </section>

      {/* HÀNH TRÌNH */}
<section className="hs-section">
  <div className="hs-section-heading">
    <h2>Hành trình của Nhà</h2>
    <span>{householdJourneys.length} hành trình</span>
  </div>

  {journeysError && !journeysLoading && (
    <p role="alert" style={{ color: "#c0392b" }}>Không tải được đầy đủ hành trình: {journeysError}</p>
  )}
  {journeysLoading ? (
    <p>Đang tải hành trình...</p>
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

          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>{journey.title || "Hành trình chưa đặt tên"}</strong>
            <p style={{ fontSize: "12px", color: "#777" }}>
              {journey.description || "Kỷ niệm của gia đình"}
            </p>
          </div>
          {linkedJourneyIds.includes(journey.id) && !legacyJourneyIds.includes(journey.id) && ownedCustomerIds.includes(journey.customer_id) && (
            <button type="button" disabled={unshareBusyId !== null}
              onClick={(event) => { event.stopPropagation(); unshareJourney(journey); }}
              aria-label={"Ngừng chia sẻ " + (journey.title || "hành trình")}
              style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "8px", background: "#fff", cursor: "pointer" }}>
              {unshareBusyId === journey.id ? "Đang xử lý..." : "Ngừng chia sẻ"}
            </button>
          )}
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