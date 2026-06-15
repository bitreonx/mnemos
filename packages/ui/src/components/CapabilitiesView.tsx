import { useState, useMemo } from 'react';
import type { MemoryModel, Capability, DiscoveredJourney } from '../types';

interface CapabilitiesViewProps {
  memory: MemoryModel;
}

type Tab = 'capabilities' | 'journeys' | 'all';

const CATEGORY_COLORS: Record<string, string> = {
  identity: '#8b5cf6',
  commerce: '#10b981',
  communication: '#06b6d4',
  content: '#f59e0b',
  operations: '#3b82f6',
  platform: '#71717a',
  analytics: '#ec4899',
};

export function CapabilitiesView({ memory }: CapabilitiesViewProps) {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');

  const capabilities = memory.capabilities ?? [];
  const journeys = memory.journeys ?? [];

  const filteredCaps = useMemo(
    () =>
      capabilities.filter((c) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          c.signature.name.toLowerCase().includes(q) ||
          c.signature.purpose.toLowerCase().includes(q) ||
          c.signature.category.includes(q) ||
          c.services.some((s) => s.toLowerCase().includes(q))
        );
      }),
    [capabilities, query],
  );

  const filteredJourneys = useMemo(
    () =>
      journeys.filter((j) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          j.signature.name.toLowerCase().includes(q) ||
          j.signature.purpose.toLowerCase().includes(q) ||
          (j.entryRoute ?? '').toLowerCase().includes(q)
        );
      }),
    [journeys, query],
  );

  return (
    <div className="cap-view">
      <div className="cap-header">
        <div>
          <h1 className="cap-title">Capabilities &amp; Journeys</h1>
          <p className="cap-sub">
            What the software can do ({capabilities.length} capabilities, {journeys.length} user
            journeys) and how users move through it.
          </p>
        </div>
        <div className="cap-tabs">
          <button
            className={tab === 'all' ? 'active' : ''}
            onClick={() => setTab('all')}
          >
            All
          </button>
          <button
            className={tab === 'capabilities' ? 'active' : ''}
            onClick={() => setTab('capabilities')}
          >
            Capabilities
          </button>
          <button
            className={tab === 'journeys' ? 'active' : ''}
            onClick={() => setTab('journeys')}
          >
            Journeys
          </button>
        </div>
      </div>

      <div className="cap-search">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, purpose, category, or service…"
        />
      </div>

      {(tab === 'all' || tab === 'capabilities') && (
        <section>
          <h2 className="section-title">Capabilities</h2>
          {filteredCaps.length === 0 ? (
            <div className="empty-card">No capabilities match.</div>
          ) : (
            <div className="cap-grid">
              {filteredCaps.map((c) => (
                <CapabilityCard key={c.id} capability={c} />
              ))}
            </div>
          )}
        </section>
      )}

      {(tab === 'all' || tab === 'journeys') && (
        <section>
          <h2 className="section-title">User Journeys</h2>
          {filteredJourneys.length === 0 ? (
            <div className="empty-card">No journeys match.</div>
          ) : (
            <div className="journey-list">
              {filteredJourneys.map((j) => (
                <JourneyCard key={j.id} journey={j} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CapabilityCard({ capability }: { capability: Capability }) {
  const color = CATEGORY_COLORS[capability.signature.category] ?? '#71717a';
  const confidence = Math.round(capability.confidence * 100);
  return (
    <article className="cap-card">
      <header className="cap-card-head">
        <span
          className="category-chip"
          style={{ background: `${color}22`, color }}
        >
          {capability.signature.category}
        </span>
        <span className={`tag tag-${confidence > 60 ? 'low' : confidence > 30 ? 'medium' : 'high'}`}>
          {confidence}%
        </span>
      </header>
      <h3 className="cap-card-name">{capability.signature.name}</h3>
      <p className="cap-card-purpose">{capability.signature.purpose}</p>

      {capability.services.length > 0 && (
        <div className="cap-card-section">
          <div className="cap-card-label">Services</div>
          <div className="cap-chip-list">
            {capability.services.map((s) => (
              <span key={s} className="cap-chip">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {capability.apis.length > 0 && (
        <div className="cap-card-section">
          <div className="cap-card-label">Endpoints</div>
          <div className="cap-chip-list">
            {capability.apis.map((a) => (
              <span key={a} className="cap-chip mono">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {capability.actors && capability.actors.length > 0 && (
        <footer className="cap-card-footer">
          <span className="footer-label">Actors:</span>
          <span>{capability.actors.join(', ')}</span>
        </footer>
      )}
    </article>
  );
}

function JourneyCard({ journey }: { journey: DiscoveredJourney }) {
  const confidence = Math.round(journey.confidence * 100);
  return (
    <article className="journey-card">
      <header className="journey-card-head">
        <h3 className="journey-card-name">{journey.signature.name}</h3>
        <span className={`tag tag-${confidence > 60 ? 'low' : 'medium'}`}>{confidence}%</span>
      </header>
      <p className="journey-card-purpose">{journey.signature.purpose}</p>
      <p className="journey-card-reason">{journey.reason ?? ''}</p>

      <div className="journey-card-grid">
        {journey.entryRoute && (
          <>
            <div className="cap-card-label">Entry</div>
            <div className="mono">{journey.entryRoute}</div>
          </>
        )}
        {journey.actors.length > 0 && (
          <>
            <div className="cap-card-label">Actors</div>
            <div>{journey.actors.join(', ')}</div>
          </>
        )}
        {journey.data.length > 0 && (
          <>
            <div className="cap-card-label">Data</div>
            <div>{journey.data.join(', ')}</div>
          </>
        )}
        {journey.outcomes.length > 0 && (
          <>
            <div className="cap-card-label">Outcomes</div>
            <div>{journey.outcomes.join(', ')}</div>
          </>
        )}
        {journey.preconditions && journey.preconditions.length > 0 && (
          <>
            <div className="cap-card-label">Requires</div>
            <div>{journey.preconditions.join(', ')}</div>
          </>
        )}
      </div>
    </article>
  );
}
