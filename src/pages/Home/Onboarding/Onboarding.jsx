import { useState } from "react";
import "./Onboarding.css";
import { supabase } from "../../../supabase";
export default function Onboarding({ user, onComplete }) {
    const [inviteCode, setInviteCode] = useState("");
   async function createHousehold() {
  if (!user?.id) {
    alert("Không tìm thấy tài khoản đăng nhập.");
    return;
  }

  try {
    // 1. Tạo profile nếu chưa có
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          display_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "Thành viên",
          avatar_url: user.user_metadata?.avatar_url || null,
        },
        { onConflict: "id" }
      );

    if (profileError) throw profileError;

    // 2. Tạo Nhà
    const { data: household, error: householdError } = await supabase
      .from("households")
      .insert({
        name: "Nhà của mình",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (householdError) throw householdError;

    // 3. Đưa chính người tạo vào Nhà với quyền owner
    const { error: memberError } = await supabase
      .from("household_members")
      .insert({
        household_id: household.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) throw memberError;

    onComplete?.();
  } catch (error) {
    console.error("Create household error:", error);
    alert("Chưa thể tạo Nhà. Vui lòng thử lại.");
  }
} 
async function joinHousehold() {
  if (!user?.id) {
    alert("Không tìm thấy tài khoản đăng nhập.");
    return;
  }

  if (!inviteCode?.trim()) {
    return;
  }

  try {
    // Đảm bảo người dùng có profile trước khi tham gia Nhà
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          display_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "Thành viên",
          avatar_url: user.user_metadata?.avatar_url || null,
        },
        { onConflict: "id" }
      );

    if (profileError) throw profileError;

    const { data, error } = await supabase.rpc(
      "join_household_by_invite",
      {
        p_invite_code: inviteCode.trim(),
      }
    );

    if (error) throw error;

    console.log("JOINED HOUSEHOLD:", data);

    onComplete?.();
  } catch (error) {
    console.error("Join household error:", error);
    alert("Không thể tham gia Nhà. Mã mời có thể không đúng hoặc đã hết hạn.");
  }
}
  return (
    <main className="onboarding-page">
      <div className="onboarding-content">

        <div className="onboarding-brand">EverMoment</div>

        <section className="onboarding-intro">
          <h1>Chào mừng bạn đến với EverMoment</h1>
          <p>
            Mỗi gia đình đều có một câu chuyện đáng để lưu giữ.
          </p>
        </section>

        <div className="onboarding-actions">
          <button
  className="onboarding-option"
  type="button"
  onClick={createHousehold}
>
            <div className="onboarding-option-icon">⌂</div>

            <div className="onboarding-option-text">
              <strong>Tạo Nhà của mình</strong>
              <span>Bắt đầu không gian riêng cho gia đình bạn</span>
            </div>

            <div className="onboarding-arrow">›</div>
          </button>
<div className="onboarding-invite-box">
  <input
    type="text"
    value={inviteCode}
    onChange={(e) => setInviteCode(e.target.value)}
    placeholder="Nhập mã mời"
    autoComplete="off"
  />
</div>
         <button
  className="onboarding-option"
  type="button"
  onClick={joinHousehold}
>
  <div className="onboarding-option-icon">♡</div>

  <div className="onboarding-option-text">
    <strong>Tham gia một Nhà</strong>
    <span>Tham gia bằng lời mời từ người thân</span>
  </div>

  <div className="onboarding-arrow">›</div>
</button>
        </div>

      </div>
    </main>
  );
}