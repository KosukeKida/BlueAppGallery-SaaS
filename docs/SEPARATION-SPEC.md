# Gallery / Operator 分離仕様書

> v1.2 — 2026-04-06

---

## 1. 概要

Gallery（SaaS）と Operator（Native App）を責務分離し、**独立したリポジトリで開発可能にする**。
両者の疎通は Operator が公開する `api` スキーマのプロシージャで行う。

```
┌─────────────────────────────────┐     Snowflake SQL API (JWT)      ┌──────────────────────────────┐
│         Gallery (SaaS)          │ ──────────────────────────────── │    Operator (Native App)     │
│  Next.js + Supabase             │          api.* calls             │  setup.sql + Streamlit UI    │
│                                 │                                  │                              │
│  ・チーム/メンバー管理          │                                  │  ・start / stop / extend     │
│  ・リース管理                   │                                  │  ・アプリ発見・管理          │
│  ・スケジュール起動停止         │                                  │  ・CP/SERVICE/DB制御         │
│  ・監査ログ                     │                                  │  ・Watchdog自動停止          │
│  ・Streamlit直リンク            │                                  │  ・Dashboard (standalone)    │
└─────────────────────────────────┘                                  └──────────────────────────────┘
                                                                              ↑
                                                                     Marketplace 無償公開
                                                                     (SaaSなしで単体利用可)
```

### 1.1 責務分界点

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Operator（Native App）                                                    │
│                                                                            │
│  ■ 単体で機能完結                                                          │
│    - Streamlit Dashboard でアプリの発見・登録・起動・停止が可能            │
│    - SaaS がなくても全機能を利用できる                                     │
│    - Marketplace で独立した製品として公開                                  │
│                                                                            │
│  ■ 拡張ポイントとして api スキーマを公開                                   │
│    - api.* プロシージャは「外部連携のための拡張インターフェース」          │
│    - 誰が呼ぶか（SaaS、スクリプト、他ツール）は Operator の関知外          │
│    - Operator は SaaS の存在を知らない / 依存しない                        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                    ↑
                          ユーザーが許可した場合のみ
                          （接続設定 + APPLICATION ROLE 付与）
                                    ↓
┌────────────────────────────────────────────────────────────────────────────┐
│  Gallery（SaaS）                                                           │
│                                                                            │
│  ■ Operator の api を「勝手に」使うだけ                                    │
│    - ユーザーが SaaS の指示に従って接続用ユーザー/ロールを設定             │
│    - SaaS はその認証情報で api.* を呼び出す                                │
│    - Operator 側の変更なしに SaaS が独自に機能拡張可能                     │
│                                                                            │
│  ■ SaaS 固有の付加価値                                                     │
│    - チーム/メンバー管理（Operator にはない）                              │
│    - スケジュール起動停止（Operator にはない）                             │
│    - 使用状況の可視化・分析（Operator にはない）                           │
│    - 複数 Snowflake アカウントの統合管理（Operator にはない）              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**設計原則:**
- Operator は SaaS を前提としない（Marketplace 審査で Connected App 扱いを回避）
- SaaS は Operator の公開 API を利用するサードパーティという位置づけ
- ユーザーの明示的な許可（GRANT）がなければ SaaS は Operator にアクセスできない
- Dashboard も SaaS も同じ `api.launch()` / `api.stop()` を使用（リース管理の統一）
- Operator は呼び出し元（Dashboard か SaaS か）を区別しない（user_name で識別可能だが動作は同一）

---

## 2. Operator（Native App）

### 2.1 スキーマ構成

| スキーマ | 用途 | アクセス |
|----------|------|----------|
| `api` | 公開 API（Dashboard / 外部連携共通） | `operator_api`, `operator_admin` ロール |
| `config` | Streamlit UI 向け管理操作 | `operator_admin` ロール |
| `core` | 内部実装（テーブル・内部プロシージャ） | プロシージャ経由のみ |

### 2.2 APPLICATION ROLE

