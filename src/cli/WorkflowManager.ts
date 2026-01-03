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
      this.emitAgentEvent('progress', data.agentName, data.chunk);
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
    let prompt = `あなたは .claude/agents/pm-agent.md で定義されたPMエージェントとして動作してください。\n\n`;
    prompt += `以下のタスクについて実装計画を立案してください：\n\n`;
    prompt += `**ユーザーのタスク**: ${task.description}\n\n`;

    if (task.context) {
      prompt += `**コンテキスト**:\n${task.context}\n\n`;
    }

    prompt += `pm-agent.md に記載された形式に従って、JSON形式で実装計画を返してください。`;

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

    prompt += `\nreviewer-agent.md に記載された形式に従って、以下をチェックしてください：\n`;
    prompt += `1. セキュリティ脆弱性（OWASP Top 10）\n`;
    prompt += `2. コード品質（可読性、保守性、パフォーマンス）\n`;
    prompt += `3. ベストプラクティス遵守\n`;
    prompt += `4. JSON形式で結果を返す`;

    return prompt;
  }

  /**
   * PMエージェントの出力をパース
   */
  private parsePMOutput(output: string): PMOutput {
    // JSONブロックを抽出
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // JSONブロックがない場合は全体をパース
    return JSON.parse(output);
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
