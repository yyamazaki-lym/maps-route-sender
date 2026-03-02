require("dotenv").config();
const express = require("express");
const webpush = require("web-push");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// VAPID鍵の設定
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error("VAPID鍵が設定されていません。以下のコマンドで生成してください:");
  console.error("  npm run generate-vapid");
  console.error("生成された値を .env ファイルに設定してください。");
  process.exit(1);
}

webpush.setVapidDetails(
  "mailto:example@example.com",
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

// 購読情報の保存（メモリ内）
const subscriptions = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// VAPID公開鍵をクライアントに提供
app.get("/api/vapid-public-key", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// Push通知の購読登録
app.post("/api/subscribe", (req, res) => {
  const { subscription, deviceName } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "subscriptionが必要です" });
  }
  const id = Buffer.from(subscription.endpoint).toString("base64").slice(-16);
  subscriptions.set(id, { subscription, deviceName: deviceName || "デバイス", registeredAt: new Date() });
  console.log(`デバイス登録: ${deviceName || "デバイス"} (合計: ${subscriptions.size})`);
  res.json({ id, message: "登録完了" });
});

// 登録済みデバイス一覧
app.get("/api/devices", (req, res) => {
  const devices = [];
  for (const [id, data] of subscriptions) {
    devices.push({ id, deviceName: data.deviceName, registeredAt: data.registeredAt });
  }
  res.json(devices);
});

// 経路をPush通知で送信
app.post("/api/send", async (req, res) => {
  const { origin, destination, travelMode, deviceId } = req.body;
  if (!origin || !destination) {
    return res.status(400).json({ error: "出発地と目的地が必要です" });
  }

  // Google Maps経路URL生成
  const mapsUrl =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    `&travelmode=${travelMode || "transit"}`;

  const payload = JSON.stringify({
    title: "経路案内",
    body: `${origin} → ${destination}`,
    url: mapsUrl,
    travelMode: travelMode || "transit",
  });

  // 送信対象のデバイスを決定
  const targets = deviceId
    ? [[deviceId, subscriptions.get(deviceId)]].filter(([, v]) => v)
    : Array.from(subscriptions);

  if (targets.length === 0) {
    return res.status(404).json({ error: "登録済みデバイスがありません" });
  }

  const results = [];
  for (const [id, data] of targets) {
    try {
      await webpush.sendNotification(data.subscription, payload);
      results.push({ id, status: "sent" });
    } catch (err) {
      console.error(`送信失敗 (${id}):`, err.message);
      // 410 = 購読が無効になった
      if (err.statusCode === 410) {
        subscriptions.delete(id);
      }
      results.push({ id, status: "failed", error: err.message });
    }
  }

  console.log(`経路送信: ${origin} → ${destination} (${results.length}デバイス)`);
  res.json({ mapsUrl, results });
});

app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
  console.log(`登録済みデバイス: ${subscriptions.size}`);
});