```sql
CREATE APPLICATION ROLE operator_api;    -- 外部連携用（api.* のみ）
CREATE APPLICATION ROLE operator_admin;  -- Streamlit UI / 管理者用（api.* + config.*）
CREATE APPLICATION ROLE operator_user;   -- 読み取り専用（将来用）
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
| `api.launch(app_name, duration_minutes, user_name)` | VARCHAR, INT, VARCHAR | アプリの CP RESUME + SERVICE 起動。lease_id を返す |
| `api.stop(lease_id)` | VARCHAR | リース停止。CP SUSPEND（SERVICE は暗黙停止） |
| `api.extend(lease_id, duration_minutes, user_name)` | VARCHAR, INT, VARCHAR | リース延長 + リソース RESUME 確認 |
| `api.get_status(app_name DEFAULT NULL)` | VARCHAR | アプリ or 全アクティブリースのステータス |
| `api.heartbeat(lease_id, user_name)` | VARCHAR, VARCHAR | セッションハートビート |
| `api.list_apps()` | なし | 管理対象アプリ一覧（endpoint_url, compute_pool 等含む） |
| `api.get_endpoints(app_name)` | VARCHAR | SHOW ENDPOINTS 経由の URL 発見 |
| `api.get_version()` | なし | Operator バージョン + API バージョン + 互換性情報 |
| `api.verify_permissions()` | なし | 全 Managed アプリの権限状態を一括チェック（オンデマンド診断用） |

#### 設計原則

- **`start` と `extend` を分離** — 現在の `start_or_extend` の曖昧さを解消
- **`extend` は lease_expires_at を UPDATE してからリソース RESUME** — Watchdog とのレースコンディション解消
- **全エラーは構造化レスポンス** — 例外を飲み込まない

#### `api.verify_permissions()` の詳細

SaaS からのオンデマンド診断用。通常のカタログ同期（`api.list_apps()`）では権限チェックを行わず、
管理者が明示的に「Verify Permissions」を実行した時のみ権限状態を返す。

**返却例（問題あり）:**
```json
{
  "api_version": "1.0",
  "status": "OK",
  "data": {
    "apps_checked": 5,
    "apps_with_issues": 2,
    "issues": [
      {
        "app_name": "LEARNING_STUDIO",
        "resources": [
          { "name": "CP_LEARNING", "type": "COMPUTE_POOL", "status": "PENDING" }
        ],
        "message": "Run Re-sync in Operator Dashboard, then execute GRANT statements"
      }
    ]
  }
}
```

**返却例（問題なし）:**
```json
{
  "api_version": "1.0",
  "status": "OK",
  "data": { "apps_checked": 5, "apps_with_issues": 0, "issues": [] }
}
```

### 2.4 管理プロシージャ（`config` スキーマ）

Dashboard 向けの管理操作。SaaS からは呼び出さない。

| プロシージャ | 引数 | 説明 |
|---|---|---|
| `config.manage_app(app_name, managed)` | VARCHAR, BOOLEAN | アプリを Managed に登録/解除。GRANT SQL を返却 |
| `config.resync_app(app_name)` | VARCHAR | 再デプロイ後のリソース再同期。変更検出 + GRANT SQL 返却 |
| `config.validate_managed_app(app_name)` | VARCHAR | 指定アプリの全リソース権限を検証 |
| `config.discover_apps()` | なし | DISCOVER_APPS() 外部プロシージャ経由でアプリ発見 |
| `config.list_managed_apps()` | なし | Managed アプリ一覧（Dashboard 表示用） |

#### `config.resync_app()` の詳細

再デプロイでコンピュートプールが変更された場合など、`managed_resources` と `app_catalog` の不整合を解消する。

**動作:**
1. 現在の `managed_resources` を記録
2. `managed_resources` をクリア
3. `app_catalog` の最新 infra から再登録
4. 差分を検出（ADDED / REPLACED / REMOVED）
5. 必要な GRANT SQL を返却

**返却例（変更あり）:**
```json
{
  "status": "UPDATED",
  "app_name": "LEARNING_STUDIO",
  "changes": [
    { "type": "REPLACED", "old_resource": "CP_OLD", "new_resource": "CP_NEW", "resource_type": "COMPUTE_POOL" }
  ],
  "grants_needed": ["GRANT OPERATE ON COMPUTE POOL CP_NEW TO APPLICATION BLUE_APP_GALLERY;"],
  "message": "Resource configuration updated. Run the GRANT statements if needed."
}
```

**返却例（変更なし）:**
```json
{
  "status": "NO_CHANGE",
  "app_name": "LEARNING_STUDIO",
  "changes": [],
  "grants_needed": [],
  "message": "Resource configuration is up to date. No changes detected."
}
```

### 2.5 Streamlit Dashboard 拡張

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
ただし以下は Operator では**提供しない**（SaaS 専用機能）：
- スケジュール起動停止
- チーム/メンバー管理
- 使用状況分析

| 要素 | 動作 |
|------|------|
| カード表示 | アプリ名、カテゴリ、アイコン、リース状態（Running / Stopped）、残り時間 |
| Start ボタン | `api.launch(app_name, default_lease_minutes, 'DASHBOARD')` → リース作成 + CP RESUME + SERVICE 起動 |
| Stop ボタン | `api.stop(lease_id)` → リース停止 + CP SUSPEND |
| Open ボタン（起動中） | `endpoint_url` に直リンク |
| カード押下（起動中） | アプリ詳細（リース残り時間、Extend ボタン、リソース状態） |
| `streamlit_wh` カード | Open ボタンのみ（常時到達可能、Start/Stop なし） |

- カードグリッドは `st.columns` + `st.container` で SaaS 相当のレイアウトを再現
- 検索バー + カテゴリフィルタも SaaS 同様に提供
- **Dashboard も SaaS も同じ `api.launch()` / `api.stop()` を使用**（リース管理の統一）

##### 「起動中」の判定基準（Operator Dashboard）

**リースの有無** で判定する（SaaS と統一）。

| app_type | 判定方法 |
|---|---|
| `native_app` / `streamlit_cp` | `core.lease_status` にアクティブリースが存在するか |
| `streamlit_wh` | 常時 Running（サーバーレス、リースなし） |

- Dashboard からの起動もリースを作成（user_name = 'DASHBOARD'）
- SaaS 経由のリースと Dashboard 経由のリースは共存可能（同じアプリに複数リース）
- 全リースが期限切れになるまで CP は SUSPEND されない（共有リソースロジック）
- Compute Pool が ACTIVE でも SERVICE がクラッシュしている可能性はあるが、管理者は Open 時やログで確認できるため許容

#### Operator ビュー（サイドバー: Operator）

既存の管理機能を集約：
- アプリ発見・登録・バリデーション（既存 App Management）
- リソース管理: CP / SERVICE / DB（既存 Resources）
- `app_type` の設定（`native_app` / `streamlit_cp` / `streamlit_wh`）
- Gallery SaaS 連携設定

##### Managed Apps の Re-sync 機能

再デプロイ後のリソース変更（コンピュートプール差し替え等）に対応���るため、Managed Apps 一覧に Re-sync 機能を提供。

| ボタン | 場所 | 動作 |
|--------|------|------|
| **Refresh** | ヘッダー行 | 一覧キャッシュのクリアのみ（軽量） |
| **Validate All** | ヘッダー行 | 全アプリの権限状態を検証 |
| **Re-sync All** | ヘッダー行 | 全アプリの `config.resync_app()` を順次実行（プログレスバー表示） |
| **Re-sync** | 各アプリの expander 内 | 個別アプリの `config.resync_app()` を実行 |

**Re-sync の典型的なユースケース:**
1. アプリを再デプロイして Compute Pool が変わった
2. SaaS から起動しようとしたがエラー
3. 管理者が Operator Dashboard で該当アプリの「Re-sync」を実行
4. 変更が検出され、GRANT SQL が表示される
5. GRANT SQL を Snowsight で実行
6. 「Validate」で権限を確認 → 起動可能に

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
- Gallery モード: Gallery が `api.launch/extend/stop` を呼び、Watchdog がフェイルセーフ

### 2.6 監査ログ

- `core.audit_log` テーブルのみ（UI は Audit Log タブの既存機能）
- Gallery 側は Supabase の `audit_log` で独自に管理
- Operator の audit_log は Snowflake 側のローカル記録として完結

### 2.7 アプリタイプと制御方式

`app_catalog` に `app_type` と `default_lease_minutes` を追加：

| カラム | 型 | デフォルト | 説明 |
|---|---|---|---|
| `app_type` | VARCHAR | `'native_app'` | アプリの種類（下記参照） |
| `default_lease_minutes` | INT | `60` | Dashboard 起動時のデフォルトリース時間 |

| app_type | 説明 | CP 制御 | Postgres 制御 | リース対象 | エンドポイント |
|---|---|---|---|---|---|
| `native_app` | Native App（従来） | CP + SERVICE | `postgres_mode` に従う | はい | SHOW ENDPOINTS で自動発見 |
| `streamlit_cp` | Streamlit（コンテナランタイム） | CP のみ | `postgres_mode` に従う | **はい** | アクセスで自動起動するが、明示停止が有益 |
| `streamlit_wh` | Streamlit（ウェアハウス/サーバーレス） | なし | なし | いいえ | 常時到達可能な直リンク |

#### Streamlit コンテナランタイム（`streamlit_cp`）

- **起動**: CP RESUME → Streamlit エンドポイントにアクセスすると自動起動（auto_resume）
- **停止**: 自動停止は **3日後**（Snowflake デフォルト）→ 明示的な CP SUSPEND が有益
- **リース**: native_app と同様にリース管理対象
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

#### Notebook（対象外）

Snowflake Notebook（`notebook_cp`）は Blue App Gallery の管理対象外とする。

- **理由**: Notebook は Snowflake 標準で個別の auto-stop 設定（Idle Timeout）を持っており、
  外部からのライフサイクル管理が不要
- **Operator Dashboard**: 「Discover Notebooks」ボタンは削除。Notebook を発見・登録するフローは提供しない
- **Gallery SaaS**: Notebook は `app_catalog` に登録されないため、Gallery に表示されない

### 2.8 Postgres Instance 制御

Snowflake Managed Postgres Instance を使用するアプリに対して、Operator が起動/停止を制御する。

#### `postgres_mode`

`app_catalog` に `postgres_mode` カラムを追加：

| postgres_mode | 起動時 | 停止時 | ユースケース |
|---|---|---|---|
| `NONE`（デフォルト） | 何もしない | 何もしない | Postgres を使わないアプリ |
| `RESUME_ONLY` | RESUME | 何もしない | 共有 DB（複数アプリが使う） |
| `FULL` | RESUME | SUSPEND | 専用 DB（このアプリのみ） |

#### 起動順序

Postgres を使うアプリの起動は以下の順序で行う（`api.launch()` / `config.start_app()`）：

```
1. Postgres Instance RESUME  ← DB が先に準備される
2. Compute Pool RESUME
3. SERVICE 起動（resume_service()）
```

**理由**: アプリのコンテナが起動した時点で DB に接続可能である必要がある。
Postgres が起動していない状態で SERVICE が起動すると接続エラーになる。

#### 停止順序

```
1. Compute Pool SUSPEND      ← SERVICE は暗黙停止
2. Postgres Instance SUSPEND  ← postgres_mode = 'FULL' の場合のみ
```

**理由**: SERVICE が先に停止するため、Postgres への接続が切れる前にアプリが終了する。

#### 権限

```sql
GRANT OPERATE ON POSTGRES INSTANCE <PG_INSTANCE> TO APPLICATION BLUE_APP_GALLERY;
```

`config.manage_app()` が GRANT 文を自動生成する（`postgres_mode != 'NONE'` の場合）。

#### 共有 Postgres Instance

`postgres_mode = 'RESUME_ONLY'` は、複数アプリが同一の Postgres Instance を使う場合に使用する。
停止時に SUSPEND しないため、他のアプリが DB を使っている間も影響しない。

`core._suspend_resource()` の共有リソース保護ロジック（他のアクティブリースが同じリソースを使っていれば SUSPEND をスキップ）は、Postgres Instance にも適用される。

#### Gallery（SaaS）側の扱い

- `postgres_instance` と `postgres_mode` はカタログ情報として `api.list_apps()` 経由で同期
- SaaS は Postgres の制御に**関与しない**（表示のみ）
- アプリ詳細ダイアログにリソースとして Postgres Instance を表示
- 起動/停止の制御は Operator が `api.launch()` / `api.stop()` 内で自動的に行う

#### Gallery Compatible App テンプレートの対応

- テンプレートの `configure_database()` は外部 DB と Managed Postgres を**区別しない**
- どちらも host / port / user / pass で統一的に設定する（EAI + SECRET 経由）
- Managed Postgres 固有の接続仕様（専用 API や認証方式）は Snowflake 未発表（2026-03-21 時点）
- 発表され次第テンプレートを拡張する。対応はアプリ Developer（Marketplace 出品者）向け
- テンプレートのアプリは Operator の `postgres_mode` を意識する必要がない（起動/停止は Operator が自動制御）

---

## 3. Gallery（SaaS）

### 3.1 「起動中」の判定基準（SaaS Gallery）

**利用者向け** の表示であるため、**エンドポイントに到達できるか** まで加味して判定する。

#### 判定ロジック（2段階）

| 段階 | 判定方法 | タイミング | 精度 |
|---|---|---|---|
| **第1段階: リース存在チェック** | Supabase `leases` テーブルに `status = 'ACTIVE'` のリースが存在するか | 10秒ごとのクイックポーリング | 高速だが、Watchdog 停止の検出に最大60秒の遅延 |
| **第2段階: Snowflake 同期** | `api.get_status()` で Operator 側のリース状態と同期。Watchdog による期限切れを検出 | 60秒ごとのフルリフレッシュ | 正確 |

#### カード表示状態

| 状態 | 条件 | カード表示 |
|---|---|---|
| **Running** | アクティブリースが存在 | 緑リング + "Running" バッジ + Open ボタン |
| **Starting** | Launch 中（API 呼び出し〜エンドポイント到達確認） | 青リング + "Starting" バッジ + プログレスバー |
| **Stopped** | リースなし or 期限切れ | グレーリング + "Stopped" |

#### エンドポイント到達性チェック

エンドポイント到達性チェックは **カード表示の Running/Stopped 判定自体には使わない**。
以下の場面で使用する：

| 場面 | 方式 | 目的 |
|---|---|---|
| **Launch 中の進捗表示** | `/api/leases/check-endpoint` (HTTP fetch + `SHOW ENDPOINTS`) | エンドポイントが利用可能になったタイミングを検出し、Starting → Running に遷移 |
| **Open ボタン押下時** | HTTP fetch で到達確認。未到達なら「起動中です、しばらくお待ちください」表示 | ユーザーがアクセス不能なURLを開くのを防止 |
| **endpoint_url の自動発見** | `SHOW ENDPOINTS IN SERVICE` 経由 | `app_catalog.endpoint_url` が未設定のアプリで URL を自動取得・保存 |

#### Operator Dashboard との違い

| | Operator Dashboard | SaaS Gallery |
|---|---|---|
| **対象ユーザー** | 管理者 | 利用者 |
| **「起動中」の意味** | コンピュートリソースが起動している | リースが有効でエンドポイントが利用可能 |
| **判定基準** | Compute Pool の state | リース存在 + エンドポイント到達性 |
| **時間制限** | なし（手動 Stop まで無期限） | リース期間 |
| **自動停止** | なし | Watchdog がリース期限切れで自動 SUSPEND |

### 3.2 カード操作の設計

Gallery の AppCard は **アプリの状態** と **app_type** で操作を分岐する。

#### 停止中のアプリ

| 要素 | 動作 |
|---|---|
| カード押下 | アプリ詳細ダイアログ（説明、リソース情報、Launch ボタン） |
| Launch ボタン | LaunchDialog → リース作成 → Operator `api.launch()` |

#### 起動中のアプリ（`native_app` / `streamlit_cp`）

| 要素 | 動作 |
|---|---|
| **Open ボタン** | `endpoint_url` に直リンク（エンドポイントを開く） |
| **カード押下** | **アプリ管理パネル**を開く（下記参照） |

アプリ管理パネル（起動中カード押下時）：
- リース残り時間の表示
- **Extend**: リース延長（duration 選択）
- **Stop**: 即時停止（確認ダイアログ付き）
- **Schedule**: 起動/停止スケジュール設定
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

### 3.3 Usage Insights ダッシュボード

Gallery のサイドバーに **Usage Insights** メニューを追加。
「監査」ではなく**アプリ活用度の可視化**として、現場業務の効率化を証明するポジティブなダッシュボードを提供する。

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
| 部署別（将来） | メンバーのタグ/グループで集計 |
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

### 3.4 プロモーションカード

Gallery の Gallery ページにスポンサー広告カードを表示する。管理は SaaS Admin 権限（`saas_owner`）のみ。

- **表示**: Gallery カードグリッド内にプロモーションカードを挿入
- **管理**: Settings > Promotions（SaaS Admin カテゴリ、`saas_owner` 権限）
- **データ**: Supabase `promotion_cards` テーブル（`SAAS_OWNER_TENANT_ID` のテナントが所有）
- **詳細仕様**: SAAS-STATUS.md の「権限体系とメニュー可視性」セクション参照

### 3.5 Snowflake SQL API Client 変更

```typescript
// 変更前
async startOrExtend(resources, duration, userName, appName) {
  return this.callProcedure('core.start_or_extend', [...]);
}

