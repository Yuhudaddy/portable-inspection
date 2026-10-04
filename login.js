// 登入頁：把 ?next= 帶進表單，並攔截送出改用 fetch，讓閘門動畫有地方演。
// 沒有 JavaScript 時表單照常 POST（伺服器回 303），所以這支檔案只做加強，不做必要的事。
(() => {
  const stage = document.getElementById("gate-stage");
  const form = document.getElementById("login-form");
  const error = document.getElementById("login-error");
  const status = document.getElementById("login-status");
  const submit = document.getElementById("login-submit");
  const username = document.getElementById("login-username");
  const password = document.getElementById("login-password");
  const toggle = document.querySelector(".password-toggle");
  const arm = stage.querySelector(".gate-arm");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const OPEN_HOLD_MS = reduceMotion ? 250 : 950; // 桿子升起後停一下再換頁

  // 只接受站內路徑（可列印 ASCII，擋掉會被網址解析器吃掉的 Tab 與換行）；伺服器端還會再驗一次。
  const safeNext = value => (typeof value === "string" && /^\/(?![/\\])[\x21-\x7e]*$/.test(value) ? value : "/");
  const params = new URLSearchParams(location.search);
  form.elements.next.value = safeNext(params.get("next"));

  const setState = name => {
    if (name === "denied" && stage.dataset.state === "denied") {
      stage.dataset.state = "idle"; // 連續被擋下時重新觸發彈跳動畫
      void stage.offsetWidth;
    }
    stage.dataset.state = name;
  };

  const showError = message => {
    error.textContent = message;
    error.classList.add("is-visible");
  };

  const clearError = () => {
    error.textContent = "";
    error.classList.remove("is-visible");
  };

  const busy = on => {
    submit.disabled = on;
    submit.textContent = on ? "確認中…" : "開門";
    if (on) setState("checking");
  };

  const deny = (message, retypePassword) => {
    busy(false);
    setState("denied");
    showError(message);
    if (retypePassword) {
      password.value = "";
      password.focus();
    }
  };

  const openGate = next => {
    setState("open");
    submit.textContent = "請進";
    status.textContent = "核對完成，閘門已開。";
    setTimeout(() => location.assign(next), OPEN_HOLD_MS);
  };

  // 被擋下的彈跳播完就回到「鎖著」；減少動態時沒有動畫，維持 denied 的靜態樣式
  arm.addEventListener("animationend", () => {
    if (stage.dataset.state === "denied") setState("idle");
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submit.disabled) return;
    clearError();
    if (!username.value.trim() || !password.value) {
      // 還沒送出，不算被閘門擋下：只提示，並把游標放到第一個空欄位
      showError("請輸入帳號和密碼。");
      (username.value.trim() ? password : username).focus();
      return;
    }
    if (!navigator.onLine) {
      deny("目前沒有網路，登入需要連線。", false);
      return;
    }
    busy(true);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams(new FormData(form)),
        credentials: "same-origin"
      });
      if (response.ok) {
        const data = await response.json();
        openGate(safeNext(data.next));
        return;
      }
      if (response.status === 401) deny("帳號或密碼不對，閘門沒開。再試一次。", true);
      else if (response.status === 503) deny("登入尚未設定完成，請聯絡管理員。", false);
      else deny("登入暫時無法使用，請稍後再試。", false);
    } catch {
      deny("連不上網路，請確認訊號後再試。", false);
    }
  });

  toggle.addEventListener("click", () => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    toggle.textContent = show ? "隱藏" : "顯示";
    toggle.setAttribute("aria-pressed", String(show));
  });

  // 從上一頁（bfcache）回到這裡時，閘門要回到鎖著、按鈕要能再按
  addEventListener("pageshow", event => {
    if (!event.persisted) return;
    busy(false);
    setState("idle");
  });

  // 沒有 JavaScript 的流程由伺服器導回 ?e=1#login-error（:target 讓訊息顯示）。有 JavaScript 時
  // 改用同一套顯示，並拿掉網址上的 #，否則重試時 :target 會讓清空後的紅框一直撐著。
  if (params.get("e") === "1") {
    history.replaceState(null, "", location.pathname + location.search);
    setState("denied");
    showError("帳號或密碼不對，閘門沒開。再試一次。");
  } else if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    username.focus();
  }
})();
