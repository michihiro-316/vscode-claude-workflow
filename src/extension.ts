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
 * 存在しない場合は、エージェント定義ファイルをコピー
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
    // ディレクトリが存在しない場合は通知のみ
    // （エージェント定義ファイルは既にリポジトリに含まれている前提）
    vscode.window.showInformationMessage(
      'Claude Workflow: .claude/agents/ ディレクトリを確認してください'
    );
  }
}
