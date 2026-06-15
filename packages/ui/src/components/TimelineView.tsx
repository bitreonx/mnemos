import { useState, useEffect } from 'react';
import type { MemoryModel } from '../types';

interface TimelineEvent {
  id: string;
  type: 'build' | 'change' | 'deploy' | 'analysis';
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface TimelineViewProps {
  memory: MemoryModel;
}

export function TimelineView({ memory }: TimelineViewProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  useEffect(() => {
    loadTimelineEvents();
  }, [memory]);

  const loadTimelineEvents = () => {
    // Generate timeline from memory model
    const timelineEvents: TimelineEvent[] = [
      {
        id: '1',
        type: 'build',
        title: 'Repository Analysis Complete',
        description: `Analyzed ${memory.stats.filesScanned} files and created ${memory.stats.nodesCreated} nodes`,
        timestamp: new Date(memory.builtAt),
        metadata: {
          duration: memory.stats.durationMs,
          files: memory.stats.filesScanned,
          nodes: memory.stats.nodesCreated,
        },
      },
    ];

    // Add domain discoveries
    memory.domains.forEach((domain, index) => {
      timelineEvents.push({
        id: `domain-${index}`,
        type: 'analysis',
        title: `Domain Discovered: ${domain.name}`,
        description: `Found ${domain.nodes.length} nodes with ${(domain.confidence * 100).toFixed(0)}% confidence`,
        timestamp: new Date(new Date(memory.builtAt).getTime() + index * 1000),
        metadata: {
          confidence: domain.confidence,
          nodes: domain.nodes.length,
        },
      });
    });

    // Add flow discoveries
    memory.flows.forEach((flow, index) => {
      timelineEvents.push({
        id: `flow-${index}`,
        type: 'analysis',
        title: `Flow Detected: ${flow.name}`,
        description: flow.description,
        timestamp: new Date(new Date(memory.builtAt).getTime() + (memory.domains.length + index) * 1000),
        metadata: {
          type: flow.type,
          steps: flow.steps.length,
        },
      });
    });

    setEvents(timelineEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  };

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.type === filter);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getEventIcon = (type: string) => {
    const icons = {
      build: '🔨',
      change: '📝',
      deploy: '🚀',
      analysis: '🔍',
    };
    return icons[type as keyof typeof icons] || '📌';
  };

  const getEventColor = (type: string) => {
    const colors = {
      build: '#3b82f6',
      change: '#f59e0b',
      deploy: '#10b981',
      analysis: '#8b5cf6',
    };
    return colors[type as keyof typeof colors] || '#6b7280';
  };

  return (
    <div className="timeline-view">
      <div className="timeline-header">
        <h2 className="timeline-title">
          <span className="icon">⏱️</span>
          Repository Timeline & History
        </h2>
        
        <div className="timeline-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Events
          </button>
          <button
            className={`filter-btn ${filter === 'build' ? 'active' : ''}`}
            onClick={() => setFilter('build')}
          >
            Builds
          </button>
          <button
            className={`filter-btn ${filter === 'analysis' ? 'active' : ''}`}
            onClick={() => setFilter('analysis')}
          >
            Analysis
          </button>
          <button
            className={`filter-btn ${filter === 'change' ? 'active' : ''}`}
            onClick={() => setFilter('change')}
          >
            Changes
          </button>
        </div>
      </div>

      <div className="timeline-stats">
        <div className="stat-card">
          <div className="stat-value">{events.length}</div>
          <div className="stat-label">Total Events</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{events.filter(e => e.type === 'build').length}</div>
          <div className="stat-label">Builds</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{events.filter(e => e.type === 'analysis').length}</div>
          <div className="stat-label">Analyses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{memory.stats.durationMs}ms</div>
          <div className="stat-label">Last Build</div>
        </div>
      </div>

      <div className="timeline-container">
        <div className="timeline-line"></div>
        
        {filteredEvents.map((event, index) => (
          <div
            key={event.id}
            className={`timeline-event ${selectedEvent?.id === event.id ? 'selected' : ''}`}
            onClick={() => setSelectedEvent(event)}
          >
            <div
              className="event-marker"
              style={{ backgroundColor: getEventColor(event.type) }}
            >
              {getEventIcon(event.type)}
            </div>
            
            <div className="event-content">
              <div className="event-header">
                <h3 className="event-title">{event.title}</h3>
                <span className="event-time">{formatTimestamp(event.timestamp)}</span>
              </div>
              
              <p className="event-description">{event.description}</p>
              
              {event.metadata && (
                <div className="event-metadata">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <span key={key} className="metadata-item">
                      {key}: <strong>{value}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedEvent && (
        <div className="event-detail-panel">
          <div className="panel-header">
            <h3>Event Details</h3>
            <button onClick={() => setSelectedEvent(null)}>×</button>
          </div>
          
          <div className="panel-content">
            <div className="detail-row">
              <span className="label">Type:</span>
              <span className="value">{selectedEvent.type}</span>
            </div>
            <div className="detail-row">
              <span className="label">Timestamp:</span>
              <span className="value">{selectedEvent.timestamp.toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span className="label">Title:</span>
              <span className="value">{selectedEvent.title}</span>
            </div>
            <div className="detail-row">
              <span className="label">Description:</span>
              <span className="value">{selectedEvent.description}</span>
            </div>
            
            {selectedEvent.metadata && (
              <>
                <h4 className="metadata-title">Metadata</h4>
                {Object.entries(selectedEvent.metadata).map(([key, value]) => (
                  <div key={key} className="detail-row">
                    <span className="label">{key}:</span>
                    <span className="value">{JSON.stringify(value)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
