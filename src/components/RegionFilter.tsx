import React, { useState, useEffect, useRef } from 'react';

export const ALL_REGIONS = ['HN', 'EAST', 'HCM', 'NORTH', 'CENTRAL', 'MEKONG'];

interface RegionFilterProps {
  selectedRegions: string[];
  onChange: (regions: string[]) => void;
  label?: string;
  showTitle?: boolean;
}

export const RegionFilter: React.FC<RegionFilterProps> = ({
  selectedRegions,
  onChange,
  label = "Vùng",
  showTitle = true
}) => {
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
    if (selectedRegions.length === ALL_REGIONS.length) {
      onChange([]);
    } else {
      onChange([...ALL_REGIONS]);
    }
  };

  const toggleRegion = (region: string) => {
    if (selectedRegions.includes(region)) {
      onChange(selectedRegions.filter(r => r !== region));
    } else {
      onChange([...selectedRegions, region]);
    }
  };

  const getLabelText = () => {
    if (selectedRegions.length === ALL_REGIONS.length) return 'Tất cả';
    if (selectedRegions.length === 0) return 'Chọn vùng';
    if (selectedRegions.length <= 2) return selectedRegions.join(', ');
    return `${selectedRegions.length} vùng`;
  };

  return (
    <div className="filter-dropdown" ref={containerRef}>
      <button
        className={`dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Chọn ${label.toLowerCase()}`}
        aria-expanded={isOpen}
      >
        {showTitle && <span className="dropdown-label-title">{label}:</span>}
        <span className="dropdown-label-value">{getLabelText()}</span>
        <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {isOpen && (
        <div className="dropdown-menu scrollable">
          <div className="dropdown-item" onClick={toggleAll}>
            <input
              type="checkbox"
              checked={selectedRegions.length === ALL_REGIONS.length}
              readOnly
              aria-label="Chọn tất cả khu vực"
            />
            <span className="font-bold">Tất cả (All)</span>
          </div>
          <div className="divider my-1 h-px" />
          {ALL_REGIONS.map(r => (
            <div key={r} className="dropdown-item" onClick={() => toggleRegion(r)}>
              <input
                type="checkbox"
                checked={selectedRegions.includes(r)}
                readOnly
                aria-label={`Chọn khu vực ${r}`}
              />
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
