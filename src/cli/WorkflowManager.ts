/**
 * ワークフロー管理クラス
 *
 * PM → Engineer → Reviewer の連携を管理し、
 * ユーザー承認のタイミングを制御します。
 */

import { EventEmitter } from 'events';
import { ClaudeCodeRunner, AgentResult } from './ClaudeCodeRunner';
import {
  WorkflowStatus,
  WorkflowResult,
  UserTask,
  PMOutput,
  EngineerOutput,
  ReviewerOutput,
  AgentEvent,
  AgentType,
} from '../types/agent';

/**
 * ワークフローマネージャーのオプション
 */
export interface WorkflowManagerOptions {
  /** プロジェクトのルートディレクトリ */
  projectRoot: string;
  /** Claude Code Runner（未指定の場合は自動生成） */
  runner?: ClaudeCodeRunner;
}

/**
 * ユーザー承認のコールバック
 *
 * @param pmOutput PMエージェントの出力
 * @returns ユーザーが承認した場合は true
 */
export type ApprovalCallback = (pmOutput: PMOutput) => Promise<boolean>;

/**
 * ワークフローマネージャー
 *
 * @example
 * ```typescript
 * const manager = new WorkflowManager({
 *   projectRoot: '/path/to/project'
 * });
 *
 * // イベントリスナーの登録
 * manager.on('statusChange', (status) => {
 *   console.log('ステータス:', status);
 * });
 *
 * manager.on('agentEvent', (event) => {
 *   console.log(`${event.agentType}: ${event.message}`);
 * });
 *
 * // ワークフローの実行
 * const result = await manager.executeWorkflow(
 *   { description: 'Hello Worldを作成' },
 *   async (pmOutput) => {
 *     // PMの計画をユーザーに提示
 *     console.log(pmOutput);
 *     return true; // 承認
 *   }
 * );
 * ```
 */
export class WorkflowManager extends EventEmitter {
  private runner: ClaudeCodeRunner;
  private currentStatus: WorkflowStatus = 'idle';
  private currentResult: WorkflowResult = { status: 'idle' };

  constructor(options: WorkflowManagerOptions) {
    super();
    this.runner =
      options.runner ||
      new ClaudeCodeRunner({ projectRoot: options.projectRoot });

    // Claude Code Runner のイベントを転送
    this.runner.on('start', (data) => {
      this.emitAgentEvent('start', data.agentName, `${data.agentName} を起動中...`);
    });

    this.runner.on('progress', (data) => {
      this.emitAgentEvent('progress', data.agentName, data.message);
    });

    this.runner.on('complete', (data) => {
      this.emitAgentEvent('complete', data.agentName, `${data.agentName} が完了しました`);
    });

    this.runner.on('error', (data) => {
      this.emitAgentEvent('error', data.agentName, data.error);
    });
  }

  /**
   * 現在のワークフローステータスを取得
   */
  getStatus(): WorkflowStatus {
    return this.currentStatus;
  }

  /**
   * 現在のワークフロー結果を取得
   */
  getResult(): WorkflowResult {
    return this.currentResult;
  }

  /**
   * ワークフローを実行
   *
   * @param task ユーザーからのタスク
   * @param approvalCallback ユーザー承認のコールバック
   * @returns ワークフローの実行結果
   */
  async executeWorkflow(
    task: UserTask,
    approvalCallback: ApprovalCallback
  ): Promise<WorkflowResult> {
    try {
      this.updateStatus('planning');

      // ステップ1: PMエージェントで計画立案
      const pmResult = await this.runPMAgent(task);
      if (!pmResult.success || !pmResult.output) {
        return this.handleError('PMエージェントの実行に失敗しました', pmResult.error);
      }

      const pmOutput = this.parsePMOutput(pmResult.output);
      console.log('[WorkflowManager] Parsed PM output:', JSON.stringify(pmOutput, null, 2));
      this.currentResult.pmOutput = pmOutput;

      // ステップ2: ユーザー承認を待つ
      this.updateStatus('awaiting_approval');
      const approved = await approvalCallback(pmOutput);

      if (!approved) {
        this.updateStatus('cancelled');
        return { status: 'cancelled', pmOutput };
      }

      // ステップ3: エンジニアエージェントでコード生成
      this.updateStatus('implementing');
      const engineerResult = await this.runEngineerAgent(pmOutput);
      if (!engineerResult.success || !engineerResult.output) {
        return this.handleError('エンジニアエージェントの実行に失敗しました', engineerResult.error);
      }

      const engineerOutput = this.parseEngineerOutput(engineerResult.output);
      this.currentResult.engineerOutput = engineerOutput;

      // ステップ4: レビュアーエージェントで品質チェック
      this.updateStatus('reviewing');
      const reviewerResult = await this.runReviewerAgent(engineerOutput);
      if (!reviewerResult.success || !reviewerResult.output) {
        return this.handleError('レビュアーエージェントの実行に失敗しました', reviewerResult.error);
      }

      const reviewerOutput = this.parseReviewerOutput(reviewerResult.output);
      this.currentResult.reviewerOutput = reviewerOutput;

      // ステップ5: 完了
      this.updateStatus('completed');
      return {
        status: 'completed',
        pmOutput,
        engineerOutput,
        reviewerOutput,
      };
    } catch (error) {
      return this.handleError('ワークフローの実行中にエラーが発生しました', error);
    }
  }

