# vscode-claude-workflow - Claude Code 開発ガイド

> このドキュメントは、Claude Codeがvscode-claude-workflowプロジェクトを理解し、効果的に開発を支援するためのガイドです。

## プロジェクト概要

**vscode-claude-workflow** は、VSCode拡張機能として、複数のAIエージェント（オーケストレーター、PM、エンジニア、レビュアー）が協働してソフトウェア開発を支援するシステムです。

### 主要コンポーネント

1. **オーケストレーターエージェント**: 全体統括、ワークフロー管理
2. **PMエージェント**: 要件整理・計画立案
3. **エンジニアエージェント**: コード生成・実装
4. **レビュアーエージェント**: セキュリティ・品質チェック
5. **VSCode拡張UI**: 日本語GUI、対話インターフェース

## アーキテクチャ

```
User (VSCode UI)
    ↓
Extension (extension.ts)
    ↓
OrchestratorAgent
    ↓
  ├── PMAgent (Claude Agent SDK)
  ├── EngineerAgent (Claude Agent SDK)
  └── ReviewerAgent (Claude Agent SDK)
    ↓
ClaudeClient (Anthropic API)
```

## 実装戦略

### フェーズ1: 基盤構築（現在）

#### 1.1 型定義 (`/src/types/`)

**agent.ts**:
```typescript
export type AgentType = 'pm' | 'engineer' | 'reviewer' | 'orchestrator';

export interface AgentInput {
  task: string;
  context?: Record<string, any>;
  previousOutput?: AgentOutput;
}

export interface AgentOutput {
  agentType: AgentType;
  result: Record<string, any>;
  metadata: {
    executionTime: number;
    tokensUsed: number;
    model: string;
  };
  nextAction?: 'approve' | 'reject' | 'modify';
}
```

**workflow.ts**:
```typescript
export interface WorkflowStep {
  agentType: AgentType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting-approval';
  input?: AgentInput;
  output?: AgentOutput;
  error?: string;
}

export interface Workflow {
  id: string;
  steps: WorkflowStep[];
  currentStepIndex: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}
```

#### 1.2 Claude API統合 (`/src/claude/`)

**ClaudeClient.ts** - 重要な実装ポイント:

```typescript
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async sendMessage(
    systemPrompt: string,
    userMessage: string,
    config: AgentConfig
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      });

      return response.content[0].type === 'text'
        ? response.content[0].text
        : '';
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  private handleAPIError(error: any): Error {
    if (error.status === 429) {
      return new Error('レート制限に達しました。しばらく待ってから再試行してください。');
    } else if (error.status === 401) {
      return new Error('APIキーが無効です。設定を確認してください。');
    } else {
      return new Error(`Claude API エラー: ${error.message}`);
    }
  }
}
```

**PromptBuilder.ts** - 各エージェント用のプロンプトテンプレート:

```typescript
export class PromptBuilder {
  static buildPMPrompt(task: string, codebaseInfo: string): string {
    return `
あなたは経験豊富なプロジェクトマネージャーです。
ユーザーから依頼されたタスクを分析し、明確な実装計画を立案してください。

## タスク
${task}

## コードベース情報
${codebaseInfo}

## 要求される出力
以下のJSON形式で計画を返してください：

