import { useState } from 'react';

// Searchable product picker for catalogues with thousands of products: type to
// filter by name/SKU, click to select. Replaces an unscrollable <select>.
const ProductSearchSelect = ({ products, value, onChange, placeholder = 'Məhsul axtar...' }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = products.find((p) => p._id === value);
  const q = query.trim().toLowerCase();
  const matches = q
    ? products
        .filter((p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
        .slice(0, 40)
    : [];

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, zIndex: open ? 1000 : undefined }}>
      <input
        className="form-control"
        value={open ? query : (selected ? `${selected.name} (${selected.sku})` : '')}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6,
          maxHeight: 240, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
        }}>
          {matches.map((p) => (
            <div
              key={p._id}
              onMouseDown={() => { onChange(p._id); setQuery(''); setOpen(false); }}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-50)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
            >
              <div style={{ fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{p.sku}</div>
            </div>
          ))}
        </div>
      )}
      {open && q && matches.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6,
          padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontSize: '0.85rem'
        }}>
          Tapılmadı
        </div>
      )}
    </div>
  );
};

export default ProductSearchSelect;
