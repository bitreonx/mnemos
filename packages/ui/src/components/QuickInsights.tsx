import { useState, useEffect } from 'react';
import type { MemoryModel, Domain, Flow } from '../types';

interface QuickInsightsProps {
  memory: MemoryModel;
  target: string; // file path, domain name, or system name
  onClose: () => void;
}

interface Insight {
  type: 'info' | 'warning' | 'success' | 'tip';
  title: string;
  content: string;
  icon: string;
}

export function QuickInsights({ memory, target, onClose }: QuickInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatedDomains, setRelatedDomains] = useState<Domain[]>([]);
  const [relatedFlows, setRelatedFlows] = useState<Flow[]>([]);

  useEffect(() => {
    analyzeTarget();
  }, [target, memory]);

  const analyzeTarget = () => {
    setLoading(true);
    
    const newInsights: Insight[] = [];
    const domains: Domain[] = [];
    const flows: Flow[] = [];

    // Find related domains
    memory.domains.forEach(domain => {
      if (domain.nodes.some(node => node.includes(target))) {
        domains.push(domain);
        newInsights.push({
          type: 'info',
          title: `Part of ${domain.name} Domain`,
          content: `This file belongs to the ${domain.name} domain with ${(domain.confidence * 100).toFixed(0)}% confidence`,
          icon: '🏗️',
        });
      }
    });

    // Find related flows
    memory.flows.forEach(flow => {
      if (flow.steps.some(step => step.path?.includes(target))) {
        flows.push(flow);
        newInsights.push({
          type: 'info',
          title: `Used in ${flow.name} Flow`,
          content: `This file is part of the ${flow.name} flow (${flow.type})`,
          icon: '🔄',
        });
      }
    });

    // Check for smells
    const relatedSmells = memory.smells.filter(smell =>
      smell.nodes.some(node => node.includes(target))
    );

    if (relatedSmells.length > 0) {
      relatedSmells.forEach(smell => {
        newInsights.push({
          type: 'warning',
          title: `Code Smell: ${smell.type}`,
          content: smell.recommendation,
          icon: '⚠️',
        });
      });
    } else {
      newInsights.push({
        type: 'success',
        title: 'Clean Code',
        content: 'No code smells detected in this file',
        icon: '✅',
      });
    }

    // API endpoints
    const apis = memory.apis.filter(api => api.file.includes(target));
    if (apis.length > 0) {
      newInsights.push({
        type: 'info',
        title: 'API Endpoints',
        content: `Exposes ${apis.length} API endpoint(s): ${apis.map(a => `${a.method} ${a.path}`).join(', ')}`,
        icon: '🌐',
      });
    }

    // Dependencies
    const deps = memory.dependencies?.filter(dep =>
      dep.from.includes(target) || dep.to.includes(target)
    ) || [];

    if (deps.length > 0) {
      const importCount = deps.filter(d => d.from.includes(target)).length;
      const importedCount = deps.filter(d => d.to.includes(target)).length;
      
      newInsights.push({
        type: 'info',
        title: 'Dependencies',
        content: `Imports ${importCount} file(s) and is imported by ${importedCount} file(s)`,
        icon: '📦',
      });
    }

    // AI Tips based on the type
    if (target.includes('auth')) {
      newInsights.push({
        type: 'tip',
        title: 'Authentication System',
        content: 'This appears to be part of the authentication system. Consider checking session management, password policies, and token handling.',
        icon: '🔐',
      });
    } else if (target.includes('api')) {
      newInsights.push({
        type: 'tip',
        title: 'API Layer',
        content: 'This is an API file. Ensure proper input validation, error handling, and rate limiting are in place.',
        icon: '🎯',
      });
    } else if (target.includes('db') || target.includes('database')) {
      newInsights.push({
        type: 'tip',
        title: 'Database Layer',
        content: 'This handles database operations. Review for SQL injection vulnerabilities and ensure proper connection pooling.',
        icon: '🗄️',
      });
    }

    setInsights(newInsights);
    setRelatedDomains(domains);
    setRelatedFlows(flows);
    setLoading(false);
  };

  return (
    <div className="quick-insights-panel">
      <div className="panel-overlay" onClick={onClose}></div>
      
      <div className="panel-content">
        <div className="panel-header">
          <h2 className="panel-title">
            <span className="icon">✨</span>
            Quick Insights
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="target-info">
          <div className="target-icon">📄</div>
          <div className="target-details">
            <h3 className="target-name">{target.split('/').pop() || target}</h3>
            <p className="target-path">{target}</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Analyzing...</p>
          </div>
        ) : (
          <>
            <div className="insights-list">
              {insights.map((insight, index) => (
                <div key={index} className={`insight-card ${insight.type}`}>
                  <div className="insight-icon">{insight.icon}</div>
                  <div className="insight-content">
                    <h4 className="insight-title">{insight.title}</h4>
                    <p className="insight-text">{insight.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {relatedDomains.length > 0 && (
              <div className="related-section">
                <h3 className="section-title">Related Domains</h3>
                <div className="related-items">
                  {relatedDomains.map(domain => (
                    <div key={domain.id} className="related-item">
                      <span className="item-name">{domain.name}</span>
                      <span className="item-badge">{(domain.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {relatedFlows.length > 0 && (
              <div className="related-section">
                <h3 className="section-title">Related Flows</h3>
                <div className="related-items">
                  {relatedFlows.map(flow => (
                    <div key={flow.id} className="related-item">
                      <span className="item-name">{flow.name}</span>
                      <span className="item-badge">{flow.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="action-buttons">
              <button className="action-btn primary">
                View Full Analysis
              </button>
              <button className="action-btn">
                Open in Graph
              </button>
              <button className="action-btn">
                Show Dependencies
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
