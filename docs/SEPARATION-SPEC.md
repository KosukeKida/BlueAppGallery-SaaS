# Gallery / Operator 分離仕様書

> v1.0 Draft — 2026-03-12

---

## 1. 概要

Gallery（SaaS）と Operator（Native App）を責務分離し、**独立したリポジトリで開発可能にする**。
両者の疎通は Operator が公開する `api` スキーマのプロシージャで行う。

```
┌─────────────────────────────────┐     Snowflake SQL API (JWT)      ┌──────────────────────────────┐
│         Gallery (SaaS)          │ ──────────────────────────────── │    Operator (Native App)     │
│  Next.js + Supabase + Stripe   │          api.* calls             │  setup.sql + Streamlit UI    │
│                                 │                                  │                              │
│  ・チーム/メンバー管理          │                                  │  ・start / stop / extend     │
│  ・リース (tier制限付き)        │                                  │  ・アプリ発見・管理          │
│  ・スケジュール起動停止 (有償)  │                                  │  ・CP/SERVICE/DB制御         │
│  ・監査ログレポート (有償)      │                                  │  ・Watchdog自動停止          │
│  ・課金                         │                                  │  ・Dashboard (standalone)    │
│  ・Streamlit直リンク            │                                  │  ・Deploy Guide              │
└─────────────────────────────────┘                                  └──────────────────────────────┘
                                                                              ↑
                                                                     Marketplace 無償公開
                                                                     (SaaSなしで単体利用可)
```

---

## 2. Operator（Native App）

### 2.1 スキーマ構成

| スキーマ | 用途 | アクセス |
|----------|------|----------|
| `api` | Gallery 向け公開 API | `operator_saas` ロール |
| `config` | Streamlit UI 向け管理操作 | `operator_admin` ロール |
| `core` | 内部実装（テーブル・内部プロシージャ） | プロシージャ経由のみ |

### 2.2 APPLICATION ROLE

```sql
CREATE APPLICATION ROLE operator_saas;   -- Gallery SaaS 接続ユーザー用
CREATE APPLICATION ROLE operator_admin;  -- Streamlit UI / 管理者用
CREATE APPLICATION ROLE operator_user;   -- 読み取り専用（利用組織の判断で付与）
```

### 2.3 公開 API プロシージャ（`api` スキーマ）

全プロシージャは統一レスポンス形式を返す：

```json
{
  "api_version": "1.0",
  "status": "OK",
  "data": { ... }
}
```

```json
{
  "api_version": "1.0",
  "status": "ERROR",
  "error": { "code": "LEASE_NOT_FOUND", "message": "..." }
}
```

#### プロシージャ一覧

| プロシージャ | 引数 | 説明 |
|---|---|---|
| `api.start(app_name, duration_minutes, user_name)` | VARCHAR, INT, VARCHAR | アプリの CP RESUME + SERVICE 起動。lease_id を返す |
| `api.stop(lease_id)` | VARCHAR | リース停止。CP SUSPEND（SERVICE は暗黙停止） |
| `api.extend(lease_id, duration_minutes, user_name)` | VARCHAR, INT, VARCHAR | リース延長 + リソース RESUME 確認 |
| `api.get_status(app_name DEFAULT NULL)` | VARCHAR | アプリ or 全アクティブリースのステータス |
| `api.heartbeat(lease_id, user_name)` | VARCHAR, VARCHAR | セッションハートビート |
| `api.list_apps()` | なし | 管理対象アプリ一覧（endpoint_url, compute_pool 等含む） |
| `api.get_endpoints(app_name)` | VARCHAR | SHOW ENDPOINTS 経由の URL 発見 |
| `api.get_version()` | なし | Operator バージョン + API バージョン + 互換性情報 |

#### 設計原則

- **`start` と `extend` を分離** — 現在の `start_or_extend` の曖昧さを解消
- **`extend` は lease_expires_at を UPDATE してからリソース RESUME** — Watchdog とのレースコンディション解消
- **全エラーは構造化レスポンス** — 例外を飲み込まない

