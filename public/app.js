const originInput = document.getElementById("origin");
const destInput = document.getElementById("destination");
const sendBtn = document.getElementById("sendBtn");
const openBtn = document.getElementById("openBtn");
const sendStatus = document.getElementById("sendStatus");
const subscribeBtn = document.getElementById("subscribeBtn");
const subscribeStatus = document.getElementById("subscribeStatus");
const deviceNameInput = document.getElementById("deviceName");
const deviceListSection = document.getElementById("deviceList");
const devicesUl = document.getElementById("devices");

// Google Maps経路URLを生成
function buildMapsUrl() {
  const origin = originInput.value.trim();
  const destination = destInput.value.trim();
  const travelMode = document.querySelector('input[name="travelMode"]:checked').value;
  if (!origin || !destination) return null;
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    `&travelmode=${travelMode}`
  );
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
