import React, { useState, useEffect, useRef } from 'react';

const CHANNELS = [
  { id: 'crv', label: 'CRV', color: 'var(--c-crv)' },
  { id: 'stmb', label: 'STMB', color: 'var(--c-stmb)' },
];

interface ChannelFilterProps {
  selectedChannels: string[];
  onChange: (channels: string[]) => void;
}

export const ChannelFilter: React.FC<ChannelFilterProps> = ({ selectedChannels, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleAll = () => {
    if (selectedChannels.length === CHANNELS.length) {
      onChange([]);
    } else {
      onChange(CHANNELS.map(c => c.id));
    }
  };

  const toggleChannel = (id: string) => {
    if (selectedChannels.includes(id)) {
      onChange(selectedChannels.filter(c => c !== id));
    } else {
      onChange([...selectedChannels, id]);
    }
  };

  const getLabelText = () => {
    if (selectedChannels.length === CHANNELS.length) return 'Tất cả';
    if (selectedChannels.length === 0) return 'Chọn kênh';
    return selectedChannels.map(c => c.toUpperCase()).join(', ');
  };

  return (
    <div className="filter-dropdown" ref={containerRef}>
      <button
        className={`dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Chọn kênh bán"
        aria-expanded={isOpen}
      >
        <span className="dropdown-label-title">Channel:</span>
        <span className="dropdown-label-value">{getLabelText()}</span>
        <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-item" onClick={toggleAll}>
            <input type="checkbox" checked={selectedChannels.length === CHANNELS.length} readOnly aria-label="Chọn tất cả kênh" />
            <span className="font-bold">Tất cả (All)</span>
          </div>
          <div className="divider my-1 h-px" />
          {CHANNELS.map(ch => (
            <div key={ch.id} className="dropdown-item" onClick={() => toggleChannel(ch.id)}>
              <input type="checkbox" checked={selectedChannels.includes(ch.id)} readOnly aria-label={`Chọn kênh ${ch.label}`} />
              <span className="dot" style={{ background: ch.color, display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6 }} />
              <span>{ch.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
