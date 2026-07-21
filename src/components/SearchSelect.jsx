import { useState } from 'react';

// Generic searchable select: type to filter, click to pick. For long lists where
// a native <select> is unusable. Pass getLabel/getSub/match to control display.
const SearchSelect = ({
  items, value, onChange,
  getLabel, getSub, getKey = (x) => x._id, match,
  placeholder = 'Axtar...'
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = items.find((x) => getKey(x) === value);
  const q = query.trim().toLowerCase();
  const matches = q
    ? items.filter((x) => (match ? match(x, q) : getLabel(x).toLowerCase().includes(q))).slice(0, 40)
    : [];

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <input
        className="form-control"
        value={open ? query : (selected ? getLabel(selected) : '')}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 2,
          background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6,
          maxHeight: 240, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
        }}>
          {matches.map((x) => (
            <div
              key={getKey(x)}
              onMouseDown={() => { onChange(getKey(x)); setQuery(''); setOpen(false); }}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-50)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
            >
              <div style={{ fontWeight: 500 }}>{getLabel(x)}</div>
              {getSub && getSub(x) ? <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{getSub(x)}</div> : null}
            </div>
          ))}
        </div>
      )}
      {open && q && matches.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 2,
          background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6,
          padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontSize: '0.85rem'
        }}>
          Tapılmadı
        </div>
      )}
    </div>
  );
};

export default SearchSelect;
