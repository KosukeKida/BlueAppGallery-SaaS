# BlueAppGallery-SaaS — エージェント指示書

## プロジェクト概要

- **製品名**: Blue App Gallery（SaaS版）
- **技術スタック**: Next.js 16 + Supabase + shadcn/ui + Stripe
- **役割**: チーム管理、リース制御、課金、Usage Insights ダッシュボード
- **通信先**: BlueAppGallery-in-Snowflake（Operator）と Snowflake SQL API（JWT）で連携

## 権威ある仕様書

- `docs/SEPARATION-SPEC.md` — 全ての設計判断の唯一の情報源
- **同じ仕様書が Operator リポジトリにも存在する**。矛盾してはならない
- 迷ったら、コードを書く前に必ず仕様書を読むこと

## 参照用コードベース（読み取り専用）

元のモノリポ `C:\Users\KosukeKida\SnowflakeAppGallery` に**現行の動作実装**がある（`saas/` ディレクトリ）。
以下を参照するために使う：
- 既存のパターン、コンポーネント構造、API ルート
- Supabase スキーマと RLS ポリシー
- Snowflake SQL API クライアント（`saas/src/lib/snowflake/`）
- プロジェクトメモリに記録された既知の問題点

**参照リポジトリは変更しないこと。** このリポジトリ内のファイルのみを変更する。

## 開発ワークフロー（必須）

全ての機能・変更に対して、以下の厳密な順序で進める：

### 1. 仕様確認
- `docs/SEPARATION-SPEC.md` の該当セクションを読む
- 仕様が曖昧または不足している場合は**作業を止めてユーザーに確認する** — 推測しない
- 実装内容の要約をコメントまたは PR に記載する

### 2. テスト先行
- **実装の前に**テストケースを作成する
- テストの対象: 正常系、異常系、tier 境界条件
- API ルート: Supabase/Snowflake をモックした統合テスト
- UI コンポーネント: React Testing Library によるコンポーネントテスト
- tier ロジック: 全 tier 組み合わせのユニットテスト

### 3. 実装
- テストを通すように実装する
- 参照コードベースの既存パターンに従う
- 変更は最小限かつ焦点を絞る

### 4. 検証
- 全テストを実行
- 既存機能のリグレッションがないことを確認
- 実装が仕様と一致していることを確認

## アーキテクチャルール

### Operator との API 契約
- Snowflake との全通信は `src/lib/snowflake/sql-api-client.ts` 経由
- `api.*` スキーマのプロシージャのみ呼び出す（`core.*` や `config.*` は直接呼ばない）
- Operator API 一覧: `api.launch()`, `api.stop()`, `api.extend()`, `api.get_status()`,
  `api.heartbeat()`, `api.list_apps()`, `api.get_endpoints()`, `api.get_version()`
- 全レスポンス形式: `{ api_version, status: "OK"|"ERROR", data?, error? }`

### Tier 制限
- **全ての tier 制限はこのリポジトリで実施する** — Operator は tier を知らない
- 制限項目: リース時間、接続数、メンバー数、機能ゲート
- 正確な数値は `docs/SEPARATION-SPEC.md` セクション 3.1 を参照
- Free tier ユーザーには Usage Insights をロックされたプレビューで表示（Pro へのアップセル）

### app_type の処理
- `native_app`: Launch → Operator `api.launch()` → エンドポイントポーリング → Open
- `streamlit_cp`: Launch → Operator `api.launch()` → CP 起動 → `endpoint_url` で Open
- `streamlit_wh`: Launch/リース不要 — Open ボタンで `endpoint_url` に直リンク

### カード操作（Gallery ページ）
- **停止中アプリのカード押下** → アプリ詳細ダイアログ（説明 + Launch ボタン）
- **起動中アプリの Open ボタン** → エンドポイントへの直リンク
- **起動中アプリのカード押下** → アプリ管理パネル（Extend / Stop / Schedule）
- **`streamlit_wh` カード押下** → アプリ詳細（説明のみ、起動停止なし）

### データ所有権
- Supabase `leases` テーブル = Operator の `core.lease_status` のキャッシュ + tier メタデータ
- Operator がリース状態の正本
- Gallery はポーリングで同期（10秒クイック / 60秒フル）

## コードスタイル

- 言語: TypeScript（strict モード）
- UI: shadcn/ui コンポーネント、Tailwind CSS
- 状態管理: React hooks + Server Components を可能な限り使用
- API: Next.js App Router ルートハンドラ
- コメント: 英語
- **アプリケーション UI テキスト: 全て英語** — ボタンラベル、ヘッダー、メッセージ、プレースホルダ、エラーメッセージ
- ユーザーとのコミュニケーション: 日本語

## ファイル構成（目標）

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── gallery/page.tsx          # Gallery カードグリッド
│   │   ├── leases/page.tsx           # リース管理
│   │   ├── usage-insights/page.tsx   # Usage Insights（Pro以上）
│   │   └── settings/
│   │       ├── general/
│   │       ├── connections/
│   │       ├── catalog/
│   │       ├── members/
│   │       └── audit-log/
│   └── api/
│       ├── leases/
│       ├── catalog/
│       ├── connections/
│       ├── members/
│       ├── usage-insights/
│       └── auth/
├── components/
│   ├── gallery/
│   │   ├── app-card.tsx
│   │   ├── app-management-panel.tsx   # 新規: 起動中アプリの操作パネル
│   │   └── launch-dialog.tsx
│   └── usage-insights/
│       ├── kpi-cards.tsx
│       ├── app-ranking.tsx
│       ├── user-ranking.tsx
│       └── trend-chart.tsx
├── lib/
│   ├── snowflake/
│   │   ├── sql-api-client.ts         # Operator API 呼び出し
│   │   └── types.ts                  # API Contract 型定義
│   ├── lease-engine.ts               # リース + tier 制限
│   ├── tier.ts                       # Tier 定義 + チェックロジック
│   └── supabase/
└── __tests__/                        # テストファイル（src/ のミラー構造）
```

## クロスリポジトリ整合性チェック

機能完了時に必ず確認すること：
1. `sql-api-client.ts` のプロシージャ名が Operator の `api.*` スキーマと完全一致していること
2. `types.ts` のレスポンス型定義が Operator の VARIANT 戻り値形式と一致していること
3. `app_type` 値（`native_app`, `streamlit_cp`, `streamlit_wh`）が両リポで一貫していること
4. リースのライフサイクル（start → extend → stop → expire）が Operator の実装と一致すること
5. Gallery のコードが `core.*` や `config.*` プロシージャを直接呼び出していないこと
