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

  context.subscriptions.push(startCommand, stopCommand);

  // .claude/agents/ ディレクトリの存在確認と作成
  ensureAgentsDirectory();
}

/**
 * 拡張が無効化されたときに呼ばれる
 */
export function deactivate(): void {
  console.log('Claude Workflow extension is now deactivated');
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
