/**
 * コード構造解析ユーティリティ
 *
 * ファイル間の依存関係や全体構造を可視化するための機能を提供
 */

import { GeneratedFile } from '../types/agent';

/**
 * ファイル依存関係のグラフ
 */
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

/**
 * 依存関係のノード（ファイル）
 */
export interface DependencyNode {
  id: string;
  label: string;
  path: string;
  action: 'create' | 'modify' | 'delete';
}

/**
 * 依存関係のエッジ（依存）
 */
export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'reference';
}

/**
 * コード構造のサマリー
 */
export interface CodeStructureSummary {
  totalFiles: number;
  newFiles: number;
  modifiedFiles: number;
  deletedFiles: number;
  filesByCategory: Record<string, string[]>;
  dependencyGraph: DependencyGraph;
}

/**
 * 生成されたファイルから構造サマリーを作成
 *
 * @param files 生成されたファイルのリスト
 * @returns 構造サマリー
 */
export function analyzeCodeStructure(files: GeneratedFile[]): CodeStructureSummary {
  const filesByCategory: Record<string, string[]> = {};
  const nodes: DependencyNode[] = [];

  let newFiles = 0;
  let modifiedFiles = 0;
  let deletedFiles = 0;

  // ファイルをカテゴリ別に分類
  files.forEach((file, index) => {
    // カウント
    if (file.action === 'create') newFiles++;
    else if (file.action === 'modify') modifiedFiles++;
    else if (file.action === 'delete') deletedFiles++;

    // カテゴリ分類（ディレクトリベース）
    const category = getCategoryFromPath(file.path);
    if (!filesByCategory[category]) {
      filesByCategory[category] = [];
    }
    filesByCategory[category].push(file.path);

    // ノード追加
    nodes.push({
      id: `node-${index}`,
      label: file.path.split('/').pop() || file.path,
      path: file.path,
      action: file.action,
    });
  });

  // 簡易的な依存関係推測（将来的にはファイル内容を解析）
  const edges: DependencyEdge[] = [];
  // TODO: ファイル内容から import/require を解析して依存関係を抽出

  return {
    totalFiles: files.length,
    newFiles,
    modifiedFiles,
    deletedFiles,
    filesByCategory,
    dependencyGraph: {
      nodes,
      edges,
    },
  };
}

/**
 * ファイルパスからカテゴリを取得
 *
 * @param path ファイルパス
 * @returns カテゴリ名
 */
function getCategoryFromPath(path: string): string {
  const parts = path.split('/');

  // src/ または類似のディレクトリ構造を解析
  if (parts.includes('src')) {
    const srcIndex = parts.indexOf('src');
    if (srcIndex + 1 < parts.length) {
      return parts[srcIndex + 1]; // src の次のディレクトリ
    }
  }

  // デフォルトは最上位ディレクトリ
  return parts.length > 1 ? parts[0] : 'root';
}

/**
 * 構造サマリーをマークダウン形式で出力
 *
 * @param summary 構造サマリー
 * @returns マークダウン文字列
 */
export function formatStructureSummary(summary: CodeStructureSummary): string {
  let markdown = `# コード構造サマリー\n\n`;

  markdown += `## 📊 統計\n`;
  markdown += `- 合計ファイル数: ${summary.totalFiles}\n`;
  markdown += `- 新規作成: ${summary.newFiles}\n`;
  markdown += `- 変更: ${summary.modifiedFiles}\n`;
  markdown += `- 削除: ${summary.deletedFiles}\n\n`;

  markdown += `## 📁 カテゴリ別ファイル\n`;
  Object.entries(summary.filesByCategory).forEach(([category, files]) => {
    markdown += `### ${category} (${files.length})\n`;
    files.forEach(file => {
      markdown += `- \`${file}\`\n`;
    });
    markdown += `\n`;
  });

  markdown += `## 🔗 依存関係\n`;
  if (summary.dependencyGraph.edges.length === 0) {
    markdown += `依存関係の自動解析は今後実装予定です。\n`;
  } else {
    summary.dependencyGraph.edges.forEach(edge => {
      const fromNode = summary.dependencyGraph.nodes.find(n => n.id === edge.from);
      const toNode = summary.dependencyGraph.nodes.find(n => n.id === edge.to);
      if (fromNode && toNode) {
        markdown += `- \`${fromNode.path}\` → \`${toNode.path}\` (${edge.type})\n`;
      }
    });
  }

  return markdown;
}