### 2.4 Streamlit Dashboard 拡張

現在の Setup UI を「Operator Dashboard」として拡張。
`st.set_page_config(layout="wide")` で横幅いっぱいに使用する。

#### ナビゲーション構成（サイドバー）

```
┌─────────────────────┐
│  App Gallery         │  ← Gallery ビュー（カード UI）
│  Operator            │  ← 管理対象アプリの登録・設定
│  Audit Log           │  ← 監査ログビューア
│  Help                │  ← デプロイガイド・FAQ
└─────────────────────┘
```

#### Gallery ビュー（サイドバー: App Gallery）

SaaS Gallery と**同等のカード型 UI** を Streamlit で実装する。
ただし以下は Operator では**提供しない**（SaaS 有償機能）：
- リース管理（時間指定の自動停止）
- スケジュール起動停止
- チーム/メンバー管理

| 要素 | 動作 |
|------|------|
| カード表示 | アプリ名、カテゴリ、アイコン、CP 状態（Running / Stopped） |
| Start ボタン | `config.start_app(app_name)` → CP RESUME + SERVICE 起動 |
| Stop ボタン | `config.stop_app(app_name)` → CP SUSPEND |
| Open ボタン（起動中） | `endpoint_url` に直リンク |
| カード押下（起動中） | アプリ詳細（リソース状態、エンドポイント URL 等） |
| `streamlit_wh` カード | Open ボタンのみ（常時到達可能、Start/Stop なし） |

- カードグリッドは `st.columns` + `st.container` で SaaS 相当のレイアウトを再現
- 検索バー + カテゴリフィルタも SaaS 同様に提供

#### Operator ビュー（サイドバー: Operator）

既存の管理機能を集約：
- アプリ発見・登録・バリデーション（既存 App Management）
- リソース管理: CP / SERVICE / DB（既存 Resources）
- `app_type` の設定（`native_app` / `streamlit_cp` / `streamlit_wh`）
- Gallery SaaS 連携設定

#### Audit Log（サイドバー: Audit Log）

- 既存の audit_log テーブルビューア

#### Help（サイドバー: Help）

- Native App デプロイガイド（Gallery Compatible 仕様含む）
- `BLUE_APP_GALLERY_REGISTRY` セットアップ手順
- GRANT 手順のテンプレート SQL 提供
- Gallery SaaS 連携設定手順
- よくあるエラーと対処法

### 2.5 Watchdog

- 既存の `lease_watchdog` タスク（1分間隔）はそのまま維持
- `stop_if_expired` が期限切れリースの CP を SUSPEND
- Standalone モード: Dashboard から start → `duration_minutes` で自動停止
- Gallery モード: Gallery が `api.start/extend/stop` を呼び、Watchdog がフェイルセーフ

### 2.6 監査ログ

- `core.audit_log` テーブルのみ（UI は Audit Log タブの既存機能）
- Gallery 側は Supabase の `audit_log` で独自に管理
- Operator の audit_log は Snowflake 側のローカル記録として完結

### 2.7 アプリタイプと制御方式

`app_catalog` に `app_type` を追加：

| app_type | 説明 | CP 制御 | リース対象 | エンドポイント |
|---|---|---|---|---|
| `native_app` | Native App（従来） | CP + SERVICE | はい | SHOW ENDPOINTS で自動発見 |
| `streamlit_cp` | Streamlit（コンテナランタイム） | CP のみ | **はい** | アクセスで自動起動するが、明示停止が有益 |
| `streamlit_wh` | Streamlit（ウェアハウス/サーバーレス） | なし | いいえ | 常時到達可能な直リンク |

#### Streamlit コンテナランタイム（`streamlit_cp`）

- **起動**: CP RESUME → Streamlit エンドポイントにアクセスすると自動起動（auto_resume）
- **停止**: 自動停止は **3日後**（Snowflake デフォルト）→ 明示的な CP SUSPEND が有益
- **リース**: native_app と同様にリース管理対象。Gallery の tier 制限（Free: 2h）が適用される
- **エンドポイント**: Snowflake コンソールの URL を `endpoint_url` に登録。
  Operator の `api.get_endpoints()` は Native App の SERVICE 向けだが、
  `streamlit_cp` は `endpoint_url` の直接参照でエンドポイント判定
