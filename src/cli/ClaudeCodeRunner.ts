/**
 * Claude Code CLI を実行するラッパークラス
 *
 * このクラスは Node.js の child_process を使用して Claude Code CLI を実行し、
 * エージェントとの通信を管理します。
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Claude Code の実行オプション
 */
export interface ClaudeCodeOptions {
  /** プロジェクトのルートディレクトリ */
  projectRoot: string;
  /** Claude Code CLI の実行パス（未指定の場合は自動検出） */
  claudeCliPath?: string;
  /** タイムアウト時間（ミリ秒） */
  timeout?: number;
}

/**
 * エージェントの実行結果
 */
export interface AgentResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Claude Code CLI ランナー
 *
 * @example
 * ```typescript
 * const runner = new ClaudeCodeRunner({
 *   projectRoot: '/path/to/project'
 * });
 *
 * const result = await runner.invokeAgent('orchestrator', 'Hello Worldを作成してください');
 * console.log(result.output);
 * ```
 */
export class ClaudeCodeRunner extends EventEmitter {
  private claudeCliPath: string;
  private projectRoot: string;
  private timeout: number;
  private currentProcess: ChildProcess | null = null;

  constructor(options: ClaudeCodeOptions) {
    super();
    this.projectRoot = options.projectRoot;
    this.timeout = options.timeout || 300000; // デフォルト5分
    this.claudeCliPath = options.claudeCliPath || this.detectClaudeCli();
  }

  /**
   * Claude Code CLI のパスを検出
   *
   * @returns Claude Code CLI の実行パス
   * @throws Claude Code CLI が見つからない場合
   */
  private detectClaudeCli(): string {
    // 環境変数から Claude Code のパスを取得
    const envPath = process.env.CLAUDE_CODE_PATH;
    if (envPath && fs.existsSync(envPath)) {
      return envPath;
    }

    // よくあるインストールパスをチェック
    const commonPaths = [
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      path.join(process.env.HOME || '', '.local', 'bin', 'claude'),
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // グローバル npm パッケージとしてインストールされている場合
    return 'claude';
  }

  /**
   * Claude Code CLI が利用可能かチェック
   *
   * @returns 利用可能な場合は true
   */
  async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(this.claudeCliPath, ['--version'], {
        cwd: this.projectRoot,
      });

      let output = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        resolve(code === 0 && output.includes('claude'));
      });

      process.on('error', () => {
        resolve(false);
      });

      // 3秒でタイムアウト
      setTimeout(() => {
        process.kill();
        resolve(false);
      }, 3000);
    });
  }

  /**
   * エージェントを呼び出す
   *
   * @param agentName エージェント名（orchestrator, pm-agent, engineer-agent, reviewer-agent）
   * @param prompt エージェントへの指示
   * @returns エージェントの実行結果
   */
  async invokeAgent(
    agentName: string,
    prompt: string
  ): Promise<AgentResult> {
    this.emit('start', { agentName, prompt });

    return new Promise((resolve) => {
      const agentPath = path.join(
        this.projectRoot,
        '.claude',
        'agents',
        `${agentName}.md`
      );

      // エージェント定義ファイルの存在確認
      if (!fs.existsSync(agentPath)) {
        const error = `エージェント定義ファイルが見つかりません: ${agentPath}`;
        this.emit('error', { agentName, error });
        resolve({
          success: false,
          output: '',
          error,
        });
        return;
      }

      // Claude Code CLI を実行
      // 実際のコマンドは: claude --agent <agentName> "<prompt>"
      const args = [prompt];

      this.currentProcess = spawn(this.claudeCliPath, args, {
        cwd: this.projectRoot,
        env: {
          ...process.env,
          // エージェント定義ファイルのパスを環境変数で渡す
          CLAUDE_AGENT: agentName,
          // Homebrew の bin ディレクトリを PATH に追加
          PATH: `/opt/homebrew/bin:${process.env.PATH}`,
        },
      });

      let stdout = '';
      let stderr = '';

      // 標準出力の処理
      this.currentProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        this.emit('progress', {
          agentName,
          chunk,
        });
      });

      // 標準エラー出力の処理
      this.currentProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // プロセス終了時の処理
      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;

        if (code === 0) {
          this.emit('complete', { agentName, output: stdout });
          resolve({
            success: true,
            output: stdout,
          });
        } else {
          const error = `エージェント実行が失敗しました (code: ${code})\n${stderr}`;
          this.emit('error', { agentName, error });
          resolve({
            success: false,
            output: stdout,
            error,
          });
        }
      });

      // プロセス起動エラーの処理
      this.currentProcess.on('error', (err) => {
        this.currentProcess = null;
        const error = `Claude Code の起動に失敗しました: ${err.message}`;
        this.emit('error', { agentName, error });
        resolve({
          success: false,
          output: '',
          error,
        });
      });

      // タイムアウト処理
      const timeoutId = setTimeout(() => {
        if (this.currentProcess) {
          this.currentProcess.kill();
          this.currentProcess = null;
          const error = `エージェントの実行がタイムアウトしました (${this.timeout}ms)`;
          this.emit('error', { agentName, error });
          resolve({
            success: false,
            output: stdout,
            error,
          });
        }
      }, this.timeout);

      // プロセス終了時にタイムアウトをクリア
      this.currentProcess.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  /**
   * 現在実行中のエージェントを停止
   */
  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
      this.emit('cancelled');
    }
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }
}
