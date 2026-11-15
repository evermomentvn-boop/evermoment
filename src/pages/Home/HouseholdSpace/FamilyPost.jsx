import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../supabase";

const EMOJIS = ["❤️", "🥰", "😂", "👍", "😮", "😢"];
const typeName = { message: "💌 Góc yêu thương", date: "🎂 Ngày đặc biệt", story: "📖 Chuyện nhà mình" };

export default function FamilyPost({ post, userId, authorName, onInteraction }) {
  const [reactions, setReactions] = useState([]);
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const [reactionResult, commentResult] = await Promise.all([
      supabase.from("household_family_reactions").select("user_id,emoji").eq("post_id", post.id),
      supabase.from("household_family_comments").select("id,user_id,body,created_at").eq("post_id", post.id).order("created_at", { ascending: true }),
    ]);
    if (reactionResult.error || commentResult.error) {
      setError("Chưa tải được tương tác. Hãy chạy SQL bình luận và biểu cảm.");
      return;
    }
    setReactions(reactionResult.data || []);
    setComments(commentResult.data || []);
    setError("");
  }, [post.id]);
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  async function react(emoji) {
    if (!userId || busy) return;
    setBusy(true);
    const existing = reactions.find(item => item.user_id === userId);
    const request = existing?.emoji === emoji
      ? supabase.from("household_family_reactions").delete().eq("post_id", post.id).eq("user_id", userId)
      : supabase.from("household_family_reactions").upsert({ post_id: post.id, user_id: userId, emoji }, { onConflict: "post_id,user_id" });
    const { error: changeError } = await request;
    if (changeError) setError("Không thể thả biểu cảm: " + changeError.message);
    else { await load(); onInteraction?.(); }
    setBusy(false);
  }

  async function comment(event) {
    event.preventDefault();
    if (!draft.trim() || !userId || busy) return;
    setBusy(true);
    const { error: changeError } = await supabase.from("household_family_comments").insert({
      post_id: post.id, user_id: userId, body: draft.trim(),
    });
    if (changeError) setError("Không thể bình luận: " + changeError.message);
    else { setDraft(""); setExpanded(true); await load(); onInteraction?.(); }
    setBusy(false);
  }

  const ownEmoji = reactions.find(item => item.user_id === userId)?.emoji;
  const counts = EMOJIS.map(emoji => [emoji, reactions.filter(item => item.emoji === emoji).length]).filter(([, count]) => count);
  return (
    <article className="hs-family-post">
      <div className="hs-family-post-heading">
        <strong>🏠 {authorName || (post.author_id === userId ? "Bạn" : "Thành viên Nhà")}</strong>
        <small>{typeName[post.kind] || "Gia đình"} · {new Date(post.created_at).toLocaleString("vi-VN")}</small>
      </div>
      <p className="hs-family-post-body">{post.body}</p>
      {post.photo_url && <img className="hs-family-post-photo" src={post.photo_url} alt="Ảnh bài đăng" loading="lazy" />}
      {post.event_date && <small>📅 {new Date(post.event_date + "T12:00:00").toLocaleDateString("vi-VN")}</small>}
      <div className="hs-family-reaction-summary">
        {counts.map(([emoji, count]) => <span key={emoji}>{emoji} {count}</span>)}
        <button type="button" onClick={() => setExpanded(value => !value)}>💬 {comments.length} bình luận</button>
      </div>
      <div className="hs-family-reaction-bar">
        {EMOJIS.map(emoji => <button type="button" key={emoji} title={emoji} disabled={busy}
          aria-pressed={ownEmoji === emoji} className={ownEmoji === emoji ? "selected" : ""}
          onClick={() => react(emoji)}>{emoji}</button>)}
      </div>
      <button type="button" className="hs-family-comment-toggle" onClick={() => setExpanded(value => !value)}>
        💬 {expanded ? "Ẩn bình luận" : "Bình luận / Trả lời"}
      </button>
      {expanded && <div className="hs-family-comments">
        {comments.map(item => <div className="hs-family-comment" key={item.id}>
          <strong>{item.user_id === userId ? "Bạn" : "Thành viên Nhà"}</strong>
          <p>{item.body}</p>
          <small>{new Date(item.created_at).toLocaleString("vi-VN")}</small>
        </div>)}
        <form onSubmit={comment} className="hs-family-comment-form">
          <input aria-label="Viết bình luận" maxLength={1000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Viết bình luận..." />
          <button type="submit" disabled={busy || !draft.trim()}>Gửi</button>
        </form>
      </div>}
      {error && <small role="alert" className="hs-family-error">{error}</small>}
    </article>
  );
}
