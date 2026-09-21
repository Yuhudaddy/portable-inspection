// 鋼筋籠照片（01 營造廠查驗、06 施工紀錄共用，在 bar-sizes.js 之後、工具 script 之前載入）。
// 最多 3 張：匯入時縮到長邊 1600 px、JPEG 0.8 存成 data URL（一張約 200～400 KB，草稿的 localStorage
// 與 JSON 都帶得動）；點照片補備註，PDF 印在照片上方當小標題；「×」是兩段式刪除（同 02／03 的構件）。
// PDF 另起一頁：左欄編號、右欄照片，三列各占頁高 1/3，沒照片的列留空格。
const CAGE_PHOTO_LIMIT = 3;
const CAGE_PHOTO_MAX_EDGE = 1600;
const CAGE_PHOTO_QUALITY = 0.8;

const cagePhotoText = value => String(value ?? "").trim();
const isCagePhotoData = value => typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(value);

// 草稿或 JSON 讀回來的照片：只留合法的 data URL，最多 3 張
function normalizeCagePhotos(source) {
  return (Array.isArray(source) ? source : [])
    .filter(photo => photo && isCagePhotoData(photo.data))
    .slice(0, CAGE_PHOTO_LIMIT)
    .map(photo => ({ data: photo.data, caption: cagePhotoText(photo.caption) }));
}

const exportCagePhotos = photos => (photos || []).map((photo, index) => ({ no: index + 1, caption: photo.caption || null, image_data_url: photo.data }));
const importCagePhotos = records => normalizeCagePhotos((Array.isArray(records) ? records : []).map(record => ({ data: record?.image_data_url ?? record?.data, caption: record?.caption })));

// 檔案 → 縮圖 data URL。先用 FileReader 讀成 data URL（各頁 CSP 的 img-src 只放行 self 與 data:，
// 不能用 blob: URL），再交給 <img> 解碼（瀏覽器會套 EXIF 方向），最後畫到 canvas 縮到長邊 1600 px。
function loadCagePhotoImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("無法讀取照片"));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("無法讀取照片"));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function compressCagePhoto(file) {
  const image = await loadCagePhotoImage(file);
  const scale = Math.min(1, CAGE_PHOTO_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff"; // PNG 透明底轉 JPEG 時補白
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", CAGE_PHOTO_QUALITY);
}

const CAGE_PHOTO_TRASH_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>`;
const CAGE_PHOTO_UPLOAD_SVG = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5-5-8 8"/><path d="M14 13l-4 4"/></svg>`;

function cagePhotosHtml(photos) {
  if (!photos.length) {
    return `<button class="photo-upload-box" type="button" data-photo-pick>${CAGE_PHOTO_UPLOAD_SVG}<strong>Image Upload</strong><span>點擊從相簿匯入照片（最多 ${CAGE_PHOTO_LIMIT} 張）</span></button>`;
  }
  return `<div class="photo-grid">${photos.map((photo, index) => `
    <figure class="photo-item">
      <figcaption><span class="photo-no">${index + 1}</span><span class="photo-caption ${photo.caption ? "" : "is-empty"}">${escapeHtml(photo.caption) || "點照片補備註"}</span></figcaption>
      <div class="photo-item-wrap">
        <button class="photo-item-image" type="button" data-photo-caption="${index}" aria-label="第 ${index + 1} 張照片，點擊補備註"><img src="${photo.data}" alt="鋼筋籠照片 ${index + 1}" /></button>
        <button class="two-step-delete photo-delete" type="button" data-photo-remove="${index}" aria-label="刪除照片"><span class="two-step-x" aria-hidden="true">×</span>${CAGE_PHOTO_TRASH_SVG}</button>
      </div>
    </figure>`).join("")}</div>`;
}

// 列印：固定三列，沒照片的列留空格；備註當小標題印在照片上方
function cagePhotosPrintHtml(photos) {
  const rows = Array.from({ length: CAGE_PHOTO_LIMIT }, (_, index) => {
    const photo = photos[index];
    const body = photo
      ? `${photo.caption ? `<strong class="print-photo-caption">${escapeHtml(photo.caption)}</strong>` : ""}<div class="print-photo-image"><img src="${photo.data}" alt="鋼筋籠照片 ${index + 1}" /></div>`
      : "";
    return `<div class="print-photo-no">${index + 1}</div><div class="print-photo-cell">${body}</div>`;
  }).join("");
  return `<section class="print-section print-photo-section"><h2>鋼筋籠照片</h2><div class="print-photo-grid">${rows}</div></section>`;
}

function renderCagePhotos(photos) {
  const list = document.querySelector("#cage-photo-list");
  const addButton = document.querySelector("#cage-photo-add");
  if (list) list.innerHTML = cagePhotosHtml(photos);
  if (addButton) addButton.disabled = photos.length >= CAGE_PHOTO_LIMIT;
}

// 事件：虛線框／「＋匯入」開相簿；× 兩段式刪除；點照片開備註對話框。onChange 由工具負責重畫與存草稿。
function bindCagePhotosUi({ getPhotos, onChange }) {
  const list = document.querySelector("#cage-photo-list");
  const input = document.querySelector("#cage-photo-input");
  const addButton = document.querySelector("#cage-photo-add");
  const dialog = document.querySelector("#cage-photo-dialog");
  const captionInput = document.querySelector("#cage-photo-caption");
  const preview = document.querySelector("#cage-photo-preview");
  if (!list || !input) return;
  let editing = null;
  let armed = null;
  const disarm = () => {
    if (!armed) return;
    clearTimeout(armed.timer);
    armed.button.classList.remove("is-armed");
    armed.button.setAttribute("aria-label", "刪除照片");
    armed = null;
  };
  const pick = () => {
    if (getPhotos().length >= CAGE_PHOTO_LIMIT) return;
    input.value = "";
    input.click();
  };
  input.addEventListener("change", async () => {
    const files = [...input.files].slice(0, Math.max(0, CAGE_PHOTO_LIMIT - getPhotos().length));
    for (const file of files) {
      try { getPhotos().push({ data: await compressCagePhoto(file), caption: "" }); }
      catch (error) { /* 讀不到的檔案略過 */ }
    }
    input.value = "";
    onChange();
  });
  addButton?.addEventListener("click", pick);
  list.addEventListener("click", event => {
    const remove = event.target.closest("[data-photo-remove]");
    const caption = event.target.closest("[data-photo-caption]");
    if (event.target.closest("[data-photo-pick]")) { pick(); return; }
    if (remove) {
      if (armed?.button === remove) {
        const index = Number(remove.dataset.photoRemove);
        disarm();
        getPhotos().splice(index, 1);
        onChange();
        return;
      }
      disarm();
      remove.classList.add("is-armed");
      remove.setAttribute("aria-label", "再點一次確認刪除");
      armed = { button: remove, timer: setTimeout(disarm, 4000) };
      return;
    }
    if (caption && dialog) {
      editing = Number(caption.dataset.photoCaption);
      const photo = getPhotos()[editing];
      if (!photo) return;
      if (preview) preview.src = photo.data;
      captionInput.value = photo.caption;
      dialog.showModal();
      captionInput.focus();
    }
  });
  document.addEventListener("click", event => { if (armed && !event.target.closest("[data-photo-remove]")) disarm(); });
  dialog?.querySelector("form")?.addEventListener("submit", event => {
    event.preventDefault();
    const photo = editing === null ? null : getPhotos()[editing];
    if (photo) photo.caption = cagePhotoText(captionInput.value);
    editing = null;
    dialog.close();
    onChange();
  });
}
