# Google Business Profile (GBP) API 申請マニュアル & 審査通過テンプレート

このドキュメントは、ReviewPilot（Googleマップ口コミ半自動返信SaaS）で Google Business Profile API のアクセス権限を Google に申請し、審査を確実にパスするための完全ガイドです。

---

## 📌 申請の流れ（3ステップ）

```
[Step 1: GCPプロジェクト作成 & OAuth同意画面設定] 
        ↓ (5分)
[Step 2: 申請フォームに記入・送信]
        ↓ (審査待ち: 数日〜1週間程度)
[Step 3: 承認通知受領 → APIキー有効化]
```

---

## Step 1: Google Cloud Platform (GCP) の初期設定

1. **[Google Cloud Console](https://console.cloud.google.com/) にアクセス**
2. 画面上部のプロジェクト選択メニューから **「新しいプロジェクト」** を作成
   - プロジェクト名: `ReviewPilot`
   - 作成後、ダッシュボードに表示される **「プロジェクト番号（Project Number）」** と **「プロジェクトID」** をメモします。
3. **「APIとサービス」＞「OAuth同意画面」** を開く
   - ユーザータイプ: **外部 (External)** を選択
   - アプリ情報:
     - **アプリ名**: `ReviewPilot`
     - **ユーザーサポートメール**: ご自身のメールアドレス
     - **アプリのホームページ**: `https://reviewpilot.pages.dev`（または本番ドメイン）
     - **アプリのプライバシーポリシーリンク**: `https://reviewpilot.pages.dev/privacy.html`
     - **アプリの利用規約リンク**: `https://reviewpilot.pages.dev/terms.html`
     - **デベロッパーの連絡先情報**: ご自身のメールアドレス
   - スコープ: `.../auth/business.manage`（後で追加）

---

## Step 2: GBP API アクセス申請フォームの記入

公式の申請フォーム（**[Google Business Profile API Access Request Form](https://developers.google.com/my-business/content/prereqs#request-access)**）を開き、以下のように記入します。

### 📋 フォーム入力項目とテンプレート

#### 1. 基本情報
- **Company / Developer Name**: `ReviewPilot`（またはご自身の屋号・個人名）
- **Contact Email Address**: ご自身のメールアドレス（独自ドメイン推奨）
- **Google Cloud Project Number**: Step 1で取得した **プロジェクト番号（数字）**

#### 2. アプリケーション情報
- **Application Name**: `ReviewPilot - Smart Review Reply Assistant`
- **Application Website URL**: `https://reviewpilot.pages.dev`
- **Privacy Policy URL**: `https://reviewpilot.pages.dev/privacy.html`
- **Terms of Service URL**: `https://reviewpilot.pages.dev/terms.html`

#### 3. ユースケースの説明（※審査通過のための最重要項目）
Googleは「AIによる完全自動スパム」を警戒しています。必ず **「店舗オーナーが内容を確認・選択して送信するHuman-in-the-loop方式」** であることを強調します。

> **【英語記入用テンプレート（推奨）】**
> ```text
> Application Overview:
> ReviewPilot is a business productivity tool designed to help local small business owners efficiently manage and respond to Google Maps customer reviews.
> 
> Key Functionalities:
> 1. Real-time Notification: When a new review is posted on Google Maps, the business owner receives an immediate email notification via Google Cloud Pub/Sub.
> 2. AI-assisted Draft Generation: Gemini AI generates three distinct, polite response drafts (e.g., formal/polite, friendly/warm, and constructive/apology for low ratings).
> 3. Human-in-the-Loop Approval: The business owner reviews the drafts and either selects the best response with a single click or manually edits the message before submitting.
> 
> Compliance & Safety:
> - No automated spam: No review reply is ever posted automatically without explicit owner review and approval.
> - Data Privacy: Google user data is strictly used solely for fetching reviews and posting owner-approved replies. Data is never sold, shared with third parties, or used for training public AI models.
> ```

> **【日本語記入欄がある場合のテンプレート】**
> ```text
> 【サービスの概要と目的】
> ReviewPilotは、飲食店やサロンなどの地域店舗オーナー向けに、Googleマップの口コミ返信業務を効率化する支援ツールです。
> 
> 【主な機能と利用フロー】
> 1. 新着口コミの通知: Googleマップに口コミが投稿された際、Pub/Sub連携を通じて店舗オーナーへ即時メール通知を送信します。
> 2. AIによる返信案の作成: Gemini AIが口コミの星評価と本文に応じた3パターンの返信案（丁寧、フレンドリー、お詫び/改善）を作成・提示します。
> 3. オーナーによる確認・承認（完全自動投稿の排除）: 店舗オーナーがメールまたは専用Web画面で返信案を確認・選択（または手動編集）した上で、Googleマップへの返信を代理実行します。
> 
> 【規約遵守とプライバシー保護】
> - 人間の介在（Human-in-the-loop）: 店舗オーナーの明示的な確認・承認なしに自動投稿されることは一切ありません。
> - データ保護: 取得したGoogleユーザーデータは口コミ返信機能の提供のみに利用し、第三者への提供・販売は行いません。
> ```

#### 4. 管理店舗数（想定）
- **How many locations do you manage?**: `1 - 100` または `100 - 500`（新規サービスとして適切）

---

## Step 3: 申請後の流れ

1. **審査期間**: 通常 **2営業日〜1週間** 程度でGoogleから承認メールが届きます。
2. **APIの有効化**: 承認後、Google Cloud Consoleで以下のAPIを有効化します：
   - `Google Business Profile API`
   - `My Business Account Management API`
   - `My Business Business Information API`
3. **OAuth クライアントIDの発行**:
   - 「認証情報」＞「認証情報を作成」＞「OAuth クライアント ID」
   - アプリケーションの種類: **ウェブ アプリケーション**
   - 承認済みのリダイレクト URI: `https://reviewpilot.pages.dev/api/auth/google/callback`

これで本番のGoogleマップ口コミ連携が完全に開通します！