- **Operator 登録**: `config.manage_app()` で `app_type = 'streamlit_cp'` として登録。
  関連リソースは COMPUTE_POOL のみ

#### Streamlit ウェアハウス型（`streamlit_wh`）

- **起動/停止不要**: サーバーレス。エンドポイントにアクセスするだけで利用可能
- **リース不要**: CP を持たないので start/stop の概念がない
- **Operator 登録**: 他のアプリと同じく `config.manage_app()` で登録。登録パスは統一
- **Gallery での扱い**: `app_type = 'streamlit_wh'` のフラグにより起動停止操作をスキップし、
  カード上は Open ボタンで `endpoint_url` に直リンクするだけ

---

## 3. Gallery（SaaS）

### 3.1 Tier 設計

| | Free | Pro ($20/mo) | Enterprise（個別見積） |
|---|---|---|---|
| チーム作成 | 1 | 1 | 複数 |
| メンバー | admin + 20名 | 100名 | 無制限 |
| Snowflake 接続 | 1 アカウント | 5 アカウント | 無制限 |
| リース最大時間 | 2h | 無制限 | 無制限 |
| スケジュール起動停止 | - | あり | あり |
| Usage Insights | 直近7日ログのみ | フル機能（KPI・ランキング・トレンド） | フル機能 |
| Operator 必要 | はい（全 app_type 共通で Operator 経由で登録） | はい | はい |

#### Tier 制限の実装場所

**全て Gallery (SaaS) 側。Operator は制限を知らない。**

- リース時間: `lease-engine.ts` で `durationMinutes` をキャップ
- 接続数: 接続作成 API で制限チェック
- メンバー数: 招待 API で制限チェック
- 機能ゲート: UI コンポーネントで表示制御 + API で拒否

### 3.2 カード操作の設計

Gallery の AppCard は **アプリの状態** と **app_type** で操作を分岐する。

#### 停止中のアプリ

| 要素 | 動作 |
|---|---|
| カード押下 | アプリ詳細ダイアログ（説明、リソース情報、Launch ボタン） |
| Launch ボタン | LaunchDialog → リース作成 → Operator `api.start()` |

#### 起動中のアプリ（`native_app` / `streamlit_cp`）

| 要素 | 動作 |
|---|---|
| **Open ボタン** | `endpoint_url` に直リンク（エンドポイントを開く） |
| **カード押下** | **アプリ管理パネル**を開く（下記参照） |

アプリ管理パネル（起動中カード押下時）：
- リース残り時間の表示
- **Extend**: リース延長（duration 選択）
- **Stop**: 即時停止（確認ダイアログ付き）
- **Schedule** (Pro 以上): 起動/停止スケジュール設定
- エンドポイント URL のコピー
- リソース状態（CP, SERVICE）の表示

#### `streamlit_wh` アプリ（常時）

| 要素 | 動作 |
|---|---|
| Open ボタン | `endpoint_url` に直リンク |
| カード押下 | アプリ詳細（説明のみ、起動停止なし） |

#### app_type ごとの制御まとめ

| app_type | リース | Start/Stop | エンドポイント発見 |
|---|---|---|---|
| `native_app` | あり | CP + SERVICE | SHOW ENDPOINTS で自動発見 |
| `streamlit_cp` | あり | CP のみ | `endpoint_url` 直接参照 |
| `streamlit_wh` | なし | なし | `endpoint_url` 直接参照（常時到達可能） |

### 3.3 Usage Insights ダッシュボード（Pro 以上）

Gallery のサイドバーに **Usage Insights** メニューを追加。
「監査」ではなく**アプリ活用度の可視化**として、現場業務の効率化を証明するポジティブなダッシュボードを提供する。
**課金要素として Free tier と差別化するキラー機能。**

#### Free tier

