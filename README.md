# vscode-claude-workflow

**複数のAIエージェントが協働する VSCode 開発支援システム**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VSCode](https://img.shields.io/badge/VSCode-1.85%2B-blue)](https://code.visualstudio.com/)
[![Claude Code](https://img.shields.io/badge/Claude_Code-CLI-purple)](https://code.claude.com/)
[![Claude Plan](https://img.shields.io/badge/Claude-Pro%20%7C%205MAX%20%7C%2010MAX-orange)](https://www.anthropic.com/claude)

> 🤖 PM、エンジニア、レビュアーのAIエージェントがステップバイステップで協力し、ソフトウェア開発をサポートします
>
> ⚠️ **Claude Code CLI統合版**: Claude Pro / 5MAX / 10MAXプランで利用可能（追加課金なし）

## 📋 目次

- [概要](#概要)
- [主な機能](#主な機能)
- [インストール](#インストール)
- [使い方](#使い方)
- [アーキテクチャ](#アーキテクチャ)
- [開発者向け情報](#開発者向け情報)
- [ロードマップ](#ロードマップ)
- [コントリビューション](#コントリビューション)
- [ライセンス](#ライセンス)

## 概要

**vscode-claude-workflow** は、Claude CodeとVSCodeを統合し、日本語GUIを通じて複数のAIエージェントがステップバイステップで協働する開発支援システムです。

### 4つのエージェントがあなたの開発をサポート

1. **🧠 オーケストレーターエージェント** - 全体統括・ワークフロー管理
2. **📋 PMエージェント** - 要件整理・計画立案
3. **💻 エンジニアエージェント** - コード生成・実装
4. **🔍 レビュアーエージェント** - セキュリティ・品質チェック

### なぜ vscode-claude-workflow なのか？

- ✅ **コスト効率**: Claude Pro/5MAX/10MAXプランで追加課金なし
- ✅ **日本語完全対応**: すべてのインターフェースとメッセージが日本語
- ✅ **初心者にも優しい**: プリセットタスクで簡単に開始
- ✅ **段階的な確認**: 各ステップでユーザーが承認・修正可能
- ✅ **高品質なコード**: セキュリティとベストプラクティスを自動チェック
- ✅ **透明性の高いプロセス**: 各エージェントの思考過程を可視化
- ✅ **チーム共有**: エージェント定義ファイル（.claude/agents/）をGitで共有可能

## 主な機能

### 🎯 自動ワークフロー

```
ユーザー入力
    ↓
📋 PMが計画立案
    ↓ [承認]
💻 エンジニアがコード生成
    ↓
🔍 レビュアーが品質チェック
    ↓
最終成果物
```

### 🛠️ 多様な操作方法

- **プリセットタスク**: よくある作業を1クリックで開始
  - 新機能追加
  - バグ修正
  - セキュリティ診断
  - リファクタリング

- **自由入力**: 日本語で自由にタスクを記述

- **ファイル選択連携**: VSCodeで選択したファイルやコードを自動的にコンテキストとして活用

- **対話形式**: エージェントからの質問に答えながら進行

### 🔒 セキュリティ重視

レビュアーエージェントが以下をチェック：

- OWASP Top 10 の脆弱性
- XSS、SQLインジェクション、パストラバーサル等
- 認証・認可の問題
- データ漏洩リスク

### 📊 リアルタイム進捗表示

各エージェントの実行状況をリアルタイムで可視化：

```
📋 PM: 計画立案      ✅ 完了
💻 エンジニア: コード生成  🔄 実行中
🔍 レビュアー: 品質チェック ⏳ 待機中
```

## インストール

### 前提条件

⚠️ **重要**: 以下が必須です

1. **VSCode**: バージョン 1.85 以上
2. **Claude Code CLI**: インストール済みであること
3. **Claude プラン**: Pro / 5MAX / 10MAX いずれかに加入
4. **Node.js**: バージョン 18 以上（開発時のみ）

### ステップ1: Claude Code CLIのインストール

まだインストールしていない場合：

```bash
# macOS/Linux
npm install -g @anthropic-ai/claude-code

# または Homebrewで
brew install anthropic/tap/claude-code
```

詳細: https://code.claude.com/docs/en/installation

### ステップ2: VSCode拡張のインストール

#### 方法1: VSCode Marketplace から（将来的に対応予定）

```bash
# VSCode 拡張機能検索で "Claude Workflow" を検索してインストール
```

#### 方法2: ソースからビルド（現在）

```bash
# リポジトリをクローン
git clone https://github.com/michihiro-316/vscode-claude-workflow.git
cd vscode-claude-workflow

# 依存関係をインストール
npm install

# ビルド
npm run compile

# VSCodeでデバッグ実行
# F5キーを押して拡張開発ホストを起動
```

### ステップ3: 初回セットアップ

1. VSCodeで拡張機能を有効化
2. プロジェクトフォルダを開く
3. 拡張が `.claude/agents/` ディレクトリを自動作成
4. エージェント定義ファイルが自動生成される

**APIキーは不要です**（Claude Code CLIの認証を使用）

## 使い方

### 基本的なワークフロー

#### 1. サイドバーからワークフロー開始

1. アクティビティバーの Claude Workflow アイコンをクリック
2. タスク入力欄にやりたいことを日本語で入力
   ```
   例: ユーザー認証機能を追加してください
   ```
3. 「開始」ボタンをクリック

#### 2. PMエージェントの計画を確認

PMが作成した実装計画が表示されます：

```json
{
  "requirements": [
    "ユーザーログイン機能",
    "パスワードハッシュ化",
    "セッション管理"
  ],
  "implementationPlan": {
    "tasks": [
      {
        "id": "task-1",
        "description": "認証ミドルウェアの実装",
        "priority": "high"
      },
      {
        "id": "task-2",
        "description": "ログインエンドポイントの作成",
        "priority": "high"
      }
    ],
    "estimatedComplexity": 7,
    "risks": ["セキュリティ脆弱性の可能性"]
  }
}
```

**承認** または **修正** を選択できます。

#### 3. エンジニアエージェントがコード生成

承認すると、エンジニアが計画に基づいてコードを生成：

```typescript
// 例: 生成されるコード
// src/middleware/auth.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function authenticateUser(
  email: string,
  password: string
): Promise<string | null> {
  // 実装内容...
}
```

#### 4. レビュアーエージェントが品質チェック

生成されたコードをレビュー：

```json
{
  "securityIssues": [
    {
      "severity": "high",
      "type": "Weak Password Policy",
      "location": "auth.ts:15",
      "description": "パスワードの強度チェックが不足しています",
      "suggestion": "最低8文字、大小英字・数字・記号を含む要件を追加"
    }
  ],
  "overallScore": 75,
  "approved": false
}
```

問題があれば修正を提案し、再生成も可能です。

### プリセットタスクを使う

よくあるタスクは事前定義されています：

1. サイドバーの「プリセットタスク」を選択
2. 以下から選択：
   - 🆕 **新機能を追加**
   - 🐛 **バグを修正**
   - 🔒 **セキュリティ診断**
   - ♻️ **リファクタリング**

### ファイル選択連携

1. VSCodeでファイルまたはコードを選択
2. 右クリック → `Claude Workflowで処理`
3. 選択したコードが自動的にコンテキストとして渡される

## アーキテクチャ

### システム構成（Claude Code統合版）

```
┌─────────────────────────────────────────────┐
│         VSCode Extension (TypeScript)       │
│  ┌─────────────────────────────────────┐   │
│  │   Webview UI (日本語)               │   │
│  └─────────────────────────────────────┘   │
│              ↕                              │
│  ┌─────────────────────────────────────┐   │
│  │   ClaudeCodeRunner (CLI Wrapper)    │   │
│  │   WorkflowManager                    │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
              ↕ child_process.spawn
┌─────────────────────────────────────────────┐
│         Claude Code CLI                     │
│  ┌─────────────────────────────────────┐   │
│  │   Task Tool でサブエージェント実行   │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
              ↕
┌─────────────────────────────────────────────┐
│   .claude/agents/ (エージェント定義)        │
│  ├── orchestrator.md  ← ワークフロー統括    │
│  ├── pm-agent.md      ← 計画立案            │
│  ├── engineer-agent.md ← コード生成         │
│  └── reviewer-agent.md ← 品質チェック       │
└─────────────────────────────────────────────┘
              ↕
    ┌──────────────────────────┐
    │   Claude (Pro/5MAX/10MAX) │
    └──────────────────────────┘
```

### 技術スタック

- **フロントエンド**: TypeScript, VSCode Webview API
- **CLI統合**: Node.js child_process
- **エージェント定義**: Markdown (.claude/agents/*.md)
- **実行環境**: Claude Code CLI
- **Claude プラン**: Pro / 5MAX / 10MAX（追加課金なし）

### ディレクトリ構造

```
vscode-claude-workflow/
├── .claude/                 # Claude Code設定
│   └── agents/              # エージェント定義（Markdown）
│       ├── orchestrator.md  # ワークフロー統括
│       ├── pm-agent.md      # 計画立案
│       ├── engineer-agent.md # コード生成
│       └── reviewer-agent.md # 品質チェック
├── src/
│   ├── cli/                 # Claude Code CLI統合
│   │   ├── ClaudeCodeRunner.ts
│   │   └── WorkflowManager.ts
│   ├── extension/           # VSCode拡張
│   │   ├── ui/
│   │   └── commands/
│   └── types/               # 型定義
├── docs/                    # ドキュメント
│   ├── claude.md            # 開発ガイド
│   └── ja/                  # 日本語ドキュメント
└── test/                    # テスト
```

## 開発者向け情報

### プロジェクトのセットアップ

```bash
# 依存関係をインストール
npm install

# 開発モードでビルド
npm run watch

# テスト実行
npm test

# Lint
npm run lint

# フォーマット
npm run format
```

### デバッグ方法

1. VSCodeで `F5` キーを押す
2. 拡張開発ホストが起動
3. ブレークポイントを設定してデバッグ

### ドキュメント

詳細な開発情報は以下を参照：

- [開発ガイド (claude.md)](docs/claude.md)
- [実装計画 (Claude Code統合版)](IMPLEMENTATION_PLAN_CLAUDE_CODE.md)
- [要件定義 (v2.0)](REQUIREMENTS.md)
- [プロジェクト構成](PROJECT_STRUCTURE.md)

## ロードマップ

### Phase 1: MVP（現在 - Claude Code統合版）

- [x] Claude Code CLI統合アーキテクチャ設計
- [x] 4つのエージェント定義（.claude/agents/*.md）
- [ ] ClaudeCodeRunner実装
- [ ] WorkflowManager実装
- [ ] 基本的なVSCode UI
- [ ] E2Eテスト

### Phase 2: 機能拡張（計画中）

- [ ] テスターエージェント（テストコード生成・実行）
- [ ] プリセットタスク機能
- [ ] ファイル/コード選択連携
- [ ] 実行履歴の保存・再利用
- [ ] カスタマイズ可能な設定

### Phase 3: 高度な機能（将来）

- [ ] ドキュメント生成エージェント
- [ ] リファクタリングエージェント
- [ ] カスタムエージェント作成機能
- [ ] 並列実行モード
- [ ] チーム機能（複数人での利用）

## コントリビューション

貢献を歓迎します！以下の方法で参加できます：

### バグ報告・機能リクエスト

[Issue](https://github.com/michihiro-316/vscode-claude-workflow/issues) を作成してください。

### プルリクエスト

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

### コントリビューションガイドライン

- コードは TypeScript strict mode に準拠
- ESLint + Prettier でフォーマット
- テストを追加
- 日本語コメントを積極的に活用

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](LICENSE) を参照してください。

## 謝辞

- [Anthropic](https://www.anthropic.com/) - Claude と Claude Code の提供
- [VSCode](https://code.visualstudio.com/) - 優れた拡張機能プラットフォーム
- すべての貢献者の皆様

## 関連リンク

- [Claude Code Documentation](https://code.claude.com/docs)
- [Claude Code CLI](https://code.claude.com/docs/en/installation)
- [VSCode Extension API](https://code.visualstudio.com/api)
- [Claude プラン](https://www.anthropic.com/claude)

---

**作成**: 2026-01-03
**作成者**: vscode-claude-workflow チーム
**バージョン**: 2.0（Claude Code統合版）
**サポート**: [GitHub Issues](https://github.com/michihiro-316/vscode-claude-workflow/issues)

⭐ このプロジェクトが役に立ったら、GitHubでスターをお願いします！
