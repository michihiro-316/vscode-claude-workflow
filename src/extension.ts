/**
 * VSCode拡張のエントリーポイント
 *
 * この拡張は Claude Code と統合し、複数のAIエージェントによる
 * 協働開発支援システムを提供します。
 */

import * as vscode from 'vscode';
import { WorkflowPanel } from './ui/WorkflowPanel';

/**
 * 拡張が有効化されたときに呼ばれる
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Claude Workflow extension is now active!');

  // ワークフローパネルの登録
  const workflowProvider = new WorkflowPanel(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WorkflowPanel.viewType,
      workflowProvider
    )
  );

  // コマンドの登録: ワークフローを開始
  const startCommand = vscode.commands.registerCommand(
    'claudeWorkflow.start',
    async () => {
      vscode.window.showInformationMessage(
        'Claude Workflow: ワークフローを開始します'
      );

      // サイドバーのビューを表示
      await vscode.commands.executeCommand('claudeWorkflowView.focus');
    }
  );

  // コマンドの登録: ワークフローを停止
  const stopCommand = vscode.commands.registerCommand(
    'claudeWorkflow.stop',
    () => {
      workflowProvider.stopWorkflow();
      vscode.window.showInformationMessage(
        'Claude Workflow: ワークフローを停止しました'
      );
    }
  );

  // コマンドの登録: エージェント定義を編集
  const editAgentCommand = vscode.commands.registerCommand(
    'claudeWorkflow.editAgent',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('ワークスペースが開かれていません');
        return;
      }

      // エージェントを選択
      const agentNames = ['pm-agent', 'engineer-agent', 'reviewer-agent', 'orchestrator'];
      const selected = await vscode.window.showQuickPick(
        agentNames.map(name => ({
          label: name,
          description: `${name}.md を編集`,
        })),
        {
          placeHolder: '編集するエージェントを選択してください',
        }
      );

      if (!selected) {
        return;
      }

      // エージェント定義ファイルを開く
      const agentFile = vscode.Uri.joinPath(
        workspaceFolder.uri,
        '.claude',
        'agents',
        `${selected.label}.md`
      );

      try {
        const doc = await vscode.workspace.openTextDocument(agentFile);
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(
          `エージェント定義ファイルを開けませんでした: ${error}`
        );
      }
    }
  );

  // コマンドの登録: エージェント定義をリセット
  const resetAgentCommand = vscode.commands.registerCommand(
    'claudeWorkflow.resetAgent',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('ワークスペースが開かれていません');
        return;
      }

      // エージェントを選択
      const agentNames = ['pm-agent', 'engineer-agent', 'reviewer-agent', 'orchestrator', '全エージェント'];
      const selected = await vscode.window.showQuickPick(
        agentNames.map(name => ({
          label: name,
          description: name === '全エージェント' ? '全てのエージェント定義をリセット' : `${name}.md をデフォルトに戻す`,
        })),
        {
          placeHolder: 'リセットするエージェントを選択してください',
        }
      );

      if (!selected) {
        return;
      }

      // 確認ダイアログ
      const confirmed = await vscode.window.showWarningMessage(
        `${selected.label} の定義をデフォルトに戻しますか？\n現在の設定は失われます。`,
        { modal: true },
        'リセット',
        'キャンセル'
      );

      if (confirmed !== 'リセット') {
        return;
      }

      // リセット実行
      await resetAgentDefinitions(
        selected.label === '全エージェント' ? agentNames.slice(0, 4) : [selected.label]
      );
    }
  );

  context.subscriptions.push(startCommand, stopCommand, editAgentCommand, resetAgentCommand);

  // .claude/agents/ ディレクトリの存在確認と作成
  ensureAgentsDirectory();

  // Claude Code CLI のインストール状態確認
  checkClaudeCodeCli();
}

/**
 * 拡張が無効化されたときに呼ばれる
 */
export function deactivate(): void {
  console.log('Claude Workflow extension is now deactivated');
}

/**
 * Claude Code CLI がインストールされているかチェック
 */
