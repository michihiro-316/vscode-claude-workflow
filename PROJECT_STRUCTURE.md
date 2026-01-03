# vscode-claude-workflow - プロジェクト構成設計

## ディレクトリ構造

```
vscode-claude-workflow/
├── .vscode/                          # VSCode設定
│   ├── launch.json                   # デバッグ設定
│   └── settings.json                 # プロジェクト設定
├── src/                              # ソースコード
│   ├── extension/                    # VSCode拡張本体
│   │   ├── extension.ts              # エントリーポイント
│   │   ├── commands/                 # コマンド実装
│   │   │   ├── startWorkflow.ts      # ワークフロー開始
│   │   │   ├── showStatus.ts         # ステータス表示
│   │   │   └── index.ts              # コマンドエクスポート
│   │   ├── ui/                       # UIコンポーネント
│   │   │   ├── sidebar/              # サイドバーUI
│   │   │   │   ├── WorkflowPanel.ts  # メインパネル
│   │   │   │   └── AgentStatusView.ts # エージェント状態表示
│   │   │   ├── chat/                 # チャットUI
│   │   │   │   └── ChatView.ts       # 対話インターフェース
│   │   │   └── webview/              # Webviewベースコンポーネント
│   │   │       ├── templates/        # HTMLテンプレート
│   │   │       └── assets/           # CSS, JS
│   │   ├── config/                   # 設定管理
│   │   │   ├── ConfigManager.ts      # 設定の読み書き
│   │   │   └── presets.json          # プリセットタスク定義
│   │   └── utils/                    # ユーティリティ
│   │       ├── logger.ts             # ロギング
│   │       └── errorHandler.ts       # エラーハンドリング
│   ├── agents/                       # エージェント実装
│   │   ├── base/                     # 基底クラス
│   │   │   ├── BaseAgent.ts          # 全エージェントの基底
│   │   │   └── AgentContext.ts       # コンテキスト管理
│   │   ├── orchestrator/             # オーケストレーター
│   │   │   ├── OrchestratorAgent.ts  # オーケストレーター本体
│   │   │   ├── WorkflowEngine.ts     # ワークフロー実行エンジン
│   │   │   └── TaskAnalyzer.ts       # タスク解析
│   │   ├── pm/                       # PMエージェント
│   │   │   ├── PMAgent.ts            # PM本体
│   │   │   ├── RequirementAnalyzer.ts # 要件分析
│   │   │   └── PlanGenerator.ts      # 計画生成
│   │   ├── engineer/                 # エンジニアエージェント
│   │   │   ├── EngineerAgent.ts      # エンジニア本体
│   │   │   ├── CodeGenerator.ts      # コード生成
│   │   │   └── DependencyManager.ts  # 依存管理
│   │   ├── reviewer/                 # レビュアーエージェント
│   │   │   ├── ReviewerAgent.ts      # レビュアー本体
│   │   │   ├── SecurityChecker.ts    # セキュリティチェック
│   │   │   └── QualityAnalyzer.ts    # 品質分析
│   │   └── types.ts                  # エージェント共通型定義
│   ├── claude/                       # Claude API統合
│   │   ├── ClaudeClient.ts           # APIクライアント
│   │   ├── PromptBuilder.ts          # プロンプト構築
│   │   └── ResponseParser.ts         # レスポンス解析
│   └── types/                        # 型定義
│       ├── workflow.ts               # ワークフロー関連
│       ├── agent.ts                  # エージェント関連
│       └── vscode.d.ts               # VSCode拡張型定義
├── docs/                             # ドキュメント
│   ├── claude.md                     # Claude Code向けドキュメント
│   ├── skill.md                      # Skill定義
│   ├── ARCHITECTURE.md               # アーキテクチャ設計
│   ├── ja/                           # 日本語ドキュメント
│   │   ├── README.md                 # 日本語README
│   │   ├── INSTALLATION.md           # インストールガイド
│   │   ├── USER_GUIDE.md             # ユーザーガイド
│   │   └── DEVELOPMENT.md            # 開発者ガイド
│   └── en/                           # 英語ドキュメント
│       └── README.md                 # 英語README
├── test/                             # テスト
│   ├── suite/                        # テストスイート
│   │   ├── agents/                   # エージェントテスト
│   │   ├── extension/                # 拡張機能テスト
│   │   └── integration/              # 統合テスト
│   └── fixtures/                     # テストデータ
├── examples/                         # サンプルプロジェクト
│   ├── simple-crud/                  # シンプルなCRUDアプリ例
│   └── security-review/              # セキュリティレビュー例
├── .github/                          # GitHub設定
│   ├── workflows/                    # GitHub Actions
│   │   ├── ci.yml                    # CI/CD
│   │   └── release.yml               # リリース自動化
│   └── ISSUE_TEMPLATE/               # Issue テンプレート
├── package.json                      # npm パッケージ定義
├── tsconfig.json                     # TypeScript設定
├── .eslintrc.json                    # ESLint設定
├── .prettierrc                       # Prettier設定
├── .gitignore                        # Git除外設定
├── README.md                         # プロジェクトREADME
├── REQUIREMENTS.md                   # 要件定義書（既作成）
├── LICENSE                           # ライセンス
└── CHANGELOG.md                      # 変更履歴
```

