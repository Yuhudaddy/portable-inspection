// 對話框表單共用（在各頁的工具 script 之前載入）。
//
// 必填欄位只在按下「確認」後才標紅：submit handler 先呼叫 validateDialogForm(form)，
// 不通過就 return；表單要加 novalidate，瀏覽器才不會自己跳原生提示泡泡。
// 紅框樣式見 glass.css 的 .form-validation-error 規則；對話框關閉時一律清掉。
function validateDialogForm(form) {
  const valid = form.checkValidity();
  form.classList.toggle("form-validation-error", !valid);
  return valid;
}

// close 事件不冒泡，用 capture 在 document 上一次接住所有 <dialog>
document.addEventListener("close", event => {
  event.target.querySelector?.("form")?.classList.remove("form-validation-error");
}, true);
