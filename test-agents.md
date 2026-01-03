# エージェント動作テスト

このファイルは、作成した4つのエージェント（orchestrator, pm-agent, engineer-agent, reviewer-agent）の動作を確認するためのテストガイドです。

## テスト1: PMエージェント単体テスト

PMエージェントだけを動かして、計画立案機能を確認します。

**タスク**: 「簡単な足し算をする関数を作成してください」

**期待される出力**:
- 要件の明確化
- 実装計画（JSON形式）
- リスクと成功基準

## テスト2: エンジニアエージェント単体テスト

エンジニアエージェントに、PMの計画を渡してコード生成を確認します。

**入力**: PMエージェントの出力（計画）

**期待される出力**:
- 生成されたコードファイル
- 依存関係リスト（あれば）
- 実装ノート

## テスト3: レビュアーエージェント単体テスト

レビュアーエージェントに、エンジニアのコードを渡してレビュー機能を確認します。

**入力**: エンジニアエージェントが生成したコード

**期待される出力**:
- セキュリティ問題のリスト
- 品質問題のリスト
- 総合スコア
- 承認/不承認の判定

## テスト4: オーケストレーター統合テスト

オーケストレーターエージェントを動かして、全エージェントの連携を確認します。

**タスク**: 「簡単な足し算をする関数を作成してください」

**期待される動作**:
1. オーケストレーターが起動
2. PMエージェントに計画を依頼
3. PMの計画を表示（ユーザー承認待ち）
4. エンジニアエージェントにコード生成を依頼
5. レビュアーエージェントにレビューを依頼
6. 統合レポートを表示

## 実行方法

### 方法1: Claude Code CLIから直接実行（推奨）

```bash
# 現在のディレクトリで Claude Code を起動
claude

# プロンプトで以下を入力:
# 「簡単な足し算をする関数を作成してください」
```

### 方法2: コマンドラインから直接実行

```bash
# オーケストレーターを直接呼び出し
claude --agent orchestrator "簡単な足し算をする関数を作成してください"
```

## トラブルシューティング

### エラー: "Agent not found"
- `.claude/agents/` ディレクトリが存在するか確認
- エージェント定義ファイル（*.md）が存在するか確認

### エラー: "Task tool not available"
- Claude Code CLIのバージョンを確認
- 最新バージョンにアップデート

### エージェントが応答しない
- エージェント定義ファイルの構文を確認
- frontmatter（---で囲まれた部分）が正しいか確認

## 期待される結果の例

### PMエージェントの出力例

```json
{
  "requirements": [
    "2つの数値を引数として受け取る",
    "足し算の結果を返す",
    "型安全性を確保する（TypeScript）"
  ],
  "implementationPlan": {
    "tasks": [
      {
        "id": "task-1",
        "description": "add関数の実装",
        "priority": "high",
        "estimatedEffort": "小",
        "files": ["src/utils/math.ts"]
      }
    ],
    "estimatedComplexity": 1,
    "risks": []
  },
  "successCriteria": [
    "正しい数値が返される",
    "型エラーがない"
  ]
}
```

### エンジニアエージェントの出力例

```typescript
// src/utils/math.ts
export function add(a: number, b: number): number {
  return a + b;
}
```

### レビュアーエージェントの出力例

```json
{
  "securityIssues": [],
  "qualityIssues": [],
  "bestPractices": [
    {
      "status": "passed",
      "category": "型安全性",
      "description": "TypeScriptの型定義が適切です"
    }
  ],
  "overallScore": 100,
  "approved": true,
  "summary": "シンプルで安全な実装です。問題ありません。"
}
```

## 次のステップ

動作確認が完了したら:
1. VSCode拡張の実装に進む
2. ClaudeCodeRunner を実装してエージェントを呼び出す
3. WorkflowManager でワークフロー管理を実装