- Settings > Audit Log に直近7日間のログ一覧のみ表示
- フィルタ・集計なし
- Usage Insights メニューはプレビュー表示（「Pro にアップグレードで解放」）

#### Pro / Enterprise tier

##### ヘッドライン KPI（ページ上部）

| KPI | 表示例 |
|---|---|
| 総利用時間（今月） | **128h** (+23% vs 先月) |
| アクティブユーザー数 | **14 / 20名** |
| 最も使われたアプリ | **PLEASANTER_APP** (42h) |
| リース回数（今月） | **87回** |

- 前月比の増減を矢印 + パーセントでポジティブに表現
- 「チームの活用が進んでいます！」のような encouragement メッセージ

##### アプリ活用ランキング

| ウィジェット | 内容 |
|---|---|
| アプリ別利用時間 | 横棒グラフ: 合計利用時間 Top N。カテゴリ色分け |
| アプリ別利用者数 | ユニークユーザー数の多い順 |
| 成長率 | 前月比で利用時間が最も伸びたアプリ |

##### ユーザー / チーム活用ランキング

| ウィジェット | 内容 |
|---|---|
| トップ利用者 | 利用時間順。アバター + 名前 + 累計時間 |
| 部署別（将来） | メンバーのタグ/グループで集計（Enterprise） |
| 新規利用者 | 今月初めてアプリを起動したメンバー |

##### 利用トレンド

| ウィジェット | 内容 |
|---|---|
| 利用時間推移 | 折れ線グラフ: 週別・月別の合計利用時間（右肩上がりを期待） |
| アクティブ時間帯 | ヒートマップ: 曜日 × 時間帯のリース開始分布 |

##### フィルタ

| フィルタ | 説明 |
|---|---|
| 期間 | 今週 / 今月 / 過去3ヶ月 / カスタム |
| アプリ名 | ドロップダウン（複数選択可） |
| ユーザー名 | ドロップダウン（複数選択可） |

##### エクスポート

- CSV ダウンロード（フィルタ適用済み）
- PDF レポート生成（月次サマリー — 経営層・上長への報告用途）

#### データソース

- Supabase `leases` + `audit_log` テーブルを結合して集計
- Operator 側の `core.audit_log` は参照しない（SaaS 完結）
- 利用時間の計算: `leases.expires_at - leases.created_at`（リース時間ベース）

### 3.4 Snowflake SQL API Client 変更

```typescript
// 変更前
async startOrExtend(resources, duration, userName, appName) {
  return this.callProcedure('core.start_or_extend', [...]);
}

// 変更後
async startApp(appName: string, durationMinutes: number, userName: string) {
  return this.callProcedure('api.start', [appName, durationMinutes, userName]);
}

async extendLease(leaseId: string, durationMinutes: number, userName: string) {
  return this.callProcedure('api.extend', [leaseId, durationMinutes, userName]);
}

async stopLease(leaseId: string) {
  return this.callProcedure('api.stop', [leaseId]);
}

async getOperatorVersion() {
  return this.callProcedure('api.get_version', []);
}
```

### 3.4 接続テスト時の互換性チェック

接続テスト（Settings > Connections > Test）で:

1. `api.get_version()` を呼び出す
2. `api_version` が Gallery の対応範囲内か確認
3. 未対応の場合「Operator のアップグレードが必要です」を表示
4. Operator 未インストールの場合 → Streamlit 直リンクモードにフォールバック

### 3.5 リースの二重管理

| | Operator (Snowflake) | Gallery (Supabase) |
|---|---|---|
| テーブル | `core.lease_status` | `leases` |
| 役割 | 正本（Watchdog 制御の基準） | キャッシュ + tier メタデータ |
| 同期 | Gallery → Operator (start/stop/extend) | Operator → Gallery (10秒ポーリング) |
| 不整合時 | Operator が勝つ | Gallery は次回 refresh で追従 |

---

## 4. API Contract まとめ

### 4.1 Gallery → Operator 呼び出し一覧