\`\`\`json
{
  "requirements": ["要件1", "要件2", ...],
  "implementationPlan": {
    "tasks": [
      {
        "id": "task-1",
        "description": "タスクの詳細説明",
        "priority": "high" | "medium" | "low",
        "dependencies": ["task-id", ...]
      }
    ],
    "estimatedComplexity": 1-10,
    "risks": ["リスク1", "リスク2", ...]
  },
  "technicalConstraints": ["制約1", "制約2", ...]
}
\`\`\`

## 重要な指示
- 計画は具体的で実行可能であること
- タスクは適切な粒度に分解すること
- リスクは明確に特定すること
- 技術的制約を考慮すること
    `.trim();
  }

  static buildEngineerPrompt(pmPlan: PMOutput, codebaseInfo: string): string {
    return `
あなたは熟練したソフトウェアエンジニアです。
PMが作成した計画に基づいて、高品質なコードを実装してください。

## 実装計画
${JSON.stringify(pmPlan, null, 2)}

## コードベース情報
${codebaseInfo}

## 要求される出力
以下のJSON形式でコード生成結果を返してください：

\`\`\`json
{
  "generatedCode": [
    {
      "filePath": "/path/to/file.ts",
      "content": "ファイルの完全な内容",
      "changeType": "create" | "modify" | "delete",
      "explanation": "このファイルの役割と実装の説明"
    }
  ],
  "dependencies": ["パッケージ名1", "パッケージ名2", ...],
  "testSuggestions": [
    "テスト提案1: 具体的なテストケース",
    "テスト提案2: ..."
  ]
}
\`\`\`

## 重要な指示
- コードは本番環境で使用できる品質であること
- TypeScriptのベストプラクティスに従うこと
- セキュリティを考慮すること（XSS、SQLインジェクション等）
- エラーハンドリングを適切に実装すること
- コメントは日本語で記載すること
    `.trim();
  }

  static buildReviewerPrompt(code: EngineerOutput): string {
    return `
あなたはセキュリティとコード品質の専門家です。
生成されたコードをレビューし、問題点と改善提案を提示してください。

## 生成されたコード
${JSON.stringify(code, null, 2)}

## レビュー観点
1. **セキュリティ**: OWASP Top 10の脆弱性をチェック
2. **コード品質**: 可読性、保守性、パフォーマンス
3. **ベストプラクティス**: TypeScript/Node.jsの推奨パターン
4. **テスト容易性**: テスタビリティの評価

## 要求される出力
以下のJSON形式でレビュー結果を返してください：

\`\`\`json
{
  "securityIssues": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "type": "XSS" | "SQL Injection" | "Path Traversal" | ...,
      "location": "file.ts:line",
      "description": "問題の詳細説明",
      "suggestion": "具体的な修正方法"
    }
  ],
  "qualityIssues": [
    {
      "type": "readability" | "performance" | "maintainability",
      "location": "file.ts:line",
      "description": "問題の詳細説明",
      "suggestion": "具体的な改善提案"
    }
  ],
  "overallScore": 0-100,
  "approved": true | false,
  "summary": "レビュー全体の総括"
}
\`\`\`

## 重要な指示
- 厳格にレビューすること
- 問題がない場合でも改善提案を出すこと
- approved は致命的な問題がない場合のみ true
- 日本語で明確に説明すること
    `.trim();
  }
}
```

### フェーズ2: エージェント実装

#### 2.1 BaseAgent (`/src/agents/base/BaseAgent.ts`)

全エージェントの基底クラス。重要な共通機能を提供：

```typescript
import { ClaudeClient } from '../../claude/ClaudeClient';
import { AgentInput, AgentOutput, AgentConfig } from '../../types/agent';
import { EventEmitter } from 'events';

export abstract class BaseAgent extends EventEmitter {
  protected claudeClient: ClaudeClient;
  protected config: AgentConfig;

  constructor(claudeClient: ClaudeClient, config: AgentConfig) {
    super();
    this.claudeClient = claudeClient;
    this.config = config;
  }

  /**
   * エージェントのメイン処理
   * サブクラスで必ず実装すること
   */
  abstract execute(input: AgentInput): Promise<AgentOutput>;

  /**
   * Claude APIを呼び出す共通メソッド
   */
  protected async callClaude(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const startTime = Date.now();

    this.emit('progress', { status: 'calling-api' });

    const response = await this.claudeClient.sendMessage(
      systemPrompt,
      userPrompt,
      this.config
    );

    const executionTime = Date.now() - startTime;
    this.emit('progress', { status: 'api-completed', executionTime });

    return response;
  }