// 変更後
async startApp(appName: string, durationMinutes: number, userName: string) {
  return this.callProcedure('api.launch', [appName, durationMinutes, userName]);
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

### 3.5 接続テスト時の互換性チェック

接続テスト（Settings > Connections > Test）で:

1. `api.get_version()` を呼び出す
2. `api_version` が Gallery の対応範囲内か確認
3. 未対応の場合「Operator のアップグレードが必要です」を表示
4. Operator 未インストールの場合 → Streamlit 直リンクモードにフォールバック

### 3.6 リースの二重管理

| | Operator (Snowflake) | Gallery (Supabase) |
|---|---|---|
| テーブル | `core.lease_status` | `leases` |
| 役割 | 正本（Watchdog 制御の基準） | キャッシュ + UI メタデータ |
| 同期 | Gallery → Operator (start/stop/extend) | Operator → Gallery (10秒ポーリング) |
| 不整合時 | Operator が勝つ | Gallery は次回 refresh で追従 |

### 3.7 Settings > Catalog の権限診断

管理者向けのオンデマンド診断機能。通常の Sync では権限チェックを行わず、
問題が発生した時に管理者が明示的に実行する。

#### UI

Settings > Catalog ページに「Verify Permissions」ボタンを追加。

| ボタン | 動作 |
|--------|------|
| **Sync** | `api.list_apps()` でカタログ同期（既存、権限チェックなし） |
| **Verify Permissions** | `api.verify_permissions()` で全アプリの権限状態をチェック |

#### Verify Permissions の表示

**問題なしの場合:**
```
✅ All 5 apps have valid permissions.
```

**問題ありの場合:**
```
⚠️ 2 apps have permission issues:

┌─────────────────────────────────────────────────────────┐
│ LEARNING_STUDIO                                         │
│ ��� COMPUTE_POOL: CP_LEARNING — PENDING                   │
│                                                         │
│ → Run Re-sync in Operator Dashboard, then execute GRANT │
└─────────────────────────────────────────────────────────┘
```

#### 典型的なトラブルシューティングフロー

1. ユーザーが Gallery からアプリを起動 → 失敗（到達不能）
2. 管理者が Settings > Catalog > **Verify Permissions** を実行
3. 問題のあるアプリが表示される
4. 管理者が Operator Dashboard で該当アプリの **Re-sync** を実行
5. GRANT SQL を Snowsight で実行
6. Operator Dashboard で **Validate** を実行 → 権限 OK
7. ユーザーが再度起動 → 成功

#### 設計原則

- **通常フローに影響しない**: Sync や起動操作では権限チェックを行わない（パフ��ーマンス優先）
- **管理者向け**: 一般ユーザーには表示しない（Settings ページは admin/owner のみ）
- **オンデマンド**: 問題発生時に明示的に実行

---

## 4. API Contract まとめ

### 4.1 Gallery → Operator 呼び出し一覧

| Gallery 操作 | Operator API | タイミング |
|---|---|---|
| Launch ボタン | `api.launch(app, duration, user)` | ユーザー操作 |
| Extend ボタン | `api.extend(lease_id, duration, user)` | ユーザー操作 |
| Stop ボタン | `api.stop(lease_id)` | ユーザー操作 |
| カード状態更新 | `api.get_status()` | 60秒ポーリング |
| エンドポイント発見 | `api.get_endpoints(app)` | Launch 後ポーリング |
| カタログ同期 | `api.list_apps()` | Settings > Catalog > Sync |
| 権限診断 | `api.verify_permissions()` | Settings > Catalog > Verify Permissions（オンデマンド） |
| 接続テスト | `api.get_version()` | Settings > Connections > Test |
| ハートビート | `api.heartbeat(lease_id, user)` | ブラウザ操作時 |
| スケジュール実行 | `api.launch(app, duration, 'SCHEDULER')` | Supabase cron |

### 4.2 互いに知らないこと

- **Operator は知らない**: メンバー、チーム、スケジュール、プロモーション
- **Gallery は知らない**: CP の内部状態、SERVICE の起動手順、GRANT 手順

---

## 5. 開発フェーズ

> 詳細な進捗は CLAUDE.md の開発計画を参照

### Phase 1-4: 完了済み

- [x] `api` スキーマ新設 + APPLICATION ROLE
- [x] `api.launch()` / `api.extend()` / `api.stop()` / `api.get_status()` / `api.list_apps()` / `api.get_endpoints()` / `api.get_version()` 実装
- [x] Streamlit Dashboard（Gallery / Operator / Audit Log / Help）
- [x] SaaS 側の `api` スキーマ移行
- [x] リポジトリ分離完了（Coordinator / SaaS / Operator）
- [x] Phase 4 REVOKE コミット済み（デプロイ待ち）

### Phase 5: Marketplace 再審査対応

- [x] `operator_api` にリネーム完了（中立的な名前）
- [x] Listing 説明文から SaaS 連携の記述を削除
- [x] Gallery Compatible の条件を説明文トップに明記
- [x] Discovery を外部プロシージャ + References で実装（RCR はサンドボックス制限で断念）
- [x] Setup Notebook で `DISCOVER_APPS()` プロシージャを作成
- [x] `DISCOVER_APPS()` で `gallery_compatible` 自動検出（`resume_service` 存在確認）
- [x] `config.manage_app()` で Gallery Compatible 用 GRANT（`resume_service` への USAGE）を生成
- [x] Help ページを更新（SaaS Integration 削除、Setup Notebook に完全 SQL 追加）
- [x] アプリ開発者: REGISTRY への GRANT 不要（Setup_UI 簡略化）

### Phase 6: Dashboard リース統一

- [ ] `core.app_catalog` に `default_lease_minutes` カラム追加（デフォルト: 60）
- [ ] `config.start_app()` を廃止、Dashboard は `api.launch()` を使用
- [ ] `config.stop_app()` を廃止、Dashboard は `api.stop()` を使用
- [ ] Gallery ページでリース残り時間を表示
- [ ] Operator ページに「Default lease duration」設定 UI 追加
- [ ] `leaseless_tracker` を fallback 化（手動 ALTER 用）
- [ ] 複数リース共存の動作確認（同じアプリに Dashboard + SaaS リース）

---

## 6. リスクと考慮事項

### 6.1 API バージョニング

- `api.get_version()` で `{ operator_version: "1.0.0", api_version: "1.0", min_gallery_version: "1.0" }` を返す
- Gallery は接続テスト時にバージョンを確認
- 重大な非互換変更は `api_version` をインクリメント

### 6.2 Marketplace 公開戦略と収益化

- **エンドユーザーは無料** — tier 制限は設けない。全機能を全ユーザーに開放
- Operator: Marketplace で無償公開。単体で「Snowflake Native App 管理ツール」として価値提供
- Gallery（SaaS）: 無料提供。収益化は以下の3本柱：
  1. **プロモーションカード**: アプリプロバイダーがスポンサー広告を掲載（Settings > Promotions で管理）
  2. **募金募集**: 個人ユーザーからの寄付（外部集金サービス連携、仕様は SAAS-STATUS.md 参照）
  3. **技術提供**: アプリプロバイダーへの Gallery Compatible 対応支援
- 全アプリは Operator 経由で登録（登録パス統一）。`streamlit_wh` は起動停止操作のみスキップ

### 6.3 既知の技術課題

- **`resume_service()` 未実装アプリ**: Gallery Compatible でないアプリは `api.launch()` 内で WARN → Gallery 側でユーザーに通知
- **EXTEND のレースコンディション**: Phase 1 で修正（`lease_expires_at` UPDATE → リソース RESUME の順序逆転）
- **AUTO_SUSPEND_SECS**: Operator のドキュメントで「Gallery 管理対象 CP は `AUTO_SUSPEND_SECS = 0` 推奨」を明記
