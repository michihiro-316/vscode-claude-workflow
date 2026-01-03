/**
 * エージェント共通の型定義
 */

/**
 * エージェントの種類
 */
export type AgentType = 'orchestrator' | 'pm' | 'engineer' | 'reviewer';

/**
 * タスクの優先度
 */
export type Priority = 'high' | 'medium' | 'low';

/**
 * 作業量の見積もり
 */
export type Effort = '小' | '中' | '大';

/**
 * セキュリティ問題の深刻度
 */
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * 品質問題の深刻度
 */
export type QualitySeverity = 'high' | 'medium' | 'low';

/**
 * ファイル操作の種類
 */
export type FileAction = 'create' | 'modify' | 'delete';

/**
 * ベストプラクティスのステータス
 */
export type BestPracticeStatus = 'passed' | 'failed';

// ============================================
// PMエージェントの型定義
// ============================================

/**
 * PMエージェントのタスク定義
 */
export interface PMTask {
  id: string;
  description: string;
  priority: Priority;
  estimatedEffort: Effort;
  dependencies: string[];
  files: string[];
}

/**
 * PMエージェントの実装計画
 */
export interface ImplementationPlan {
  tasks: PMTask[];
  estimatedComplexity: number; // 1-10
  risks: string[];
}

/**
 * PMエージェントの出力
 */
export interface PMOutput {
  requirements: string[];
  implementationPlan: ImplementationPlan;
  successCriteria: string[];
  notes: string[];
}

// ============================================
// エンジニアエージェントの型定義
// ============================================

/**
 * 生成されたファイルの情報
 */
export interface GeneratedFile {
  path: string;
  action: FileAction;
  summary: string;
}

/**
 * エンジニアエージェントの出力
 */
export interface EngineerOutput {
  generatedFiles: GeneratedFile[];
  dependencies: string[];
  notes: string[];
}

// ============================================
// レビュアーエージェントの型定義
// ============================================

/**
 * セキュリティ問題
 */
export interface SecurityIssue {
  severity: SecuritySeverity;
  type: string;
  location: string;
  description: string;
  suggestion: string;
  owaspCategory?: string;
}

/**
 * 品質問題
 */
export interface QualityIssue {
  severity: QualitySeverity;
  category: string;
  location: string;
  description: string;
  suggestion: string;
}

/**
 * ベストプラクティスのチェック結果
 */
export interface BestPracticeCheck {
  status: BestPracticeStatus;
  category: string;
  description: string;
}

/**
 * レビュアーエージェントの出力
 */
export interface ReviewerOutput {
  securityIssues: SecurityIssue[];
  qualityIssues: QualityIssue[];
  bestPractices: BestPracticeCheck[];
  overallScore: number; // 0-100
  approved: boolean;
  summary: string;
}

// ============================================
// ワークフロー全体の型定義
// ============================================

/**
 * ワークフローの状態
 */
export type WorkflowStatus =
  | 'idle'           // 待機中
  | 'planning'       // PM実行中
  | 'awaiting_approval' // ユーザー承認待ち
  | 'implementing'   // エンジニア実行中
  | 'reviewing'      // レビュアー実行中
  | 'completed'      // 完了
  | 'failed'         // 失敗
  | 'cancelled';     // キャンセル

/**
 * ワークフローの実行結果
 */
export interface WorkflowResult {
  status: WorkflowStatus;
  pmOutput?: PMOutput;
  engineerOutput?: EngineerOutput;
  reviewerOutput?: ReviewerOutput;
  error?: string;
}

/**
 * ユーザーからのタスク入力
 */
export interface UserTask {
  description: string;
  context?: string; // 選択されたコードやファイル情報
  presetType?: 'feature' | 'bugfix' | 'security' | 'refactor'; // プリセットタスクの種類
  // 詳細設定（任意）
  purpose?: string; // 目的・背景
  techStack?: string; // 技術スタック
  backend?: string; // バックエンド・インフラ
  constraints?: string; // 制約・注意事項
  other?: string; // その他の要望
}

/**
 * エージェント実行のイベント
 */
export interface AgentEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  agentType: AgentType;
  message: string;
  data?: unknown;
  timestamp: Date;
}
