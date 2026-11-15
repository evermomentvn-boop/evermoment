import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../supabase";
import FamilyPost from "./FamilyPost";

const SECTIONS = [
  ["messages", "💌 Góc yêu thương", "Những lời nhắn mới nhất của gia đình"],
  ["dates", "🎂 Ngày đặc biệt", "Sinh nhật và những dịp đáng nhớ"],
  ["stories", "📖 Chuyện nhà mình", "Những câu chuyện lưu giữ theo thời gian"],
];

export default function FamilySpace({ household, userId }) {
  const [section, setSection] = useState("overview");
  const [posts, setPosts] = useState([]);
  const [authorNames, setAuthorNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  useEffect(() => {
    if (!photo) { setPhotoPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const loadPosts = useCallback(async () => {
    if (!household?.id) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from("household_family_posts")
      .select("id,author_id,kind,body,event_date,photo_url,created_at")
      .eq("household_id", household.id)
      .order("created_at", { ascending: false });
    if (loadError) setError("Chưa tải được nội dung Gia đình. Hãy kiểm tra migration Supabase: " + loadError.message);
    else {
      setPosts(data || []);
      const ids = [...new Set((data || []).map(item => item.author_id))];
      if (ids.length) {
        const { data: names } = await supabase.from("households").select("created_by,name").in("created_by", ids);
        setAuthorNames(Object.fromEntries((names || []).map(item => [item.created_by, item.name])));
      }
      setError("");
    }
    setLoading(false);
  }, [household?.id]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  async function publish(event) {
    event.preventDefault();
    if ((!text.trim() && !photo) || !userId || busy) return;
    if (photo && (!photo.type.startsWith("image/") || photo.size > 10 * 1024 * 1024)) { setError("Ảnh phải nhỏ hơn 10 MB và đúng định dạng ảnh."); return; }
    setBusy(true);
    setError("");
    let photoUrl = null;
    let storagePath = null;
    if (photo) {
      const ext = (photo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      storagePath = `household-family/${household.id}/${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("memories").upload(storagePath, photo, { contentType: photo.type, upsert: false });
      if (uploadError) { setError("Không tải được ảnh: " + uploadError.message); setBusy(false); return; }
      photoUrl = supabase.storage.from("memories").getPublicUrl(storagePath).data.publicUrl;
    }
    const { error: saveError } = await supabase.from("household_family_posts").insert({
      household_id: household.id,
      author_id: userId,
      kind: section === "dates" ? "date" : section === "stories" ? "story" : "message",
      body: text.trim() || "📷 Khoảnh khắc gia đình",
      photo_url: photoUrl,
      event_date: section === "dates" ? eventDate || null : null,
    });
    if (saveError) {
      if (storagePath) await supabase.storage.from("memories").remove([storagePath]);
      setError("Không thể lưu: " + saveError.message);
    } else { setText(""); setPhoto(null); setEventDate(""); await loadPosts(); }
    setBusy(false);
  }

  const currentKind = section === "dates" ? "date" : section === "stories" ? "story" : "message";
  const filtered = posts.filter(post => post.kind === currentKind);
  const formatDate = value => value ? new Date(value).toLocaleDateString("vi-VN") : "";

  return (
    <section className="hs-family">
      {section === "overview" ? (
        <>
          <div className="hs-family-hero">
            <h1>♡ Gia đình</h1>
            <p>Những điều nhỏ bé, yêu thương dài lâu.</p>
            <strong>{household.name || "Nhà của mình"}</strong>
          </div>
          <div className="hs-family-shortcuts">
            {SECTIONS.map(([key, title, description]) => (
              <button type="button" key={key} onClick={() => setSection(key)}>
                <strong>{title}</strong><small>{description}</small><span>›</span>
              </button>
            ))}
          </div>
          <h2>Hoạt động gần đây</h2>
          {loading ? <p>Đang tải...</p> : posts.length === 0 ? <p>Chưa có lời nhắn hay câu chuyện nào. Hãy tạo kỷ niệm đầu tiên!</p> : (
            <div className="hs-family-feed">{posts.slice(0, 5).map(post => (
              <FamilyPost key={post.id} post={post} userId={userId} authorName={authorNames[post.author_id]} />
            ))}</div>
          )}
        </>
      ) : (
        <>
          <button className="hs-family-back" type="button" onClick={() => setSection("overview")}>← Gia đình</button>
          <h1>{SECTIONS.find(item => item[0] === section)?.[1]}</h1>
          <form className="hs-family-composer" onSubmit={publish}>
            <textarea required maxLength={3000} value={text} onChange={event => setText(event.target.value)}
              placeholder={section === "dates" ? "Ngày này có ý nghĩa gì với gia đình?" : section === "stories" ? "Kể một câu chuyện đáng nhớ..." : "Chia sẻ điều bạn muốn gửi đến gia đình..."} />
            <label className="hs-family-photo-picker">📷 Đính kèm ảnh
              <input type="file" accept="image/*" onChange={event => setPhoto(event.target.files?.[0] || null)} />
            </label>
            {photoPreview && <div className="hs-family-photo-preview"><img src={photoPreview} alt="Xem trước ảnh đính kèm" /><button type="button" onClick={() => setPhoto(null)}>Bỏ ảnh</button></div>}
            {section === "dates" && <label>Ngày kỷ niệm <input type="date" required value={eventDate} onChange={event => setEventDate(event.target.value)} /></label>}
            <button type="submit" disabled={busy || (!text.trim() && !photo) || (section === "dates" && !eventDate)}>{busy ? "Đang lưu..." : "Đăng vào Nhà"}</button>
          </form>
          {loading ? <p>Đang tải...</p> : filtered.length === 0 ? <p>Chưa có nội dung nào trong mục này.</p> : (
            <div className="hs-family-feed">{filtered.map(post => (
              <FamilyPost key={post.id} post={post} userId={userId} authorName={authorNames[post.author_id]} />
            ))}</div>
          )}
        </>
      )}
      {error && <p role="alert" className="hs-family-error">{error}</p>}
    </section>
  );
}
