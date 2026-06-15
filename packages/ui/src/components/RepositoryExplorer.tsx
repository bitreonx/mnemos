import { useState, useEffect } from 'react';
import type { MemoryModel } from '../types';

interface RepositoryExplorerProps {
  memory: MemoryModel;
  onSelectRepo: (repo: string) => void;
  onQuickInsight: (target: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  language?: string;
  size?: number;
}

export function RepositoryExplorer({ memory, onSelectRepo, onQuickInsight }: RepositoryExplorerProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Build file tree from memory model
    buildFileTree();
  }, [memory]);

  const buildFileTree = () => {
    // Extract file paths from domains, flows, and services
    const allPaths = new Set<string>();
    
    memory.domains.forEach(d => d.nodes.forEach(n => {
      if (n.includes(':')) {
        const path = n.split(':')[1];
        if (path) allPaths.add(path);
      }
    }));

    memory.flows.forEach(f => f.steps.forEach(s => {
      if (s.path) allPaths.add(s.path);
    }));

    const tree: FileNode[] = [];
    const pathMap = new Map<string, FileNode>();

    Array.from(allPaths).sort().forEach(fullPath => {
      const parts = fullPath.split(/[\\/]/);
      let currentPath = '';
      
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!pathMap.has(currentPath)) {
          const node: FileNode = {
            name: part,
            path: currentPath,
            type: isLast ? 'file' : 'directory',
            children: isLast ? undefined : [],
          };
          
          pathMap.set(currentPath, node);
          
          if (index === 0) {
            tree.push(node);
          } else {
            const parentPath = parts.slice(0, index).join('/');
            const parent = pathMap.get(parentPath);
            if (parent && parent.children) {
              parent.children.push(node);
            }
          }
        }
      });
    });

    setFileTree(tree);
  };

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedPaths.has(node.path);
      const isSelected = selectedFile === node.path;
      const hasChildren = node.children && node.children.length > 0;

      if (searchQuery && !node.path.toLowerCase().includes(searchQuery.toLowerCase())) {
        return null;
      }

      return (
        <div key={node.path} className="file-node">
          <div
            className={`file-item ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
            onClick={() => {
              if (node.type === 'directory') {
                toggleExpand(node.path);
              } else {
                setSelectedFile(node.path);
                onQuickInsight(node.path);
              }
            }}
          >
            {hasChildren && (
              <span className="expand-icon">
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            
            <span className="file-icon">
              {node.type === 'directory' ? '📁' : getFileIcon(node.name)}
            </span>
            
            <span className="file-name">{node.name}</span>
            
            {node.type === 'file' && (
              <button
                className="quick-insight-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickInsight(node.path);
                }}
                title="Quick Insights"
              >
                ✨
              </button>
            )}
          </div>
          
          {hasChildren && isExpanded && (
            <div className="file-children">
              {renderFileTree(node.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const getFileIcon = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'ts': '📘', 'tsx': '⚛️', 'js': '📜', 'jsx': '⚛️',
      'py': '🐍', 'java': '☕', 'go': '🔷', 'rs': '🦀',
      'html': '🌐', 'css': '🎨', 'json': '📋', 'md': '📝',
      'yaml': '⚙️', 'yml': '⚙️', 'xml': '📄', 'sql': '🗃️',
    };
    return iconMap[ext || ''] || '📄';
  };

  const stats = {
    totalFiles: fileTree.length,
    totalDomains: memory.domains.length,
    totalFlows: memory.flows.length,
    totalServices: memory.services.length,
  };

  return (
    <div className="repository-explorer">
      <div className="explorer-header">
        <h2 className="explorer-title">
          <span className="icon">🗂️</span>
          Repository Explorer
        </h2>
        
        <div className="explorer-stats">
          <div className="stat-item">
            <span className="stat-value">{stats.totalFiles}</span>
            <span className="stat-label">Files</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalDomains}</span>
            <span className="stat-label">Domains</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalFlows}</span>
            <span className="stat-label">Flows</span>
          </div>
        </div>
      </div>

      <div className="explorer-search">
        <input
          type="text"
          placeholder="Search files and folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="explorer-actions">
        <button className="action-btn" onClick={() => setExpandedPaths(new Set())}>
          Collapse All
        </button>
        <button className="action-btn" onClick={() => {
          const allPaths = new Set<string>();
          const collectPaths = (nodes: FileNode[]) => {
            nodes.forEach(n => {
              if (n.type === 'directory') {
                allPaths.add(n.path);
                if (n.children) collectPaths(n.children);
              }
            });
          };
          collectPaths(fileTree);
          setExpandedPaths(allPaths);
        }}>
          Expand All
        </button>
      </div>

      <div className="file-tree-container">
        {fileTree.length > 0 ? (
          renderFileTree(fileTree)
        ) : (
          <div className="empty-state">
            <p>No files found in repository</p>
            <p className="text-sm text-gray-400">Run analysis to populate file tree</p>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="file-details">
          <h3>Selected File</h3>
          <p className="file-path">{selectedFile}</p>
          <button
            className="analyze-btn"
            onClick={() => onQuickInsight(selectedFile)}
          >
            Analyze with AI
          </button>
        </div>
      )}
    </div>
  );
}
