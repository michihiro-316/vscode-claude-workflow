/**
 * ワークフローパネル
 *
 * VSCodeのサイドバーに表示される日本語UIを提供します。
 */

import * as vscode from 'vscode';
import { WorkflowManager } from '../cli/WorkflowManager';
import {
  WorkflowStatus,
  UserTask,
  PMOutput,
  AgentEvent,
} from '../types/agent';

/**
 * ワークフローパネルクラス
 */
export class WorkflowPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudeWorkflowView';

  private _view?: vscode.WebviewView;
  private _workflowManager?: WorkflowManager;
  private _logHistory: AgentEvent[] = [];
  private _currentStatus: WorkflowStatus = 'idle';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  /**
   * Webview ビューの解決
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Webview が visible になったときに状態を復元
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        // ログ履歴を全て再送信
        this._postMessage({
          type: 'restoreState',
          logs: this._logHistory,
          status: this._currentStatus,
        });

        // ワークフローマネージャーがある場合は計画も送信
        if (this._workflowManager) {
          const currentResult = this._workflowManager.getResult();
          if (currentResult.pmOutput) {
            this._postMessage({
              type: 'pmPlan',
              plan: currentResult.pmOutput,
            });
          }
        }
      }
    });

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Webviewからのメッセージを処理
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'startWorkflow':
          await this._handleStartWorkflow(data.task);
          break;
        case 'approvePlan':
          await this._handleApprovePlan(data.approved);
          break;
        case 'stopWorkflow':
          this.stopWorkflow();
          break;
        case 'editAgent':
          await vscode.commands.executeCommand('claudeWorkflow.editAgent');
          break;
        case 'resetAgent':
          await vscode.commands.executeCommand('claudeWorkflow.resetAgent');
          break;
      }
    });
  }

  /**
   * ワークフローを開始
   */
  private async _handleStartWorkflow(taskData: any): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage(
        'ワークスペースフォルダが開かれていません'
      );
      return;
    }

    // 前回のログをクリア
    this._logHistory = [];
    this._currentStatus = 'idle';

    // WorkflowManagerの初期化
    this._workflowManager = new WorkflowManager({
      projectRoot: workspaceFolder.uri.fsPath,
    });

    // イベントリスナーの設定
    this._workflowManager.on('statusChange', (status: WorkflowStatus) => {
      this._currentStatus = status;
      this._postMessage({
        type: 'statusChange',
        status,
      });
    });

    this._workflowManager.on('agentEvent', (event: AgentEvent) => {
      this._logHistory.push(event);
      this._postMessage({
        type: 'agentEvent',
        event,
      });
    });

    // タスクの作成（詳細情報を含む）
    const task: UserTask = typeof taskData === 'string'
      ? { description: taskData }
      : {
          description: taskData.description,
          purpose: taskData.purpose,
          frontendFramework: taskData.frontendFramework,
          frontendLanguage: taskData.frontendLanguage,
          backendFramework: taskData.backendFramework,
          backendLanguage: taskData.backendLanguage,
          database: taskData.database,
          cloudProvider: taskData.cloudProvider,
          infrastructure: taskData.infrastructure,
          authentication: taskData.authentication,
          security: taskData.security,
          constraints: taskData.constraints,
          other: taskData.other,
        };

    // ワークフローの実行（非同期）
    this._workflowManager
      .executeWorkflow(task, async (pmOutput: PMOutput) => {
        // PMの計画をWebviewに送信
        console.log('[WorkflowPanel] Sending pmPlan to UI:', JSON.stringify(pmOutput, null, 2));
        this._postMessage({
          type: 'pmPlan',
          plan: pmOutput,
        });

        // ユーザーの承認を待つ
        return new Promise<boolean>((resolve) => {
          // 承認/拒否のコールバックを保存
          this._approvalResolver = resolve;
        });
      })
      .then((result) => {
        // ワークフロー完了
        this._postMessage({
          type: 'workflowComplete',
          result,
        });

        if (result.status === 'completed') {
          vscode.window.showInformationMessage(
            '✅ ワークフローが完了しました！'
          );
        } else if (result.status === 'failed') {
          vscode.window.showErrorMessage(
            `❌ ワークフローが失敗しました: ${result.error}`
          );
        }
      })
      .catch((error) => {
        vscode.window.showErrorMessage(
          `エラーが発生しました: ${error.message}`
        );
      });
  }

  private _approvalResolver?: (approved: boolean) => void;

  /**
   * PMの計画の承認/拒否を処理
   */
  private async _handleApprovePlan(approved: boolean): Promise<void> {
    if (this._approvalResolver) {
      this._approvalResolver(approved);
      this._approvalResolver = undefined;
    }
  }

  /**
   * ワークフローを停止
   */
  public stopWorkflow(): void {
    if (this._workflowManager) {
      this._workflowManager.stop();
      this._workflowManager.dispose();
      this._workflowManager = undefined;
    }
  }

  /**
   * Webviewにメッセージを送信
   */
  private _postMessage(message: unknown): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * WebviewのHTMLを取得
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // セキュリティのためのnonce生成
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Claude Workflow</title>
    <style>
        body {
            padding: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }

        h2 {
            font-size: 18px;
            margin-bottom: 15px;
            color: var(--vscode-foreground);
        }

        .input-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }

        textarea {
            width: 100%;
            min-height: 100px;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: inherit;
            resize: vertical;
        }

        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 8px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .status {
            margin: 15px 0;
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            font-size: 13px;
        }

        .status-running {
            border-left: 3px solid var(--vscode-charts-blue);
        }

        .status-success {
            border-left: 3px solid var(--vscode-charts-green);
        }

        .status-error {
            border-left: 3px solid var(--vscode-charts-red);
        }

        .plan-view {
            margin: 15px 0;
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            max-height: 400px;
            overflow-y: auto;
        }

        .plan-section {
            margin-bottom: 10px;
        }

        .plan-section h3 {
            font-size: 14px;
            margin-bottom: 5px;
            color: var(--vscode-charts-blue);
        }

        .plan-section ul {
            margin: 5px 0;
            padding-left: 20px;
        }

        .log {
            margin-top: 15px;
            padding: 10px;
            background-color: var(--vscode-terminal-background);
            color: var(--vscode-terminal-foreground);
            border-radius: 4px;
            max-height: 300px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }

        .log-entry {
            margin-bottom: 5px;
            word-wrap: break-word;
        }

        .hidden {
            display: none;
        }

        .input-grid {
            display: grid;
            gap: 10px;
        }

        input[type="text"] {
            width: 100%;
            padding: 6px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: inherit;
        }

        details {
            margin-bottom: 10px;
        }

        summary {
            cursor: pointer;
            font-weight: 500;
            padding: 5px 0;
            user-select: none;
        }

        summary:hover {
            color: var(--vscode-charts-blue);
        }
    </style>