  /**
   * JSON応答をパースする共通メソッド
   * ```json ... ``` ブロックを抽出してパース
   */
  protected parseJSONResponse<T>(response: string): T {
    try {
      // JSONブロックを抽出（```json...```）
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      return JSON.parse(jsonStr);
    } catch (error) {
      this.log(`JSON パースエラー: ${error}`, 'error');
      this.log(`応答内容: ${response}`, 'error');
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  }

  /**
   * ログを出力する共通メソッド
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    this.emit('log', { message, level, timestamp: new Date() });
  }
}
```

#### 2.2 PMAgent (`/src/agents/pm/PMAgent.ts`)

```typescript
import { BaseAgent } from '../base/BaseAgent';
import { AgentInput, AgentOutput } from '../../types/agent';
import { PromptBuilder } from '../../claude/PromptBuilder';

export interface PMOutput {
  requirements: string[];
  implementationPlan: {
    tasks: Array<{
      id: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      dependencies?: string[];
    }>;
    estimatedComplexity: number;
    risks: string[];
  };
  technicalConstraints: string[];
}

export class PMAgent extends BaseAgent {
  async execute(input: AgentInput): Promise<AgentOutput> {
    this.log('PMエージェント: タスク分析を開始します');

    const systemPrompt = this.config.systemPrompt;
    const userPrompt = PromptBuilder.buildPMPrompt(
      input.task,
      JSON.stringify(input.context?.codebaseInfo || {})
    );

    try {
      const response = await this.callClaude(systemPrompt, userPrompt);
      const parsedOutput = this.parseJSONResponse<PMOutput>(response);

      this.log(`計画立案完了: ${parsedOutput.implementationPlan.tasks.length}個のタスクを特定`);

      return {
        agentType: 'pm',
        result: parsedOutput,
        metadata: {
          executionTime: 0, // BaseAgentで計測済み
          tokensUsed: 0,    // 実装時にAPIレスポンスから取得
          model: this.config.model
        },
        nextAction: 'approve' // ユーザー承認待ち
      };
    } catch (error) {
      this.log(`エラー: ${error}`, 'error');
      throw error;
    }
  }
}
```

#### 2.3 EngineerAgent (`/src/agents/engineer/EngineerAgent.ts`)

```typescript
import { BaseAgent } from '../base/BaseAgent';
import { AgentInput, AgentOutput } from '../../types/agent';
import { PromptBuilder } from '../../claude/PromptBuilder';
import { PMOutput } from '../pm/PMAgent';

export interface EngineerOutput {
  generatedCode: Array<{
    filePath: string;
    content: string;
    changeType: 'create' | 'modify' | 'delete';
    explanation: string;
  }>;
  dependencies: string[];
  testSuggestions: string[];
}

export class EngineerAgent extends BaseAgent {
  async execute(input: AgentInput): Promise<AgentOutput> {
    this.log('エンジニアエージェント: コード生成を開始します');

    const pmPlan = input.previousOutput?.result as PMOutput;
    if (!pmPlan) {
      throw new Error('PM計画が必要です');
    }

    const systemPrompt = this.config.systemPrompt;
    const userPrompt = PromptBuilder.buildEngineerPrompt(
      pmPlan,
      JSON.stringify(input.context?.codebaseInfo || {})
    );

    const response = await this.callClaude(systemPrompt, userPrompt);
    const parsedOutput = this.parseJSONResponse<EngineerOutput>(response);

    this.log(`コード生成完了: ${parsedOutput.generatedCode.length}ファイル`);

    return {
      agentType: 'engineer',
      result: parsedOutput,
      metadata: {
        executionTime: 0,
        tokensUsed: 0,
        model: this.config.model
      }
    };
  }
}
```

#### 2.4 ReviewerAgent (`/src/agents/reviewer/ReviewerAgent.ts`)

```typescript
import { BaseAgent } from '../base/BaseAgent';
import { AgentInput, AgentOutput } from '../../types/agent';
import { PromptBuilder } from '../../claude/PromptBuilder';
import { EngineerOutput } from '../engineer/EngineerAgent';

export interface ReviewerOutput {
  securityIssues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    location: string;
    description: string;
    suggestion: string;
  }>;
  qualityIssues: Array<{
    type: string;
    location: string;
    description: string;
    suggestion: string;
  }>;
  overallScore: number;
  approved: boolean;
  summary: string;
}

export class ReviewerAgent extends BaseAgent {
  async execute(input: AgentInput): Promise<AgentOutput> {
    this.log('レビュアーエージェント: コードレビューを開始します');

    const engineerOutput = input.previousOutput?.result as EngineerOutput;
    if (!engineerOutput) {
      throw new Error('エンジニア出力が必要です');
    }

    const systemPrompt = this.config.systemPrompt;
    const userPrompt = PromptBuilder.buildReviewerPrompt(engineerOutput);

    const response = await this.callClaude(systemPrompt, userPrompt);
    const parsedOutput = this.parseJSONResponse<ReviewerOutput>(response);

    this.log(
      `レビュー完了: スコア${parsedOutput.overallScore}/100, ` +
      `セキュリティ問題${parsedOutput.securityIssues.length}件`
    );

    return {
      agentType: 'reviewer',
      result: parsedOutput,
      metadata: {
        executionTime: 0,
        tokensUsed: 0,
        model: this.config.model
      }
    };
  }
}
```

#### 2.5 OrchestratorAgent (`/src/agents/orchestrator/OrchestratorAgent.ts`)

最も重要なコンポーネント。全エージェントを統括：

```typescript
import { BaseAgent } from '../base/BaseAgent';
import { AgentInput, AgentOutput, AgentConfig } from '../../types/agent';
import { Workflow, WorkflowStep } from '../../types/workflow';
import { PMAgent } from '../pm/PMAgent';
import { EngineerAgent } from '../engineer/EngineerAgent';
import { ReviewerAgent } from '../reviewer/ReviewerAgent';
import { ClaudeClient } from '../../claude/ClaudeClient';

export class OrchestratorAgent extends BaseAgent {
  private pmAgent: PMAgent;
  private engineerAgent: EngineerAgent;
  private reviewerAgent: ReviewerAgent;
  private currentWorkflow?: Workflow;
  private approvalPromises: Map<string, (value: void) => void> = new Map();

  constructor(claudeClient: ClaudeClient, config: AgentConfig) {
    super(claudeClient, config);

    // 各エージェントを初期化
    this.pmAgent = new PMAgent(claudeClient, {
      ...config,
      systemPrompt: 'あなたは経験豊富なプロジェクトマネージャーです。タスクを分析し、実行可能な計画を立案してください。'
    });

    this.engineerAgent = new EngineerAgent(claudeClient, {
      ...config,
      systemPrompt: 'あなたは熟練したソフトウェアエンジニアです。高品質で保守性の高いコードを実装してください。'
    });

    this.reviewerAgent = new ReviewerAgent(claudeClient, {
      ...config,
      systemPrompt: 'あなたはセキュリティとコード品質の専門家です。厳格にレビューし、問題を特定してください。'
    });

    // イベント伝播
    [this.pmAgent, this.engineerAgent, this.reviewerAgent].forEach(agent => {
      agent.on('log', (log) => this.emit('log', log));
      agent.on('progress', (progress) => this.emit('progress', progress));
    });
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    this.log('オーケストレーター: ワークフロー開始');

    // ワークフロー作成
    this.currentWorkflow = this.createWorkflow(input);
    this.emit('workflow-created', this.currentWorkflow);

    try {
      // Step 1: PM
      this.updateWorkflowStep(0, 'running');
      const pmOutput = await this.executeStep('pm', input);
      this.updateWorkflowStep(0, 'completed', pmOutput);
      this.emit('step-completed', { step: 'pm', output: pmOutput });

      // ユーザー承認待ち
      if (pmOutput.nextAction === 'approve') {
        this.updateWorkflowStep(0, 'waiting-approval');
        this.emit('waiting-approval', { step: 'pm', output: pmOutput });
        await this.waitForApproval('pm');
      }

      // Step 2: Engineer
      this.updateWorkflowStep(1, 'running');
      const engineerInput: AgentInput = {
        ...input,
        previousOutput: pmOutput
      };
      const engineerOutput = await this.executeStep('engineer', engineerInput);
      this.updateWorkflowStep(1, 'completed', engineerOutput);
      this.emit('step-completed', { step: 'engineer', output: engineerOutput });

      // Step 3: Reviewer
      this.updateWorkflowStep(2, 'running');
      const reviewerInput: AgentInput = {
        ...input,
        previousOutput: engineerOutput
      };
      const reviewerOutput = await this.executeStep('reviewer', reviewerInput);
      this.updateWorkflowStep(2, 'completed', reviewerOutput);
      this.emit('step-completed', { step: 'reviewer', output: reviewerOutput });

      // ワークフロー完了
      this.currentWorkflow.status = 'completed';
      this.currentWorkflow.completedAt = new Date();

      this.log('ワークフロー完了');

      return {
        agentType: 'orchestrator',
        result: {
          workflow: this.currentWorkflow,
          pmOutput: pmOutput.result,
          engineerOutput: engineerOutput.result,
          reviewerOutput: reviewerOutput.result
        },
        metadata: {
          executionTime: Date.now() - this.currentWorkflow.createdAt.getTime(),
          tokensUsed: 0, // 各エージェントの合計
          model: this.config.model
        }
      };

    } catch (error) {
      this.currentWorkflow.status = 'failed';
      this.log(`ワークフローエラー: ${error}`, 'error');
      throw error;
    }
  }

  private async executeStep(
    agentType: 'pm' | 'engineer' | 'reviewer',
    input: AgentInput
  ): Promise<AgentOutput> {
    const agent =
      agentType === 'pm' ? this.pmAgent :
      agentType === 'engineer' ? this.engineerAgent :
      this.reviewerAgent;

    return await agent.execute(input);
  }

  private createWorkflow(input: AgentInput): Workflow {
    return {
      id: `workflow-${Date.now()}`,
      steps: [
        { agentType: 'pm', status: 'pending' },
        { agentType: 'engineer', status: 'pending' },
        { agentType: 'reviewer', status: 'pending' }
      ],
      currentStepIndex: 0,
      status: 'running',
      createdAt: new Date()
    };
  }

  private updateWorkflowStep(
    index: number,
    status: WorkflowStep['status'],
    output?: AgentOutput
  ): void {
    if (this.currentWorkflow) {
      this.currentWorkflow.steps[index].status = status;
      if (output) {
        this.currentWorkflow.steps[index].output = output;
      }
      this.currentWorkflow.currentStepIndex = index;
      this.emit('workflow-updated', this.currentWorkflow);
    }
  }

  private async waitForApproval(step: string): Promise<void> {
    return new Promise((resolve) => {
      this.approvalPromises.set(step, resolve);
    });
  }

  /**
   * UI側から呼び出される承認メソッド
   */
  public approve(step: string): void {
    const resolve = this.approvalPromises.get(step);
    if (resolve) {
      resolve();
      this.approvalPromises.delete(step);
      this.log(`${step} ステップが承認されました`);
    }
  }

  /**
   * ワークフロー全体をキャンセル
   */
  public cancel(): void {
    if (this.currentWorkflow) {
      this.currentWorkflow.status = 'failed';
      this.emit('workflow-cancelled');
      this.log('ワークフローがキャンセルされました', 'warn');
    }
  }
}
```

### フェーズ3: VSCode拡張実装

#### 3.1 Extension Entry Point (`/src/extension/extension.ts`)

```typescript
import * as vscode from 'vscode';
import { WorkflowPanel } from './ui/sidebar/WorkflowPanel';
import { ClaudeClient } from '../claude/ClaudeClient';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Claude Workflow 拡張が有効化されました');

