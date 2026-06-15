import { useState } from 'react';
import type { MemoryModel } from '../types';

interface SystemAnalyzerProps {
  memory: MemoryModel;
  onQuickInsight: (target: string) => void;
}

interface SystemPattern {
  id: string;
  name: string;
  category: string;
  description: string;
  files: string[];
  confidence: number;
  icon: string;
}

export function SystemAnalyzer({ memory, onQuickInsight }: SystemAnalyzerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [patterns, setPatterns] = useState<SystemPattern[]>(() => detectSystemPatterns());

  function detectSystemPatterns(): SystemPattern[] {
    const detected: SystemPattern[] = [];

    // Detect Authentication System
    const authFiles = memory.flows
      .filter(f => f.name.toLowerCase().includes('login') || f.name.toLowerCase().includes('auth'))
      .flatMap(f => f.steps.map(s => s.path).filter(Boolean) as string[]);

    if (authFiles.length > 0) {
      detected.push({
        id: 'auth',
        name: 'Authentication System',
        category: 'security',
        description: 'Handles user authentication, sessions, and access control',
        files: Array.from(new Set(authFiles)),
        confidence: 0.9,
        icon: '🔐',
      });
    }

    // Detect API Layer
    const apiFiles = memory.apis.map(api => api.file);
    if (apiFiles.length > 0) {
      detected.push({
        id: 'api',
        name: 'API Layer',
        category: 'architecture',
        description: `Exposes ${memory.apis.length} API endpoints`,
        files: Array.from(new Set(apiFiles)),
        confidence: 1.0,
        icon: '🌐',
      });
    }

    // Detect Database Layer
    const dbFiles = memory.domains.flatMap(d =>
      d.nodes.filter(n => n.includes('db') || n.includes('database') || n.includes('repository'))
    ).map(n => n.split(':')[1]).filter(Boolean) as string[];

    if (dbFiles.length > 0) {
      detected.push({
        id: 'database',
        name: 'Database Layer',
        category: 'data',
        description: 'Data persistence and repository pattern implementation',
        files: Array.from(new Set(dbFiles)),
        confidence: 0.85,
        icon: '🗄️',
      });
    }

    // Detect UI Components
    const uiFiles = memory.domains.flatMap(d =>
      d.nodes.filter(n => n.includes('component') || n.includes('ui') || n.includes('.tsx'))
    ).map(n => n.split(':')[1]).filter(Boolean) as string[];

    if (uiFiles.length > 0) {
      detected.push({
        id: 'ui',
        name: 'UI Components',
        category: 'frontend',
        description: `${uiFiles.length} UI components and views`,
        files: Array.from(new Set(uiFiles)),
        confidence: 0.95,
        icon: '🎨',
      });
    }

    // Detect Business Logic
    const businessFiles = memory.domains.flatMap(d =>
      d.nodes.filter(n => n.includes('service') || n.includes('business') || n.includes('logic'))
    ).map(n => n.split(':')[1]).filter(Boolean) as string[];

    if (businessFiles.length > 0) {
      detected.push({
        id: 'business',
        name: 'Business Logic',
        category: 'architecture',
        description: 'Core business rules and domain logic',
        files: Array.from(new Set(businessFiles)),
        confidence: 0.8,
        icon: '⚙️',
      });
    }

    // Detect Testing Infrastructure
    const testFiles = memory.domains.flatMap(d =>
      d.nodes.filter(n => n.includes('test') || n.includes('.test.') || n.includes('.spec.'))
    ).map(n => n.split(':')[1]).filter(Boolean) as string[];

    if (testFiles.length > 0) {
      detected.push({
        id: 'testing',
        name: 'Testing Infrastructure',
        category: 'quality',
        description: `${testFiles.length} test files`,
        files: Array.from(new Set(testFiles)),
        confidence: 1.0,
        icon: '🧪',
      });
    }

    // Detect Configuration
    const configFiles = memory.domains.flatMap(d =>
      d.nodes.filter(n => n.includes('config') || n.includes('.json') || n.includes('.yaml'))
    ).map(n => n.split(':')[1]).filter(Boolean) as string[];

    if (configFiles.length > 0) {
      detected.push({
        id: 'config',
        name: 'Configuration',
        category: 'infrastructure',
        description: 'Application configuration and settings',
        files: Array.from(new Set(configFiles)),
        confidence: 1.0,
        icon: '⚙️',
      });
    }

    return detected;
  }

  const categories = Array.from(new Set(patterns.map(p => p.category)));
  
  const filteredPatterns = selectedCategory === 'all'
    ? patterns
    : patterns.filter(p => p.category === selectedCategory);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      security: '#ef4444',
      architecture: '#3b82f6',
      data: '#8b5cf6',
      frontend: '#10b981',
      quality: '#f59e0b',
      infrastructure: '#6b7280',
    };
    return colors[category] || '#6b7280';
  };

  return (
    <div className="system-analyzer">
      <div className="analyzer-header">
        <div className="header-top">
          <h2 className="analyzer-title">
            <span className="icon">🔍</span>
            System Analyzer
          </h2>
          <p className="analyzer-subtitle">
            AI-powered analysis of system patterns and architecture
          </p>
        </div>

        <div className="category-filters">
          <button
            className={`filter-chip ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All Systems ({patterns.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
              style={{
                borderColor: selectedCategory === cat ? getCategoryColor(cat) : undefined,
              }}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)} ({patterns.filter(p => p.category === cat).length})
            </button>
          ))}
        </div>
      </div>

      <div className="patterns-grid">
        {filteredPatterns.map(pattern => (
          <div key={pattern.id} className="pattern-card">
            <div className="pattern-header">
              <div className="pattern-icon" style={{ backgroundColor: getCategoryColor(pattern.category) }}>
                {pattern.icon}
              </div>
              <div className="pattern-meta">
                <h3 className="pattern-name">{pattern.name}</h3>
                <span className="pattern-category">{pattern.category}</span>
              </div>
              <div className="pattern-confidence">
                {(pattern.confidence * 100).toFixed(0)}%
              </div>
            </div>

            <p className="pattern-description">{pattern.description}</p>

            <div className="pattern-stats">
              <div className="stat">
                <span className="stat-value">{pattern.files.length}</span>
                <span className="stat-label">Files</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {memory.flows.filter(f => f.steps.some(s => pattern.files.includes(s.path || ''))).length}
                </span>
                <span className="stat-label">Flows</span>
              </div>
            </div>

            <div className="pattern-actions">
              <button
                className="action-btn primary"
                onClick={() => onQuickInsight(pattern.id)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Analyze
              </button>
              <button className="action-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                Details
              </button>
            </div>

            {/* File List (Expandable) */}
            <details className="pattern-files">
              <summary>
                Show {pattern.files.length} file{pattern.files.length !== 1 ? 's' : ''}
              </summary>
              <ul className="file-list">
                {pattern.files.slice(0, 10).map(file => (
                  <li key={file} className="file-item">
                    <span className="file-name">{file}</span>
                    <button
                      className="quick-action"
                      onClick={() => onQuickInsight(file)}
                      title="Quick Insights"
                    >
                      ✨
                    </button>
                  </li>
                ))}
                {pattern.files.length > 10 && (
                  <li className="file-item more">
                    + {pattern.files.length - 10} more files
                  </li>
                )}
              </ul>
            </details>
          </div>
        ))}
      </div>

      {filteredPatterns.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No patterns found</h3>
          <p>Try selecting a different category</p>
        </div>
      )}

      {/* AI Recommendations */}
      <div className="recommendations-section">
        <h3 className="section-title">
          <span className="icon">💡</span>
          AI Recommendations
        </h3>
        
        <div className="recommendations-list">
          <div className="recommendation-card">
            <div className="rec-icon">🔐</div>
            <div className="rec-content">
              <h4>Enhance Authentication Security</h4>
              <p>Consider implementing 2FA and session timeout mechanisms in your auth system</p>
            </div>
          </div>

          <div className="recommendation-card">
            <div className="rec-icon">📊</div>
            <div className="rec-content">
              <h4>Add Monitoring & Logging</h4>
              <p>No monitoring patterns detected. Consider adding observability to critical paths</p>
            </div>
          </div>

          <div className="recommendation-card">
            <div className="rec-icon">🧪</div>
            <div className="rec-content">
              <h4>Increase Test Coverage</h4>
              <p>Test coverage could be improved for the business logic layer</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
