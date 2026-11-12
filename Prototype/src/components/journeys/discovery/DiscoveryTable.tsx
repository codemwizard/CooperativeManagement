import React, { useState } from 'react';
import type { CaseState } from '../../../engine/types';
import { destinations, meta } from '../../../engine/data';
import { evaluate } from '../../../engine/evaluate';
import { memberAssetSummary, coopAssetSummary } from '../assetSummary';

interface DiscoveryTableProps {
  cases: CaseState[];
  selectedCaseId?: string;
  onSelectCase: (caseId: string) => void;
  defaultDestinationId?: string;
}

export const DiscoveryTable: React.FC<DiscoveryTableProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  defaultDestinationId = 'A',
}) => {
  const [selectedDestId, setSelectedDestId] = useState<string>(defaultDestinationId);
  const [provinceFilter, setProvinceFilter] = useState<string>('all');

  const destination = destinations.find(d => d.id === selectedDestId) || destinations[0];

  const provinces = ['all', ...new Set(cases.map(c => c.province))];

  const filteredCases = cases.filter(c => {
    if (provinceFilter !== 'all' && c.province !== provinceFilter) return false;
    return true;
  });

  return (
    <div className="journey-card" data-testid="discovery-table">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
          Enterprise Pipeline Discovery
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div>
            <select
              className="journey-select"
              value={selectedDestId}
              onChange={e => setSelectedDestId(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px' }}
              data-testid="discovery-dest-select"
            >
              {destinations.map(d => (
                <option key={d.id} value={d.id}>
                  Target: {d.display_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              className="journey-select"
              value={provinceFilter}
              onChange={e => setProvinceFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px' }}
              data-testid="discovery-province-select"
            >
              {provinces.map(p => (
                <option key={p} value={p}>
                  {p === 'all' ? 'All Provinces' : p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredCases.map(c => {
          const evaluation = evaluate(c, destination, meta.demo_date);
          const isReady = evaluation.summary.ready;
          const memberSummary = memberAssetSummary(c as any);
          const coopAssets = coopAssetSummary(c as any);
          const isSelected = c.id === selectedCaseId;

          return (
            <div
              key={c.id}
              style={{
                border: isSelected ? '2px solid var(--action)' : '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                background: isSelected ? 'var(--action-soft)' : 'var(--surface-raised)',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
              }}
              onClick={() => onSelectCase(c.id)}
              data-testid={`case-row-${c.id}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{c.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    {c.district}, {c.province} · Value chain: <strong>{c.activity}</strong> · {c.members} members
                  </div>
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: isReady ? 'var(--verified)' : 'var(--asserted)',
                      color: '#ffffff',
                    }}
                    data-testid={`case-readiness-${c.id}`}
                  >
                    {isReady ? `Ready for ${destination.display_name}` : `Not ready for ${destination.display_name}`}
                  </span>
                </div>
              </div>

              {/* Grouped Personal Asset Summary (No personal names) */}
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  border: '1px solid var(--line)',
                }}
                data-testid="member-asset-summary"
              >
                <div style={{ color: 'var(--muted)' }}>
                  <strong>{memberSummary.label}:</strong> {memberSummary.livestock_item_count} items (ZMW {memberSummary.livestock_est_value_zmw.toLocaleString()}) · Encumbrance: <em>{memberSummary.encumbrance_summary}</em>
                </div>
                {coopAssets.length > 0 && (
                  <div style={{ color: 'var(--muted)', marginTop: '4px' }}>
                    <strong>Cooperative assets:</strong> {coopAssets.map(a => `${a.type} (${a.description})`).join(', ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
