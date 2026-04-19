[README.md](https://github.com/user-attachments/files/26867920/README.md)
# Pageshift

本を通じて学びを広げることをテーマにした、日本語UIの読書ポートフォリオサイトです。  
ダークで知的なトーンを軸に、ヒーローセクション、縦スクロール連動の横スライド、Open Library API 連携、ローディングとエラー時のフォールバックまで含めて実装しています。

## ファイル構成

```text
.
├─ index.html
├─ styles.css
├─ script.js
└─ README.md
```

### 各ファイルの役割

- `index.html`
  サイト全体の構造です。ヒーロー、横スライド4パネル、下部の知識セクション3つ、カードテンプレートを定義しています。
- `styles.css`
  ダークベースのビジュアル、横スライド演出、レスポンシブ、ローディング用スケルトン、フォールバックUIをまとめています。
- `script.js`
  Open Library API の取得処理、レスポンス整形、重複除去、セッションキャッシュ、横スクロール制御、進行表示を管理しています。
- `README.md`
  起動方法、デプロイ方法、API方針、構成意図、拡張案をまとめています。

## ローカルでの起動方法

静的サイトなのでビルドは不要です。ローカルサーバーで開くのが簡単です。

### 方法1: Python を使う

```bash
python -m http.server 4173
```

その後、ブラウザで `http://localhost:4173` を開いてください。

### 方法2: Node.js 環境がある場合

```bash
npx serve .
```

## Vercel デプロイ方法

### GitHub 連携

1. このディレクトリを GitHub リポジトリに push します。
2. Vercel で `New Project` を選び、対象リポジトリを import します。
3. Framework Preset は `Other` のままで問題ありません。
4. Build Command は空欄、Output Directory も空欄でそのままデプロイできます。

### Vercel CLI

```bash
vercel
```

初回の質問には以下の方針で回答すれば動きます。

- Framework: `Other`
- Build Command: 未設定
- Output Directory: 未設定

## 今回の API 取得方針

### 使用 API

- 書籍検索: `https://openlibrary.org/search.json`
- 表紙画像: `https://covers.openlibrary.org/b/id/{cover_i}-M.jpg`
- 書籍リンク: `https://openlibrary.org{key}`

### 実装上の方針

- 各カテゴリごとに検索語を変えています。
  - ビジネス書: `business management leadership`
  - 学習参考書: `"study guide" textbook learning`
  - ミステリー小説: `mystery detective fiction`
  - 注目書籍: `innovation creativity learning` + `sort=new`
- `fields` を明示し、必要な最小限の項目だけ取得しています。
  - `key`
  - `title`
  - `author_name`
  - `cover_i`
  - `first_publish_year`
  - `edition_count`
- API レスポンスはそのまま描画せず、`script.js` 内で整形してから表示しています。
- タイトルや著者名が欠けた場合は日本語のフォールバック文言を出します。
- 表紙画像がない場合は、カード内で崩れない代替デザインを表示します。
- 同じカテゴリへの再取得を減らすため、メモリキャッシュと `sessionStorage` の簡易キャッシュを併用しています。
- エラー時は無言で失敗させず、カテゴリごとに意味のあるメッセージを表示します。

### 「最新ランキング風セクション」について

このセクションは売上ランキングではありません。  
Open Library の新着系検索結果をもとにした「新しく出会うための棚」として設計しています。売上順位のように断定しない表現にして、誤解を避けています。

## 構成意図

- **静的フロントエンド中心**
  デプロイを簡単にしつつ、Vercel へそのまま載せやすい構成を優先しました。
- **横スライドはデスクトップ中心**
  縦スクロールと横移動を組み合わせて印象を強くしつつ、モバイルでは通常の縦積みにフォールバックして破綻を防いでいます。
- **本番っぽい安定性を意識**
  ローディング、エラー、表紙欠落、軽いキャッシュといった実運用で気になる部分を先に実装しています。

## Vercel Function を今回は使っていない理由

今回はまず「静的配信で完成度高く動くこと」を優先し、ブラウザから直接 Open Library API を参照する構成にしています。  
この方法なら構成が軽く、GitHub と Vercel の連携だけで公開しやすいのが利点です。

将来的には次の理由で Vercel Function を追加する価値があります。

- API リクエストのキャッシュ制御をより強くしたい
- 将来の検索条件をサーバー側で管理したい
- User-Agent や追加ヘッダーなどを安定して付与したい
- レート制御やログ収集を入れたい

## 今後の改善案

- カテゴリごとの検索条件を UI から切り替えられるようにする
- 気になった本を保存できるローカル本棚機能を追加する
- Vercel Function を挟み、サーバー側キャッシュで API 負荷をさらに下げる
- Intersection Observer を併用して、画面に近づいたカテゴリから順次読み込む
- 日本語書籍比率を高めるために、検索語や subject ベースの調整を加える
- アクセシビリティ監査と Lighthouse ベースの最適化を追加する