async function checkClaudeCodeCli(): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    await execAsync('claude --version', {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:${process.env.PATH}`,
      },
    });
    console.log('Claude Code CLI is installed');
  } catch (error) {
    vscode.window
      .showWarningMessage(
        'Claude Code CLI がインストールされていません。インストールしますか？',
        'インストール',
        'キャンセル'
      )
      .then(async (selection) => {
        if (selection === 'インストール') {
          const terminal = vscode.window.createTerminal('Claude Code インストール');
          terminal.show();
          terminal.sendText('npm install -g @anthropic-ai/claude-code');
          vscode.window.showInformationMessage(
            'Claude Code CLI のインストールを開始しました。ターミナルで進行状況を確認してください。'
          );
        }
      });
  }
}

/**
 * .claude/agents/ ディレクトリが存在することを確認
 * 存在しない場合は、拡張内のテンプレートから自動的にコピー
 */
async function ensureAgentsDirectory(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const fs = vscode.workspace.fs;
  const agentsDir = vscode.Uri.joinPath(
    workspaceFolder.uri,
    '.claude',
    'agents'
  );

  try {
    await fs.stat(agentsDir);
    // ディレクトリが既に存在する
    console.log('.claude/agents/ directory already exists');
  } catch {
    // ディレクトリが存在しない場合は自動セットアップ
    try {
      // .claude/agents/ ディレクトリを作成
      await fs.createDirectory(agentsDir);

      // 拡張内のテンプレートファイルをコピー
      const extensionPath = vscode.extensions.getExtension(
        'vscode-claude-workflow.vscode-claude-workflow'
      )?.extensionUri;

      if (!extensionPath) {
        vscode.window.showErrorMessage(
          'Claude Workflow: 拡張のパスが見つかりませんでした'
        );
        return;
      }

      const templateAgents = vscode.Uri.joinPath(extensionPath, 'agents');
      const agentFiles = [
        'orchestrator.md',
        'pm-agent.md',
        'engineer-agent.md',
        'reviewer-agent.md',
      ];

      for (const fileName of agentFiles) {
        const sourceUri = vscode.Uri.joinPath(templateAgents, fileName);
        const targetUri = vscode.Uri.joinPath(agentsDir, fileName);

        try {
          const content = await fs.readFile(sourceUri);
          await fs.writeFile(targetUri, content);
        } catch (error) {
          console.error(`Failed to copy ${fileName}:`, error);
        }
      }

      vscode.window.showInformationMessage(
        '✅ Claude Workflow のセットアップが完了しました！\n' +
          '.claude/agents/ にエージェント定義ファイルを配置しました。'
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Claude Workflow のセットアップに失敗しました: ${error}`
      );
    }
  }
}

/**
 * エージェント定義をデフォルトにリセット
 *
 * @param agentNames リセットするエージェント名のリスト
 */
async function resetAgentDefinitions(agentNames: string[]): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const fs = vscode.workspace.fs;
  const extensionPath = vscode.extensions.getExtension(
    'vscode-claude-workflow.vscode-claude-workflow'
  )?.extensionUri;

  if (!extensionPath) {
    vscode.window.showErrorMessage('拡張のパスが見つかりませんでした');
    return;
  }

  const templateAgents = vscode.Uri.joinPath(extensionPath, 'agents');
  const agentsDir = vscode.Uri.joinPath(workspaceFolder.uri, '.claude', 'agents');

  let successCount = 0;
  let failCount = 0;

  for (const agentName of agentNames) {
    const fileName = `${agentName}.md`;
    const sourceUri = vscode.Uri.joinPath(templateAgents, fileName);
    const targetUri = vscode.Uri.joinPath(agentsDir, fileName);

    try {
      const content = await fs.readFile(sourceUri);
      await fs.writeFile(targetUri, content);
      successCount++;
    } catch (error) {
      console.error(`Failed to reset ${fileName}:`, error);
      failCount++;
    }
  }

  if (failCount === 0) {
    vscode.window.showInformationMessage(
      `✅ ${successCount}個のエージェント定義をリセットしました`
    );
  } else {
    vscode.window.showWarningMessage(
      `⚠️ ${successCount}個のエージェント定義をリセットしましたが、${failCount}個は失敗しました`
    );
  }
}