---

## 主要コンポーネント説明

### 1. VSCode拡張 (`src/extension/`)

#### extension.ts
VSCode拡張のエントリーポイント

**責務**:
- 拡張のアクティベーション
- コマンドの登録
- UIコンポーネントの初期化
- グローバルステートの管理

#### commands/
ユーザーが実行できるコマンドの実装

**主要コマンド**:
- `claude-workflow.start` - ワークフロー開始
- `claude-workflow.status` - 実行状況表示
- `claude-workflow.cancel` - 実行中断
- `claude-workflow.history` - 履歴表示

#### ui/
ユーザーインターフェース実装

**コンポーネント**:
- **WorkflowPanel**: サイドバーのメインパネル
- **ChatView**: エージェントとの対話UI
- **AgentStatusView**: エージェント実行状態の可視化

---

### 2. エージェント (`src/agents/`)

#### base/BaseAgent.ts
全エージェントの基底クラス

```typescript
abstract class BaseAgent {
  constructor(
    protected context: AgentContext,
    protected claudeClient: ClaudeClient
  ) {}

  abstract async execute(input: AgentInput): Promise<AgentOutput>

  protected async callClaude(prompt: string): Promise<string>
  protected log(message: string): void
  protected emitProgress(progress: number): void
}
```

#### orchestrator/OrchestratorAgent.ts
ワークフロー全体を統括

**主要メソッド**:
- `analyzeTask()` - タスク解析
- `createWorkflow()` - ワークフロー生成
- `executeWorkflow()` - 順次実行制御
- `handleError()` - エラーハンドリング

**ワークフロー例**:
```typescript
{
  steps: [
    { agent: 'pm', input: userTask },
    { agent: 'engineer', input: pmOutput },
    { agent: 'reviewer', input: engineerOutput }
  ],
  currentStep: 0,
  status: 'running'
}
```

#### pm/PMAgent.ts
要件整理・計画立案

**入力**: ユーザータスク + コードベース情報
**出力**:
```typescript
{
  requirements: string[],      // 構造化された要件
  implementationPlan: {
    tasks: Task[],              // サブタスクリスト
    priority: 'high' | 'medium' | 'low',
    estimatedComplexity: number,
    risks: string[]
  },
  technicalConstraints: string[]
}
```

#### engineer/EngineerAgent.ts
コード実装

**入力**: PMの計画
**出力**:
```typescript
{
  generatedCode: {
    filePath: string,
    content: string,
    changeType: 'create' | 'modify' | 'delete'
  }[],
  dependencies: string[],
  testSuggestions: string[]
}
```

#### reviewer/ReviewerAgent.ts
品質・セキュリティレビュー

**入力**: エンジニアの生成コード
**出力**:
```typescript
{
  securityIssues: {
    severity: 'critical' | 'high' | 'medium' | 'low',
    type: string,           // 'XSS', 'SQL Injection', etc.
    location: string,
    description: string,
    suggestion: string
  }[],
  qualityIssues: {
    type: string,           // 'readability', 'performance', etc.
    description: string,
    suggestion: string
  }[],
  overallScore: number,     // 0-100
  approved: boolean
}
```

