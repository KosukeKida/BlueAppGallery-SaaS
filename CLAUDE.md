# BlueAppGallery-SaaS — エージェント指示書

## プロジェクト概要

- **製品名**: Blue App Gallery（SaaS版）
- **技術スタック**: Next.js 16 + Supabase + shadcn/ui
- **役割**: チーム管理、リース制御、Usage Insights、スケジュール起動停止、プロモーション管理
- **通信先**: BlueAppGallery-in-Snowflake（Operator）と Snowflake SQL API（JWT）で連携
- **収益モデル**: エンドユーザー無料。プロモーションカード（広告）、募金募集、技術提供で収益化

## 権威ある仕様書

- `docs/SEPARATION-SPEC.md` — 全ての設計判断の唯一の情報源
- **同じ仕様書が Operator リポジトリにも存在する**。矛盾してはならない
- 迷ったら、コードを書く前に必ず仕様書を読むこと
- **コーディネーターリポジトリ** (`C:\Users\KosukeKida\SnowflakeAppGallery`) が仕様の正本を管理

## コーディネーターとの関係

- 開発計画・仕様管理はコーディネーターリポジトリ（SnowflakeAppGallery）が統括
- コーディネーターの CLAUDE.md / docs/ に全体方針・クロスリポ仕様がある
- このリポジトリは SaaS 側の実装に責任を持つ

## 開発ワークフロー（必須）

全ての機能・変更に対して、以下の厳密な順序で進める：

### 1. 仕様確認
- `docs/SEPARATION-SPEC.md` の該当セクションを読む
- 仕様が曖昧または不足している場合は**作業を止めてユーザーに確認する** — 推測しない

### 2. テスト先行
- **実装の前に**テストケースを作成する
- テストの対象: 正常系、異常系
- API ルート: Supabase/Snowflake をモックした統合テスト
- UI コンポーネント: React Testing Library によるコンポーネントテスト

### 3. 実装
- テストを通すように実装する
- 既存パターンに従う
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
- Supabase `leases` テーブル = Operator の `core.lease_status` のキャッシュ + UI メタデータ
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

## クロスリポジトリ整合性チェック

機能完了時に必ず確認すること：
1. `sql-api-client.ts` のプロシージャ名が Operator の `api.*` スキーマと完全一致していること
2. `types.ts` のレスポンス型定義が Operator の VARIANT 戻り値形式と一致していること
3. `app_type` 値（`native_app`, `streamlit_cp`, `streamlit_wh`）が両リポで一貫していること
4. リースのライフサイクル（start → extend → stop → expire）が Operator の実装と一致すること
5. Gallery のコードが `core.*` や `config.*` プロシージャを直接呼び出していないこと