| Gallery 操作 | Operator API | タイミング |
|---|---|---|
| Launch ボタン | `api.start(app, duration, user)` | ユーザー操作 |
| Extend ボタン | `api.extend(lease_id, duration, user)` | ユーザー操作 |
| Stop ボタン | `api.stop(lease_id)` | ユーザー操作 |
| カード状態更新 | `api.get_status()` | 60秒ポーリング |
| エンドポイント発見 | `api.get_endpoints(app)` | Launch 後ポーリング |
| カタログ同期 | `api.list_apps()` | Settings > Catalog > Sync |
| 接続テスト | `api.get_version()` | Settings > Connections > Test |
| ハートビート | `api.heartbeat(lease_id, user)` | ブラウザ操作時 |
| スケジュール実行 | `api.start(app, duration, 'SCHEDULER')` | Supabase cron (有償) |

### 4.2 互いに知らないこと

- **Operator は知らない**: tier、課金、メンバー、チーム、スケジュール
- **Gallery は知らない**: CP の内部状態、SERVICE の起動手順、GRANT 手順

---

## 5. 開発フェーズ

### Phase 1: API スキーマ追加 + Dashboard 拡張（Operator）

- [ ] `api` スキーマ新設 + `operator_saas` ロール
- [ ] `api.start()` / `api.extend()` / `api.stop()` 実装（内部で core.* を呼び出す）
- [ ] `api.get_status()` / `api.list_apps()` / `api.get_endpoints()` / `api.get_version()` 実装
- [ ] `api.extend()` のレースコンディション修正（UPDATE を先、RESUME を後）
- [ ] Streamlit Dashboard に Operations タブ（Start/Stop ボタン）追加
- [ ] Streamlit Dashboard に Help タブ（Deploy Guide）追加
- [ ] `app_type` カラムを `core.app_catalog` に追加

### Phase 2: Gallery 側移行

- [ ] `sql-api-client.ts` を `api` スキーマ呼び出しに変更
- [ ] `types.ts` を新レスポンス形式に更新
- [ ] `lease-engine.ts` に tier 制限チェック追加
- [ ] Supabase `app_catalog` に `app_type` カラム追加
- [ ] Gallery UI に Streamlit 直リンク対応追加
- [ ] 接続テストで `api.get_version()` 互換性チェック追加
- [ ] Supabase `billing_plans` テーブル + Stripe 連携

### Phase 3: リポジトリ分離

- [ ] `native-app/` → 新リポジトリ `SnowflakeAppOperator`
- [ ] `saas/` → 現リポジトリ `SnowflakeAppGallery` として維持
- [ ] API Contract 仕様書を両リポジトリの docs/ に配置
- [ ] CI/CD パイプラインを各リポジトリに設定

### Phase 4: 後方互換削除（Operator v2.0）

- [ ] `core.*` の直接呼び出しを `operator_saas` ロールから REVOKE
- [ ] `api` スキーマのみが公開 API

---

## 6. リスクと考慮事項

### 6.1 API バージョニング

- `api.get_version()` で `{ operator_version: "1.0.0", api_version: "1.0", min_gallery_version: "1.0" }` を返す
- Gallery は接続テスト時にバージョンを確認
- 重大な非互換変更は `api_version` をインクリメント

### 6.2 Marketplace 公開戦略

- Operator: 無料公開 → ユーザー認知 → Gallery 有償化への導線
- Operator 単体で「Snowflake Native App 管理ツール」として価値提供
- Gallery は「チーム管理 + スケジューリング + 課金」の付加価値
- 全アプリは Operator 経由で登録（登録パス統一）。`streamlit_wh` は起動停止操作のみスキップ

### 6.3 既知の技術課題

- **`resume_service()` 未実装アプリ**: Gallery Compatible でないアプリは `api.start()` 内で WARN → Gallery 側でユーザーに通知
- **EXTEND のレースコンディション**: Phase 1 で修正（`lease_expires_at` UPDATE → リソース RESUME の順序逆転）
- **AUTO_SUSPEND_SECS**: Operator のドキュメントで「Gallery 管理対象 CP は `AUTO_SUSPEND_SECS = 0` 推奨」を明記