  /**
   * PMエージェントを実行
   */
  private async runPMAgent(task: UserTask): Promise<AgentResult> {
    const prompt = this.buildPMPrompt(task);
    return await this.runner.invokeAgent('pm-agent', prompt);
  }

  /**
   * エンジニアエージェントを実行
   */
  private async runEngineerAgent(pmOutput: PMOutput): Promise<AgentResult> {
    const prompt = this.buildEngineerPrompt(pmOutput);
    return await this.runner.invokeAgent('engineer-agent', prompt);
  }

  /**
   * レビュアーエージェントを実行
   */
  private async runReviewerAgent(engineerOutput: EngineerOutput): Promise<AgentResult> {
    const prompt = this.buildReviewerPrompt(engineerOutput);
    return await this.runner.invokeAgent('reviewer-agent', prompt);
  }

  /**
   * PMエージェント用のプロンプトを構築
   */
  private buildPMPrompt(task: UserTask): string {
    let prompt = `以下のタスクについて実装計画を立案してください：\n\n`;
    prompt += `**ユーザーのタスク**: ${task.description}\n\n`;

    // 詳細情報を追加
    if (task.purpose) {
      prompt += `**目的・背景**: ${task.purpose}\n\n`;
    }
    if (task.techStack) {
      prompt += `**技術スタック**: ${task.techStack}\n\n`;
    }
    if (task.backend) {
      prompt += `**バックエンド・インフラ**: ${task.backend}\n\n`;
    }
    if (task.constraints) {
      prompt += `**制約・注意事項**: ${task.constraints}\n\n`;
    }
    if (task.other) {
      prompt += `**その他の要望**: ${task.other}\n\n`;
    }
    if (task.context) {
      prompt += `**コンテキスト**:\n${task.context}\n\n`;
    }

    prompt += `\n**重要**: 必ず以下のJSON形式のみで返してください。説明文やマークダウンは含めず、純粋なJSONのみを出力してください：\n\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{\n`;
    prompt += `  "requirements": ["要件1", "要件2"],\n`;
    prompt += `  "implementationPlan": {\n`;
    prompt += `    "tasks": [\n`;
    prompt += `      {\n`;
    prompt += `        "id": "task-1",\n`;
    prompt += `        "description": "タスクの説明",\n`;
    prompt += `        "priority": "high",\n`;
    prompt += `        "estimatedEffort": "小",\n`;
    prompt += `        "dependencies": [],\n`;
    prompt += `        "files": ["ファイルパス"]\n`;
    prompt += `      }\n`;
    prompt += `    ],\n`;
    prompt += `    "estimatedComplexity": 5,\n`;
    prompt += `    "risks": ["リスク1"]\n`;
    prompt += `  },\n`;
    prompt += `  "successCriteria": ["基準1"],\n`;
    prompt += `  "notes": ["メモ1"]\n`;
    prompt += `}\n`;
    prompt += `\`\`\``;

    return prompt;
  }

  /**
   * エンジニアエージェント用のプロンプトを構築
   */
  private buildEngineerPrompt(pmOutput: PMOutput): string {
    let prompt = `あなたは .claude/agents/engineer-agent.md で定義されたエンジニアエージェントとして動作してください。\n\n`;
    prompt += `以下のPMの実装計画に基づいて、コードを生成してください：\n\n`;
    prompt += `**PMの計画**:\n\`\`\`json\n${JSON.stringify(pmOutput, null, 2)}\n\`\`\`\n\n`;
    prompt += `engineer-agent.md に記載された形式に従って、以下を実行してください：\n`;
    prompt += `1. 既存のコードベースを調査\n`;
    prompt += `2. 計画に従ってコードを生成・変更\n`;
    prompt += `3. JSON形式で結果を返す（generatedFiles, dependencies, notes）`;

    return prompt;
  }

