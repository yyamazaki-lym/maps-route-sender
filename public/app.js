const originInput = document.getElementById("origin");
const destInput = document.getElementById("destination");
const dateInput = document.getElementById("dateInput");
const hourSelect = document.getElementById("hourSelect");
const minuteSelect = document.getElementById("minuteSelect");
const datetimeSelects = document.getElementById("datetimeSelects");
const timeTypeRadios = document.querySelectorAll('input[name="timeType"]');
const sendBtn = document.getElementById("sendBtn");
const openBtn = document.getElementById("openBtn");
const sendStatus = document.getElementById("sendStatus");
const subscribeBtn = document.getElementById("subscribeBtn");
const subscribeStatus = document.getElementById("subscribeStatus");
const deviceNameInput = document.getElementById("deviceName");
const deviceListSection = document.getElementById("deviceList");
const devicesUl = document.getElementById("devices");
const mapArea = document.getElementById("mapArea");
const mapFrame = document.getElementById("mapFrame");

// 時・分のプルダウンを生成
for (let h = 0; h < 24; h++) {
  const opt = document.createElement("option");
  opt.value = h;
  opt.textContent = String(h).padStart(2, "0");
  hourSelect.appendChild(opt);
}
for (let m = 0; m < 60; m += 5) {
  const opt = document.createElement("option");
  opt.value = m;
  opt.textContent = String(m).padStart(2, "0");
  minuteSelect.appendChild(opt);
}

// 「今すぐ」以外を選んだらプルダウンを表示
timeTypeRadios.forEach((r) => {
  r.addEventListener("change", () => {
    const isNow = document.querySelector('input[name="timeType"]:checked').value === "now";
    datetimeSelects.style.display = isNow ? "none" : "flex";
    if (!isNow && !dateInput.value) {
      const now = new Date();
      dateInput.value = now.toISOString().slice(0, 10);
      hourSelect.value = now.getHours();
      minuteSelect.value = Math.round(now.getMinutes() / 5) * 5 % 60;
    }
  });
});

// 選択された日時をDateオブジェクトで取得
function getSelectedDatetime() {
  if (!dateInput.value) return null;
  return new Date(
    dateInput.value + "T" +
    String(hourSelect.value).padStart(2, "0") + ":" +
    String(minuteSelect.value).padStart(2, "0")
  );
}

// Google Maps経路URLを生成（日時対応）
function buildMapsUrl() {
  const origin = originInput.value.trim();
  const destination = destInput.value.trim();
  const travelMode = document.querySelector('input[name="travelMode"]:checked').value;
  const timeType = document.querySelector('input[name="timeType"]:checked').value;
  if (!origin || !destination) return null;

  if (timeType !== "now") {
    const dt = getSelectedDatetime();
    if (dt) {
      const dirflg = { transit: "r", driving: "d", walking: "w", bicycling: "b" }[travelMode] || "r";
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const yyyy = dt.getFullYear();
      const hours = dt.getHours();
      const minutes = String(dt.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      const h12 = hours % 12 || 12;
      const ttype = timeType === "arrive" ? "arr" : "dep";

      return (
        `https://www.google.com/maps?` +
        `saddr=${encodeURIComponent(origin)}` +
        `&daddr=${encodeURIComponent(destination)}` +
        `&dirflg=${dirflg}` +
        `&ttype=${ttype}` +
        `&date=${mm}/${dd}/${yyyy}` +
        `&time=${h12}:${minutes}${ampm}`
      );
    }
  }

  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    `&travelmode=${travelMode}`
  );
}

// iframe埋め込み用URLを生成
function buildEmbedUrl() {
  const origin = originInput.value.trim();
  const destination = destInput.value.trim();
  const travelMode = document.querySelector('input[name="travelMode"]:checked').value;
  if (!origin || !destination) return null;
  const dirflg = { transit: "r", driving: "d", walking: "w", bicycling: "b" }[travelMode] || "r";
  return (
    `https://www.google.com/maps?` +
    `saddr=${encodeURIComponent(origin)}` +
    `&daddr=${encodeURIComponent(destination)}` +
    `&dirflg=${dirflg}` +
    `&output=embed`
  );
}

// 地図プレビューを表示
function showMapPreview() {
  const embedUrl = buildEmbedUrl();
  if (embedUrl) {
    mapFrame.src = embedUrl;
    mapArea.hidden = false;
  }
}

// このブラウザで開くボタン
openBtn.addEventListener("click", () => {
  const url = buildMapsUrl();
  if (url) window.open(url, "_blank");
});

// ステータス表示ヘルパー
function showStatus(el, message, type) {
  el.textContent = message;
  el.className = `status ${type}`;
  el.hidden = false;
}

// デバイス一覧を取得・表示
async function loadDevices() {
  try {
    const res = await fetch("/api/devices");
    const devices = await res.json();
    if (devices.length > 0) {
      deviceListSection.hidden = false;
      devicesUl.innerHTML = devices
        .map((d) => `<li>${d.deviceName} (${new Date(d.registeredAt).toLocaleString("ja-JP")})</li>`)
        .join("");
      sendBtn.disabled = false;
    } else {
      sendBtn.disabled = true;
    }
  } catch {
    // サーバーに到達できない場合は無視
  }
}

// Push通知を購読
subscribeBtn.addEventListener("click", async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    showStatus(subscribeStatus, "このブラウザはPush通知に対応していません", "error");
    return;
  }

  try {
    showStatus(subscribeStatus, "登録中...", "info");

    // Service Worker登録
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // VAPID公開鍵を取得
    const keyRes = await fetch("/api/vapid-public-key");
    const { publicKey } = await keyRes.json();

    // Base64をUint8Arrayに変換
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // Push購読
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // サーバーに登録
    const deviceName = deviceNameInput.value.trim() || "デバイス";
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, deviceName }),
    });
    const data = await res.json();

    showStatus(subscribeStatus, `「${deviceName}」を登録しました`, "success");
    loadDevices();
  } catch (err) {
    showStatus(subscribeStatus, `登録失敗: ${err.message}`, "error");
  }
});

// 経路を送信
sendBtn.addEventListener("click", async () => {
  const origin = originInput.value.trim();
  const destination = destInput.value.trim();
  const travelMode = document.querySelector('input[name="travelMode"]:checked').value;

  if (!origin || !destination) {
    showStatus(sendStatus, "出発地と目的地を入力してください", "error");
    return;
  }

  try {
    sendBtn.disabled = true;
    showStatus(sendStatus, "送信中...", "info");

    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination, travelMode }),
    });
    const data = await res.json();

    if (res.ok) {
      const sent = data.results.filter((r) => r.status === "sent").length;
      showStatus(sendStatus, `${sent}台のデバイスに送信しました`, "success");
      showMapPreview();
    } else {
      showStatus(sendStatus, data.error || "送信に失敗しました", "error");
    }
  } catch (err) {
    showStatus(sendStatus, `送信失敗: ${err.message}`, "error");
  } finally {
    sendBtn.disabled = false;
  }
});

// Base64 URL → Uint8Array変換
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 初期化
loadDevices();
