// 範例輸出檢視頁：依 ?file=<範例名稱> 讀 examples/pages/manifest.json，逐頁放圖片。
// 「←」等同瀏覽器的上一頁；若是直接開這個網址（沒有上一頁），就回到該範例所屬的工具頁。
(function () {
  const name = new URLSearchParams(location.search).get("file") || "";
  const pages = document.getElementById("example-pages");
  const status = document.getElementById("example-status");
  const back = document.getElementById("example-back");
  const pdf = document.getElementById("example-pdf");

  back.addEventListener("click", event => {
    if (history.length <= 1) return; // 沒有上一頁：讓 href 的工具頁生效
    event.preventDefault();
    history.back();
  });

  fetch("./examples/pages/manifest.json")
    .then(response => response.json())
    .then(manifest => {
      const entry = Object.prototype.hasOwnProperty.call(manifest, name) ? manifest[name] : null;
      if (!entry) throw new Error("找不到範例");
      document.title = `${entry.title}｜範例輸出｜Portable Inspection`;
      back.href = `./${entry.back}`;
      pdf.href = `./examples/${name}.pdf`;
      pdf.hidden = false;
      status.remove();
      for (let index = 1; index <= entry.pages; index += 1) {
        const image = document.createElement("img");
        image.className = "example-page";
        image.src = `./examples/pages/${name}-${index}.webp`;
        image.alt = `${entry.title} 範例輸出 第 ${index} 頁（共 ${entry.pages} 頁）`;
        image.width = entry.width;
        image.height = entry.height;
        image.loading = index > 2 ? "lazy" : "eager";
        image.decoding = "async";
        pages.appendChild(image);
      }
    })
    .catch(() => { status.textContent = "找不到這份範例，請回到工具頁重新開啟。"; });

})();
