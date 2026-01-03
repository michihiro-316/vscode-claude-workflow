# vscode-claude-workflow - Claude Code統合版 詳細実装計画

> **重要な変更**: Claude API（従量課金）方式から、**Claude Code CLI統合方式**に設計変更しました。
> これにより、**Claude Pro / 5MAX / 10MAXプラン**のユーザーが追加コストなしで利用可能になります。

## エグゼクティブサマリー

### 設計変更の核心

**変更前（API版）:**
```
VSCode拡張 → @anthropic-ai/sdk → Claude API（従量課金・APIキー必須）
```

**変更後（Claude Code統合版）:**
```
VSCode拡張 → Claude Code CLI → Claude（Pro/5MAX/10MAXプラン）
         ↓
    .claude/agents/
    ├── pm-agent.md
    ├── engineer-agent.md
    ├── reviewer-agent.md
    └── orchestrator.md
```

### メリット

1. **✅ コスト削減**: Claude Pro/5MAX/10MAXプランの範囲内で利用可能（追加課金なし）
2. **✅ シンプルな認証**: APIキー不要（Claude Codeの認証を使用）
3. **✅ 強力なツール**: Claude CodeのRead/Write/Edit等のツールを直接利用
4. **✅ チーム共有**: `.claude/agents/`をGitで共有すれば、チーム全体で同じエージェントを使用可能

---

## 新しいアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│               VSCode拡張（TypeScript）                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │  UI Layer（Webview）                                │     │
│  └────────────────────────────────────────────────────┘     │
│                        ↕                                     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Orchestration Layer                                │     │
│  │  - ClaudeCodeRunner（CLI実行）                       │     │
│  │  - WorkflowManager（フロー制御）                      │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                        ↕ child_process.spawn
┌─────────────────────────────────────────────────────────────┐
│               Claude Code CLI                                │
│  ┌────────────────────────────────────────────────────┐     │
│  │  - .claude/agents/*.md をロード                      │     │
│  │  - Task toolでサブエージェント実行                    │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 技術スタック変更

### 削除するもの

- `@anthropic-ai/sdk` - Claude API直接呼び出しが不要
- `src/claude/ClaudeClient.ts` - CLI経由でアクセス
- `src/claude/PromptBuilder.ts` - エージェント定義ファイル(.md)に移行
- APIキー管理機能 - Claude Codeが認証を処理

### 追加するもの

- `child_process` (Node.js標準) - Claude Code CLI実行
- `.claude/agents/*.md` - エージェント定義ファイル群
- `src/cli/ClaudeCodeRunner.ts` - CLI実行ラッパー
- `src/cli/WorkflowManager.ts` - ワークフロー管理

---

## エージェント定義（.claude/agents/）

### ディレクトリ構造

```
.claude/
└── agents/
    ├── orchestrator.md       ← ワークフロー統括
    ├── pm-agent.md           ← 計画立案
    ├── engineer-agent.md     ← コード生成
    └── reviewer-agent.md     ← 品質チェック
```

### Orchestratorの役割

Task toolを使用して、PM → Engineer → Reviewer の順で実行を統括します。

```markdown
---
name: orchestrator
tools: Task
model: sonnet
---

# オーケストレーターエージェント

ステップ1: PMエージェントに計画を立案させる（Task tool使用）
ステップ2: ユーザー承認を待つ
ステップ3: エンジニアエージェントにコード生成させる（Task tool使用）
ステップ4: レビュアーエージェントに品質チェックさせる（Task tool使用）
ステップ5: 統合レポートを返す
```

---

## 実装ステップ

### Phase 1: 基盤構築（1週間）

- [ ] `src/cli/ClaudeCodeRunner.ts` - CLI実行ラッパー
- [ ] `src/cli/WorkflowManager.ts` - ワークフロー管理
- [ ] `.claude/agents/*.md` - 各エージェント定義

### Phase 2: VSCode UI実装（1週間）

- [ ] `extension.ts` - Claude CLI検出、エージェント定義自動作成
- [ ] `WorkflowPanel.ts` - CLI経由の実行、進捗表示

### Phase 3: テスト・統合（3-5日）

- [ ] E2Eテスト
- [ ] ドキュメント更新
- [ ] リリース準備

---

## リリース計画

### v0.1.0-alpha（Claude Code統合版）

**リリース目標**: 2-3週間後

**含まれる機能**:
- 基本的な4エージェント連携
- VSCode UI（サイドバー + 進捗表示）
- .claude/agents/エージェント定義
- 簡単なエラーハンドリング

---

## ユーザーへの影響

### 前提条件

1. **Claude Code CLIがインストール済み**
2. **Claude Pro / 5MAX / 10MAXプランに加入**

### 使用方法

```bash
# 1. Claude Code CLIをインストール（未インストールの場合）
npm install -g @anthropic-ai/claude-code

# 2. VSCode拡張をインストール
# （.vsixファイルまたはMarketplace）

# 3. プロジェクトで使用開始
# VSCodeでフォルダを開く → サイドバーのClaude Workflowアイコンをクリック
```

---

**作成日**: 2026-01-03
**Plan Agent ID**: ad9473b
**バージョン**: 2.0（Claude Code統合版）