  /**
   * レビュアーエージェント用のプロンプトを構築
   */
  private buildReviewerPrompt(engineerOutput: EngineerOutput): string {
    let prompt = `あなたは .claude/agents/reviewer-agent.md で定義されたレビュアーエージェントとして動作してください。\n\n`;
    prompt += `以下のエンジニアが生成したコードをレビューしてください：\n\n`;
    prompt += `**生成されたファイル**:\n`;

    engineerOutput.generatedFiles.forEach((file) => {
      prompt += `- ${file.path} (${file.action}): ${file.summary}\n`;
    });

    prompt += `\n**重要**: 必ず以下のJSON形式のみで返してください。説明文やマークダウンは含めず、純粋なJSONのみを出力してください：\n\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{\n`;
    prompt += `  "securityIssues": [],\n`;
    prompt += `  "qualityIssues": [],\n`;
    prompt += `  "bestPractices": [],\n`;
    prompt += `  "overallScore": 85,\n`;
    prompt += `  "approved": true,\n`;
    prompt += `  "summary": "全体的な評価のサマリー"\n`;
    prompt += `}\n`;
    prompt += `\`\`\``;

    return prompt;
  }

  /**
   * PMエージェントの出力をパース
   */
  private parsePMOutput(output: string): PMOutput {
    console.log('[parsePMOutput] Raw output length:', output.length);
    console.log('[parsePMOutput] First 500 chars:', output.substring(0, 500));
    try {
      // 方法1: ```json ブロックを抽出
      const jsonBlockMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        return JSON.parse(jsonBlockMatch[1]);
      }

      // 方法2: { から始まるJSON を探す
      const jsonStartIndex = output.indexOf('{');
      if (jsonStartIndex !== -1) {
        // 最後の } を見つける
        let braceCount = 0;
        let jsonEndIndex = -1;
        for (let i = jsonStartIndex; i < output.length; i++) {
          if (output[i] === '{') braceCount++;
          if (output[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEndIndex = i + 1;
              break;
            }
          }
        }

        if (jsonEndIndex !== -1) {
          const jsonStr = output.substring(jsonStartIndex, jsonEndIndex);
          return JSON.parse(jsonStr);
        }
      }

      // 方法3: 全体をパース
      return JSON.parse(output);
    } catch (error) {
      // JSONパースに失敗した場合、デフォルト構造を返す
      console.error('Failed to parse PM output as JSON:', error);
      console.error('Raw output:', output);

      // テキスト出力からダミーのPMOutputを生成
      return {
        requirements: ['タスクの分析結果（JSON形式で返されませんでした）'],
        implementationPlan: {
          tasks: [
            {
              id: 'task-1',
              description: output.substring(0, 200), // 最初の200文字を使用
              priority: 'high',
              estimatedEffort: '小',
              dependencies: [],
              files: [],
            },
          ],
          estimatedComplexity: 5,
          risks: [],
        },
        successCriteria: ['実装が完了すること'],
        notes: [
          'エージェントがJSON形式で応答しませんでした',
          '生のテキスト出力を確認してください',
        ],
      };
    }
  }

  /**
   * エンジニアエージェントの出力をパース
   */
  private parseEngineerOutput(output: string): EngineerOutput {
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(output);
  }

  /**
   * レビュアーエージェントの出力をパース
   */
  private parseReviewerOutput(output: string): ReviewerOutput {
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(output);
  }

  /**
   * ワークフローステータスを更新
   */
  private updateStatus(status: WorkflowStatus): void {
    this.currentStatus = status;
    this.currentResult.status = status;
    this.emit('statusChange', status);
  }

  /**
   * エラーを処理
   */
  private handleError(message: string, error?: unknown): WorkflowResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.updateStatus('failed');
    this.currentResult.error = `${message}: ${errorMessage}`;
    return this.currentResult;
  }

  /**
   * エージェントイベントを発行
   */
  private emitAgentEvent(
    type: AgentEvent['type'],
    agentType: string,
    message: string,
    data?: unknown
  ): void {
    const event: AgentEvent = {
      type,
      agentType: agentType as AgentType,
      message,
      data,
      timestamp: new Date(),
    };
    this.emit('agentEvent', event);
  }

  /**
   * ワークフローを停止
   */
  stop(): void {
    this.runner.stop();
    this.updateStatus('cancelled');
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.runner.dispose();
    this.removeAllListeners();
  }
}
