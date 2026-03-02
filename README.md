# Maps Route Sender

Google Mapsの経路検索結果をWeb Push通知でスマートフォンに送信するツール。

PCで出発地・目的地を入力 → スマホにプッシュ通知 → タップでGoogle Mapsナビ開始。

## セットアップ

```bash
# 依存関係インストール
npm install

# VAPID鍵を生成
npm run generate-vapid

# .envファイルを作成して鍵を設定
cp .env.example .env
# 生成された VAPID_PUBLIC_KEY と VAPID_PRIVATE_KEY を .env に貼り付け

# サーバー起動
npm start
```

## 使い方

1. `npm start` でサーバーを起動
2. **スマホ**のブラウザで `http://<PCのIPアドレス>:3000` にアクセス
3. デバイス名を入力して「このデバイスで通知を受け取る」をタップ
4. **PC**のブラウザで `http://localhost:3000` にアクセス
5. 出発地・目的地を入力して「スマホに送信」をクリック
6. スマホにPush通知が届く → タップでGoogle Mapsが開く

## 技術スタック

- Node.js + Express
- Web Push API + Service Worker
- Google Maps URLスキーム（APIキー不要）
