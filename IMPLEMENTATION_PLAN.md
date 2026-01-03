# vscode-claude-workflow 詳細実装計画

> この実装計画はPlanエージェントによって生成されました

既存のドキュメント（REQUIREMENTS.md、PROJECT_STRUCTURE.md）およびClaude Agent SDK、VSCode Extension APIのベストプラクティスを踏まえ、Phase 1（MVP）の詳細な実装計画を策定しました。

## 1. 実装戦略の概要

### 1.1 アプローチ
**ボトムアップ × レイヤード方式**を採用します：

1. **基盤レイヤー**: 共通インフラ（型定義、ユーティリティ、Claude Client）
2. **エージェントレイヤー**: 各エージェント実装（PM → Engineer → Reviewer → Orchestrator）
3. **統合レイヤー**: VSCode拡張UI・コマンド
4. **検証レイヤー**: 統合テストと品質保証

**根拠**:
- 各エージェントを独立してテスト可能
- オーケストレーターは他のエージェントに依存するため最後に実装
- UI実装の前にエージェントロジックを確立することで、UIが実際の動作に基づいた設計になる

### 1.2 技術的決定事項

#### A. Claude Agent SDKの使用方針
- **各エージェントを独立したAgent Sessionとして実装**
- Agent SDKの `query()` を使用してエージェント通信を実現
- エージェント間通信はオーケストレーターが制御（Agent SDK のサブエージェント機能を活用）

#### B. VSCode拡張アーキテクチャ
- **Webview View API** を使用してサイドバーパネルを実装
- メッセージパッシング（postMessage）でextension ↔ webview間通信
- Secret Storageを使用してClaude APIキーを安全に保存

#### C. エージェント通信プロトコル
```typescript
interface AgentMessage {
  id: string;              // メッセージID
  agentType: 'pm' | 'engineer' | 'reviewer' | 'orchestrator';
  timestamp: Date;
  input: Record<string, any>;
  output?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}
```

## 2. 実装スケジュールと優先順位

### Week 1: 基盤構築
- [ ] プロジェクトセットアップ（1日）
- [ ] 型定義作成（0.5日）
- [ ] ClaudeClient実装（1日）
- [ ] PromptBuilder実装（1日）
- [ ] BaseAgent実装（1日）

### Week 2: エージェント実装
- [ ] PMAgent実装（1日）
- [ ] EngineerAgent実装（1日）
- [ ] ReviewerAgent実装（1日）
- [ ] OrchestratorAgent実装（2日）

### Week 3: VSCode拡張
- [ ] extension.ts実装（1日）
- [ ] WorkflowPanel実装（2日）
- [ ] Webview UI実装（2日）

### Week 4: テスト・統合
- [ ] 単体テスト作成（2日）
- [ ] 統合テスト（1日）
- [ ] E2Eテスト（1日）
- [ ] バグ修正・調整（1日）

### Week 5: ドキュメント・公開準備
- [ ] claude.md作成（1日）
- [ ] README.md作成（1日）
- [ ] ARCHITECTURE.md作成（1日）
- [ ] 動作確認・リリース準備（2日）

## 3. Critical Files for Implementation

実装時に最も重要な5つのファイル：

1. **/src/agents/orchestrator/OrchestratorAgent.ts** - ワークフロー全体を統括するコアロジック
2. **/src/claude/ClaudeClient.ts** - Claude API との通信基盤
3. **/src/extension/ui/sidebar/WorkflowPanel.ts** - ユーザーとエージェントをつなぐUIコントローラー
4. **/src/agents/base/BaseAgent.ts** - 全エージェントの基底クラス
5. **/src/types/agent.ts** - エージェント間インターフェース定義

## 4. リスクと対策

### 4.1 技術的リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Claude APIレート制限 | 高 | RateLimiterクラスで制御、キュー管理実装 |
| JSON応答パース失敗 | 中 | リトライロジック、フォールバック処理 |
| エージェント実行時間超過 | 中 | タイムアウト設定（各エージェント60秒） |

### 4.2 ユーザビリティリスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 初心者には複雑すぎる | 高 | プリセットタスク、ウィザード形式のガイド |
| 実行時間が長くてストレス | 中 | ストリーミング、進捗表示の充実 |

## 5. 次のステップ

1. **プロジェクトディレクトリ・ファイル作成**
2. **claude.md の作成** - 各エージェントの詳細なシステムプロンプト設計
3. **プロトタイプ実装** - Week 1のタスクから順次実装

詳細な実装内容は、Planエージェントの完全な出力を参照してください。

**作成日**: 2026-01-03
**Plan Agent ID**: a6491ed