  // APIキー取得
  const apiKey = await getAPIKey(context);
  if (!apiKey) {
    const action = await vscode.window.showWarningMessage(
      'Claude API キーが設定されていません。',
      '設定する'
    );

    if (action === '設定する') {
      await vscode.commands.executeCommand('claude-workflow.configure');
    }
    return;
  }

  // ClaudeClient初期化
  const claudeClient = new ClaudeClient(apiKey);

  // サイドバーパネル登録
  const workflowPanel = new WorkflowPanel(context.extensionUri, claudeClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'claude-workflow.panel',
      workflowPanel
    )
  );

  // コマンド登録
  context.subscriptions.push(
    vscode.commands.registerCommand('claude-workflow.start', async () => {
      const task = await vscode.window.showInputBox({
        prompt: 'タスクを入力してください',
        placeHolder: '例: ユーザー認証機能を追加'
      });

      if (task) {
        workflowPanel.startWorkflow(task);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-workflow.configure', async () => {
      const newApiKey = await vscode.window.showInputBox({
        prompt: 'Claude API キーを入力',
        password: true,
        placeHolder: 'sk-ant-...'
      });

      if (newApiKey) {
        await context.secrets.store('claude-api-key', newApiKey);
        vscode.window.showInformationMessage('APIキーを保存しました。拡張を再読み込みしてください。');
      }
    })
  );
}

