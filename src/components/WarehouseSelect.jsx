import { useState, useRef, useEffect } from 'react';
import { LuStore, LuWarehouse, LuChevronDown } from 'react-icons/lu';

// Warehouse / store picker with real Lucide icons (a native <select> can't render
// SVG icons in its options). Groups by type and supports an optional "all" entry.
const WhIcon = ({ isStore }) =>
  isStore
    ? <LuStore size={16} style={{ color: 'var(--primary, #2563eb)' }} aria-hidden />
    : <LuWarehouse size={16} style={{ color: 'var(--primary, #2563eb)' }} aria-hidden />;

const WarehouseSelect = ({
  warehouses, value, exclude, onChange,
  placeholder = 'Seçin...', allowAll = false, allLabel = 'Bütün Anbarlar'
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const list = warehouses.filter((w) => w._id !== exclude);
  const stocks = list.filter((w) => !w.isStore);
  const stores = list.filter((w) => w.isStore);
  const selected = warehouses.find((w) => w._id === value);

  const pick = (id) => { onChange(id); setOpen(false); };

  const Row = ({ w }) => (
    <div
      onMouseDown={() => pick(w._id)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.75rem', cursor: 'pointer' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-50)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
    >
      <WhIcon isStore={w.isStore} />
      <span>{w.name}{w.code ? <span style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}> ({w.code})</span> : null}</span>
    </div>
  );

  const groupLabel = (t) => (
    <div style={{ padding: '0.3rem 0.75rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t}</div>
  );

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: open ? 1000 : undefined }}>
      <button
        type="button"
        className="form-control"
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer', width: '100%' }}
      >
        {selected && <WhIcon isStore={selected.isStore} />}
        <span style={{ flex: 1, color: selected ? 'inherit' : 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.name : placeholder}
        </span>
        <LuChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 2,
          background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6,
          maxHeight: 280, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
        }}>
          {allowAll && (
            <div
              onMouseDown={() => pick('')}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', color: 'var(--gray-600)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-50)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
            >
              {allLabel}
            </div>
          )}
          {stocks.length > 0 && groupLabel('Anbarlar')}
          {stocks.map((w) => <Row key={w._id} w={w} />)}
          {stores.length > 0 && groupLabel('Mağazalar')}
          {stores.map((w) => <Row key={w._id} w={w} />)}
        </div>
      )}
    </div>
  );
};

export default WarehouseSelect;