---

### 3. Claude統合 (`src/claude/`)

#### ClaudeClient.ts
Claude API とのインターフェース

**機能**:
- API リクエスト送信
- レート制限管理
- リトライ処理
- ストリーミング対応

**設定**:
```typescript
{
  model: 'claude-opus-4-5' | 'claude-sonnet-4-5',
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000
}
```

#### PromptBuilder.ts
各エージェント用のプロンプト構築

**テンプレート管理**:
- PMエージェント用プロンプト
- エンジニア用プロンプト
- レビュアー用プロンプト
- 日本語対応

---

## データフロー

```
User Input (日本語タスク)
    ↓
VSCode Extension
    ↓
OrchestratorAgent.analyzeTask()
    ↓
WorkflowEngine.createWorkflow()
    ↓
┌─────────────────────────────────────┐
│ Step 1: PMAgent                     │
│  - ClaudeClient.call()              │
│  - PromptBuilder.buildPMPrompt()    │
│  - 計画生成                           │
└─────────────────────────────────────┘
    ↓ [ユーザー承認]
┌─────────────────────────────────────┐
│ Step 2: EngineerAgent               │
│  - PMの計画を受け取り                  │
│  - ClaudeClient.call()              │
│  - コード生成                          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Step 3: ReviewerAgent               │
│  - 生成コードを受け取り                 │
│  - セキュリティチェック                 │
│  - 品質分析                           │
└─────────────────────────────────────┘
    ↓
最終レポート生成
    ↓
VSCode UI に表示
```

---

## 設定ファイル

### package.json（VSCode拡張定義）

```json
{
  "name": "vscode-claude-workflow",
  "displayName": "Claude Workflow",
  "description": "AI エージェント協働による開発支援",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onCommand:claude-workflow.start"
  ],
  "main": "./out/extension/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "claude-workflow.start",
        "title": "Claude Workflow: ワークフロー開始",
        "category": "Claude Workflow"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "claude-workflow",
          "title": "Claude Workflow",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "claude-workflow": [
        {
          "id": "claude-workflow.panel",
          "name": "ワークフロー"
        }
      ]
    },
    "configuration": {
      "title": "Claude Workflow",
      "properties": {
        "claudeWorkflow.apiKey": {
          "type": "string",
          "description": "Claude API キー"
        },
        "claudeWorkflow.model": {
          "type": "string",
          "enum": ["claude-opus-4-5", "claude-sonnet-4-5"],
          "default": "claude-sonnet-4-5"
        }
      }
    }
  }
}
```

### presets.json（プリセットタスク）

```json
{
  "presets": [
    {
      "id": "add-feature",
      "title": "新機能を追加",
      "description": "新しい機能を設計・実装します",
      "prompt": "以下の機能を追加してください:\n{user_input}",
      "category": "開発"
    },
    {
      "id": "fix-bug",
      "title": "バグを修正",
      "description": "バグを特定し、修正します",
      "prompt": "以下のバグを修正してください:\n{user_input}",
      "category": "保守"
    },
    {
      "id": "security-review",
      "title": "セキュリティ診断",
      "description": "コードのセキュリティ脆弱性をチェックします",
      "prompt": "選択されたコードのセキュリティ診断を実行してください",
      "category": "品質"
    },
    {
      "id": "refactor",
      "title": "リファクタリング",
      "description": "コードの構造を改善します",
      "prompt": "以下のコードをリファクタリングしてください:\n{user_input}",
      "category": "保守"
    }
  ]
}
```

---

## 技術スタック詳細

### 依存パッケージ

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "vscode": "^1.85.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "typescript": "^5.3.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "prettier": "^3.1.0"
  }
}
```

---

## 次のステップ

1. ✅ プロジェクト構成設計完了
2. ⬜ プロジェクトディレクトリ・ファイル作成
3. ⬜ `claude.md` 作成（エージェント詳細設計）
4. ⬜ 基本実装開始

---

**作成日**: 2026-01-03
**バージョン**: 1.0