async function getAPIKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  // Secret Storageから取得
  let apiKey = await context.secrets.get('claude-api-key');

  // なければ設定から取得（後方互換性）
  if (!apiKey) {
    apiKey = vscode.workspace.getConfiguration('claudeWorkflow').get('apiKey');
    if (apiKey) {
      // Secret Storageに移行
      await context.secrets.store('claude-api-key', apiKey);
    }
  }

  return apiKey;
}

export function deactivate() {
  console.log('Claude Workflow 拡張が無効化されました');
}
```

## 開発時の重要な注意事項

### コーディング規約

1. **TypeScript strict mode** を有効化
2. **ESLint + Prettier** で自動フォーマット
3. 関数には **JSDoc コメント** を記載
4. 日本語コメントを積極的に活用
5. `console.log` ではなく BaseAgent の `log()` メソッドを使用

### セキュリティ

1. APIキーは **Secret Storage** のみに保存
2. ユーザー入力のサニタイズ
3. Webviewでの CSP（Content Security Policy）設定
4. 生成されたコードの実行前の確認プロンプト

### パフォーマンス

1. 大きなファイルの読み込みは streaming を使用
2. エージェント実行時の進捗イベントを適切に発火
3. 不要なオブジェクトは明示的に破棄

### エラーハンドリング

各レイヤーで適切にエラー処理：

- **ClaudeClient**: API エラー・リトライ
- **Agent**: ビジネスロジックエラー
- **Orchestrator**: ワークフローエラー
- **Extension**: UI エラー表示（日本語メッセージ）

## テスト戦略

### 単体テスト

各エージェント、ClaudeClient、PromptBuilderをモックで分離してテスト。

### 統合テスト

実際のClaude APIを使用してシンプルなタスクで全フロー確認。

### エンドツーエンドテスト

VSCode Extension Test Runnerを使用してUI操作をシミュレーション。

## 次のステップ

1. プロジェクトディレクトリ・ファイル作成
2. 基盤レイヤーの実装（Week 1）
3. エージェント実装（Week 2）
4. VSCode拡張UI実装（Week 3）
5. テスト・統合（Week 4）

## 参考資料

- [REQUIREMENTS.md](../REQUIREMENTS.md) - 要件定義
- [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) - プロジェクト構成
- [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) - 詳細実装計画
- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
- [VSCode Extension API](https://code.visualstudio.com/api)

---

**作成日**: 2026-01-03
**バージョン**: 1.0