</head>
<body>
    <h2>🤖 Claude Workflow</h2>

    <div id="input-section">
        <div class="input-group">
            <label for="task-input">📝 実現したいこと（必須）：</label>
            <textarea id="task-input" placeholder="例：ユーザー認証機能を追加してください"></textarea>
        </div>

        <details>
            <summary>🔧 詳細設定（任意）- 開発現場で使える実践的な設定</summary>
            <div class="input-grid" style="margin-top: 10px;">
                <div class="input-group">
                    <label for="purpose-input">🎯 目的・背景：</label>
                    <textarea id="purpose-input" style="min-height: 60px;" placeholder="なぜこの機能が必要か、どのような課題を解決するか、ビジネス価値は何か"></textarea>
                </div>

                <h4 style="margin: 15px 0 5px 0; color: var(--vscode-charts-blue);">📱 フロントエンド</h4>
                <div class="input-group">
                    <label for="frontend-framework-input">フレームワーク：</label>
                    <input type="text" id="frontend-framework-input" placeholder="例：React, Vue.js, Next.js, Angular, Svelte">
                </div>

                <div class="input-group">
                    <label for="frontend-language-input">言語：</label>
                    <input type="text" id="frontend-language-input" placeholder="例：TypeScript, JavaScript (ES6+)">
                </div>

                <h4 style="margin: 15px 0 5px 0; color: var(--vscode-charts-green);">🗄️ バックエンド</h4>
                <div class="input-group">
                    <label for="backend-framework-input">フレームワーク：</label>
                    <input type="text" id="backend-framework-input" placeholder="例：Express, FastAPI, Django, Spring Boot, NestJS, Flask">
                </div>

                <div class="input-group">
                    <label for="backend-language-input">言語：</label>
                    <input type="text" id="backend-language-input" placeholder="例：Node.js, Python, Java, Go, Ruby">
                </div>

                <div class="input-group">
                    <label for="database-input">データベース：</label>
                    <input type="text" id="database-input" placeholder="例：PostgreSQL, MySQL, MongoDB, Redis, Firestore">
                </div>

                <h4 style="margin: 15px 0 5px 0; color: var(--vscode-charts-purple);">☁️ インフラ・クラウド</h4>
                <div class="input-group">
                    <label for="cloud-provider-input">クラウドプロバイダー：</label>
                    <input type="text" id="cloud-provider-input" placeholder="例：AWS, GCP, Azure, Vercel, Netlify, Railway">
                </div>

                <div class="input-group">
                    <label for="infrastructure-input">インフラツール：</label>
                    <input type="text" id="infrastructure-input" placeholder="例：Docker, Kubernetes, Serverless, Terraform, Cloud Run">
                </div>

                <h4 style="margin: 15px 0 5px 0; color: var(--vscode-charts-orange);">🔐 認証・セキュリティ</h4>
                <div class="input-group">
                    <label for="authentication-input">認証方法：</label>
                    <input type="text" id="authentication-input" placeholder="例：JWT, OAuth2, Firebase Auth, Auth0, Supabase Auth, Cognito">
                </div>

                <div class="input-group">
                    <label for="security-input">セキュリティ要件：</label>
                    <input type="text" id="security-input" placeholder="例：HTTPS必須, CORS設定, CSP, XSS対策, SQL Injection対策">
                </div>

                <h4 style="margin: 15px 0 5px 0; color: var(--vscode-charts-red);">⚠️ その他</h4>
                <div class="input-group">
                    <label for="constraints-input">制約・注意事項：</label>
                    <textarea id="constraints-input" style="min-height: 60px;" placeholder="例：既存APIとの互換性、レスポンスタイム200ms以下、IE11サポート不要"></textarea>
                </div>

                <div class="input-group">
                    <label for="other-input">その他の要望：</label>
                    <textarea id="other-input" style="min-height: 60px;" placeholder="テストカバレッジ、CI/CD、コーディング規約、ドキュメント要件など"></textarea>
                </div>
            </div>
        </details>

        <button id="start-btn">ワークフロー開始</button>
        <button id="stop-btn" disabled>停止</button>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--vscode-widget-border);">

        <h3 style="font-size: 14px; margin-bottom: 10px;">⚙️ エージェント設定</h3>
        <button id="edit-agent-btn" style="background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">エージェント定義を編集</button>
        <button id="reset-agent-btn" style="background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">エージェント定義をリセット</button>
    </div>

    <div id="status-section" class="hidden">
        <div id="status" class="status"></div>
    </div>

    <div id="plan-section" class="hidden">
        <h3>📋 PMの実装計画</h3>
        <div id="plan-view" class="plan-view"></div>
        <button id="approve-btn">承認して続行</button>
        <button id="reject-btn">修正を依頼</button>
    </div>

    <div id="log-section" class="hidden">
        <h3>📝 実行ログ</h3>
        <div id="log" class="log"></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        const taskInput = document.getElementById('task-input');
        const purposeInput = document.getElementById('purpose-input');
        const frontendFrameworkInput = document.getElementById('frontend-framework-input');
        const frontendLanguageInput = document.getElementById('frontend-language-input');
        const backendFrameworkInput = document.getElementById('backend-framework-input');
        const backendLanguageInput = document.getElementById('backend-language-input');
        const databaseInput = document.getElementById('database-input');
        const cloudProviderInput = document.getElementById('cloud-provider-input');
        const infrastructureInput = document.getElementById('infrastructure-input');
        const authenticationInput = document.getElementById('authentication-input');
        const securityInput = document.getElementById('security-input');
        const constraintsInput = document.getElementById('constraints-input');
        const otherInput = document.getElementById('other-input');
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        const statusSection = document.getElementById('status-section');
        const status = document.getElementById('status');
        const planSection = document.getElementById('plan-section');
        const planView = document.getElementById('plan-view');
        const approveBtn = document.getElementById('approve-btn');
        const rejectBtn = document.getElementById('reject-btn');
        const logSection = document.getElementById('log-section');
        const log = document.getElementById('log');

        // 状態を復元
        const previousState = vscode.getState();
        if (previousState) {
            taskInput.value = previousState.taskInput || '';
            purposeInput.value = previousState.purposeInput || '';
            frontendFrameworkInput.value = previousState.frontendFrameworkInput || '';
            frontendLanguageInput.value = previousState.frontendLanguageInput || '';
            backendFrameworkInput.value = previousState.backendFrameworkInput || '';
            backendLanguageInput.value = previousState.backendLanguageInput || '';
            databaseInput.value = previousState.databaseInput || '';
            cloudProviderInput.value = previousState.cloudProviderInput || '';
            infrastructureInput.value = previousState.infrastructureInput || '';
            authenticationInput.value = previousState.authenticationInput || '';
            securityInput.value = previousState.securityInput || '';
            constraintsInput.value = previousState.constraintsInput || '';
            otherInput.value = previousState.otherInput || '';

            if (previousState.isRunning) {
                startBtn.disabled = true;
                stopBtn.disabled = false;
            }
        }

        // 入力値が変更されたら状態を保存
        function saveInputState() {
            const state = vscode.getState() || {};
            vscode.setState({
                ...state,
                taskInput: taskInput.value,
                purposeInput: purposeInput.value,
                frontendFrameworkInput: frontendFrameworkInput.value,
                frontendLanguageInput: frontendLanguageInput.value,
                backendFrameworkInput: backendFrameworkInput.value,
                backendLanguageInput: backendLanguageInput.value,
                databaseInput: databaseInput.value,
                cloudProviderInput: cloudProviderInput.value,
                infrastructureInput: infrastructureInput.value,
                authenticationInput: authenticationInput.value,
                securityInput: securityInput.value,
                constraintsInput: constraintsInput.value,
                otherInput: otherInput.value,
            });
        }

        taskInput.addEventListener('input', saveInputState);
        purposeInput.addEventListener('input', saveInputState);
        frontendFrameworkInput.addEventListener('input', saveInputState);
        frontendLanguageInput.addEventListener('input', saveInputState);
        backendFrameworkInput.addEventListener('input', saveInputState);
        backendLanguageInput.addEventListener('input', saveInputState);
        databaseInput.addEventListener('input', saveInputState);
        cloudProviderInput.addEventListener('input', saveInputState);
        infrastructureInput.addEventListener('input', saveInputState);
        authenticationInput.addEventListener('input', saveInputState);
        securityInput.addEventListener('input', saveInputState);
        constraintsInput.addEventListener('input', saveInputState);
        otherInput.addEventListener('input', saveInputState);

        // ワークフロー開始
        startBtn.addEventListener('click', () => {
            const task = taskInput.value.trim();
            if (!task) {
                alert('タスクを入力してください');
                return;
            }

            // 詳細情報を収集
            const taskDetails = {
                description: task,
                purpose: purposeInput.value.trim(),
                frontendFramework: frontendFrameworkInput.value.trim(),
                frontendLanguage: frontendLanguageInput.value.trim(),
                backendFramework: backendFrameworkInput.value.trim(),
                backendLanguage: backendLanguageInput.value.trim(),
                database: databaseInput.value.trim(),
                cloudProvider: cloudProviderInput.value.trim(),
                infrastructure: infrastructureInput.value.trim(),
                authentication: authenticationInput.value.trim(),
                security: securityInput.value.trim(),
                constraints: constraintsInput.value.trim(),
                other: otherInput.value.trim(),
            };

            vscode.postMessage({
                type: 'startWorkflow',
                task: taskDetails
            });

            startBtn.disabled = true;
            stopBtn.disabled = false;
            statusSection.classList.remove('hidden');
            logSection.classList.remove('hidden');
            log.innerHTML = '';

            // 実行中状態を保存
            const state = vscode.getState() || {};
            vscode.setState({ ...state, isRunning: true });
        });

        // ワークフロー停止
        stopBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'stopWorkflow' });
            startBtn.disabled = false;
            stopBtn.disabled = true;

            // 停止状態を保存
            const state = vscode.getState() || {};
            vscode.setState({ ...state, isRunning: false });
        });

        // 計画承認
        approveBtn.addEventListener('click', () => {
            vscode.postMessage({
                type: 'approvePlan',
                approved: true
            });
            planSection.classList.add('hidden');
        });

        // 計画拒否
        rejectBtn.addEventListener('click', () => {
            vscode.postMessage({
                type: 'approvePlan',
                approved: false
            });
            planSection.classList.add('hidden');
            startBtn.disabled = false;
            stopBtn.disabled = true;
        });

        // エージェント定義編集
        const editAgentBtn = document.getElementById('edit-agent-btn');
        editAgentBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'editAgent' });
        });

        // エージェント定義リセット
        const resetAgentBtn = document.getElementById('reset-agent-btn');
        resetAgentBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'resetAgent' });
        });

        // メッセージ受信
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'restoreState':
                    // 状態を復元
                    updateStatus(message.status);
                    log.innerHTML = '';
                    message.logs.forEach(logEvent => addLog(logEvent));
                    if (message.logs.length > 0) {
                        logSection.classList.remove('hidden');
                        statusSection.classList.remove('hidden');
                    }
                    break;
                case 'statusChange':
                    updateStatus(message.status);
                    break;
                case 'agentEvent':
                    addLog(message.event);
                    break;
                case 'pmPlan':
                    showPlan(message.plan);
                    break;
                case 'workflowComplete':
                    handleComplete(message.result);
                    break;
            }
        });

        function updateStatus(statusText) {
            const statusMap = {
                'idle': '待機中',
                'planning': '📋 PMが計画を立案中...',
                'awaiting_approval': '⏳ ユーザーの承認待ち',
                'implementing': '💻 エンジニアがコード生成中...',
                'reviewing': '🔍 レビュアーが品質チェック中...',
                'completed': '✅ 完了',
                'failed': '❌ 失敗',
                'cancelled': '⏹️ キャンセル'
            };

            status.textContent = statusMap[statusText] || statusText;
            status.className = 'status status-running';
        }

        function addLog(event) {
            const entry = document.createElement('div');
            entry.className = 'log-entry';

            // progress イベントの場合は最後のエントリを更新
            if (event.type === 'progress') {
                const lastEntry = log.querySelector('.log-entry:last-child');
                if (lastEntry && lastEntry.textContent.startsWith(\`[\${event.agentType}]\`)) {
                    // 既存のエントリに追記
                    lastEntry.textContent += event.message;
                    log.scrollTop = log.scrollHeight;
                    return;
                } else {
                    entry.textContent = \`[\${event.agentType}] \${event.message}\`;
                }
            } else {
                entry.textContent = \`[\${event.agentType}] \${event.message}\`;
            }

            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }

        function showPlan(plan) {
            let html = '<div class="plan-section"><h3>要件</h3><ul>';
            plan.requirements.forEach(req => {
                html += \`<li>\${req}</li>\`;
            });
            html += '</ul></div>';

            html += '<div class="plan-section"><h3>実装タスク</h3><ul>';
            plan.implementationPlan.tasks.forEach(task => {
                html += \`<li>[\${task.priority}] \${task.description}</li>\`;
            });
            html += '</ul></div>';

            html += \`<div class="plan-section"><h3>複雑度</h3><p>\${plan.implementationPlan.estimatedComplexity}/10</p></div>\`;

            planView.innerHTML = html;
            planSection.classList.remove('hidden');
        }

        function handleComplete(result) {
            startBtn.disabled = false;
            stopBtn.disabled = true;

            if (result.status === 'completed') {
                status.textContent = '✅ ワークフロー完了！';
                status.className = 'status status-success';
            } else {
                status.textContent = \`❌ \${result.error || '失敗しました'}\`;
                status.className = 'status status-error';
            }

            // 完了状態を保存
            const state = vscode.getState() || {};
            vscode.setState({ ...state, isRunning: false });
        }
    </script>
</body>
</html>`;
  }
}

/**
 * ランダムなnonceを生成
 */
function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
