import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';

/**
 * Dropdown that prevents typos/duplicates. It looks and opens like a <select>
 * (chevron, click shows the full list of existing values), but you can also type
 * to filter and explicitly add a new value via "➕ «...» əlavə et".
 *
 * A value is committed ONLY by selecting an option or clicking the add row.
 * Free typing just filters; on blur, uncommitted text is discarded — so a
 * mistyped value can never silently become the field value.
 *
 * Props: value, onChange(value), options:string[], placeholder, allowAdd=true.
 */
const ComboBox = ({ value = '', onChange, options = [], placeholder = '', allowAdd = true }) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false); // has the user typed a filter since opening?
  const blurTimer = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);
  useEffect(() => () => clearTimeout(blurTimer.current), []);

  // Until the user types, show the whole list (so it behaves like a dropdown).
  const q = query.trim().toLowerCase();
  const filtering = typed && q !== '';
  const filtered = filtering ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const exactExists = options.some((o) => o.toLowerCase() === q);
  const showAdd = allowAdd && q.length > 0 && !exactExists;

  const commit = (val) => {
    onChange(val);
    setQuery(val);
    setTyped(false);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        className="form-control"
        style={{ paddingRight: '2.5rem', cursor: 'pointer' }}
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setTyped(true); setOpen(true); }}
        onFocus={(e) => { setOpen(true); setTyped(false); e.target.select(); }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => {
            setOpen(false);
            setQuery(value || ''); // discard uncommitted typing
            setTyped(false);
          }, 150);
        }}
      />
      <FiChevronDown
        style={{
          position: 'absolute', right: '0.75rem', top: '50%',
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition: 'transform 0.15s ease', color: 'var(--gray-500, #64748b)',
          pointerEvents: 'none'
        }}
      />
      {open && (filtered.length > 0 || showAdd) && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'white', border: '1px solid var(--gray-200, #e5e7eb)',
            borderRadius: '6px', marginTop: '2px', maxHeight: '240px', overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}
        >
          {filtered.map((opt) => {
            const selected = opt === value;
            return (
              <div
                key={opt}
                // onMouseDown (not onClick) so it fires before the input's blur.
                onMouseDown={(e) => { e.preventDefault(); clearTimeout(blurTimer.current); commit(opt); }}
                style={{
                  padding: '0.5rem 0.75rem', cursor: 'pointer',
                  background: selected ? 'var(--gray-50, #f9fafb)' : 'white',
                  fontWeight: selected ? 600 : 400
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-50, #f9fafb)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = selected ? 'var(--gray-50, #f9fafb)' : 'white')}
              >
                {opt}
              </div>
            );
          })}
          {showAdd && (
            <div
              onMouseDown={(e) => { e.preventDefault(); clearTimeout(blurTimer.current); commit(query.trim()); }}
              style={{
                padding: '0.5rem 0.75rem', cursor: 'pointer', fontWeight: 600,
                color: 'var(--primary, #2563eb)',
                borderTop: filtered.length ? '1px solid var(--gray-100, #f3f4f6)' : 'none'
              }}
            >
              ➕ «{query.trim()}» əlavə et
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComboBox;
