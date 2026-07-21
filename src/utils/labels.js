// Human-readable Azerbaijani labels for backend category codes.
// Keep these in sync with backend/config/constants.js (EXPENSE_CATEGORIES, etc.)

export const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'İcarə' },
  { value: 'salary', label: 'Əmək haqqı' },
  { value: 'logistics', label: 'Logistika' },
  { value: 'utilities', label: 'Kommunal' },
  { value: 'maintenance', label: 'Təmir' },
  { value: 'marketing', label: 'Marketinq' },
  { value: 'delivery', label: 'Daşınma' },
  { value: 'installation', label: 'Quraşdırma' },
  { value: 'commission', label: 'Usta komissiyası' },
  { value: 'courier', label: 'Kuryer' },
  { value: 'packaging', label: 'Qablaşdırma' },
  { value: 'other', label: 'Digər' }
];

const EXPENSE_LABEL_MAP = EXPENSE_CATEGORIES.reduce((acc, c) => {
  acc[c.value] = c.label;
  return acc;
}, {});

// Returns the Azerbaijani label for an expense category code,
// falling back to the original value for any unknown code.
export const expenseCategoryLabel = (code) => EXPENSE_LABEL_MAP[code] || code || '—';

// Product categories (electric / heating / bathroom / general)
export const PRODUCT_CATEGORY_LABELS = {
  electric: 'Elektrik',
  heating: 'İsitmə',
  bathroom: 'Hamam',
  general: 'Ümumi'
};

export const productCategoryLabel = (code) => PRODUCT_CATEGORY_LABELS[code] || code || '—';
