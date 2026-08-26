import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './CustomerFormModal.css';

export const EMPTY_CUSTOMER_FORM = {
  type: 'physical',
  name: '',
  brandName: '',
  voen: '',
  fin: '',
  address: '',
  contactPerson: '',
  phone: ''
};

export const cleanCustomerPayload = (data) =>
  Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

const AZ_PHONE_PREFIX = '+994';
const AZ_PHONE_MAX_LENGTH = 13; // +994 + 9 digits

export const formatPhoneNumber = (value) => {
  if (!value || !/\d/.test(value)) return '';

  let digits = String(value).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('994')) {
    digits = digits.slice(3);
  }
  while (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return `${AZ_PHONE_PREFIX}${digits.slice(0, 9)}`;
};

const CustomerFormModal = ({
  open,
  onClose,
  onSubmit,
  loading = false,
  initialValues = EMPTY_CUSTOMER_FORM,
  title = 'Yeni Müştəri',
  submitLabel = 'Yarat',
  loadingLabel = 'Yaradılır...'
}) => {
  const [form, setForm] = useState(initialValues);

  useEffect(() => {
    if (open) {
      const phone = initialValues.phone
        ? formatPhoneNumber(initialValues.phone)
        : '';
      setForm({ ...EMPTY_CUSTOMER_FORM, ...initialValues, phone });
    }
  }, [open, initialValues]);

  if (!open) return null;

  const handlePhoneChange = (value) => {
    if (!value) {
      setForm({ ...form, phone: '' });
      return;
    }
    if (!/\d/.test(value)) {
      setForm({ ...form, phone: value.startsWith('+') ? '+' : '' });
      return;
    }
    setForm({ ...form, phone: formatPhoneNumber(value) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Ad, soyad, ata adı daxil edin');
      return;
    }
    if (!form.phone.trim()) {
      toast.error('Əlaqə nömrəsi daxil edin');
      return;
    }
    onSubmit(cleanCustomerPayload(form));
  };

  return (
    <div className="customer-form-modal-overlay" onClick={onClose}>
      <div className="customer-form-modal" onClick={(e) => e.stopPropagation()}>
        <header className="customer-form-modal__header">
          <h3 className="customer-form-modal__title">{title}</h3>
          <button
            type="button"
            className="customer-form-modal__close"
            onClick={onClose}
            aria-label="Bağla"
          >
            <FiX size={18} />
          </button>
        </header>

        <form className="customer-form-modal__body" onSubmit={handleSubmit}>
          <div className="customer-form-modal__grid">
            <div className="form-group customer-form-modal__span-2">
              <label className="form-label">Müştəri tipi *</label>
              <select
                className="form-control"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="physical">Fiziki şəxs</option>
                <option value="legal">Hüquqi şəxs</option>
                <option value="master">Usta (Texnik)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ad, Soyad, Ata adı *</label>
              <input
                type="text"
                className="form-control"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Məsələn: Əliyev Əli Vəli oğlu"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Müştəri brend adı</label>
              <input
                type="text"
                className="form-control"
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                placeholder="Şirkət/mağaza adı"
              />
            </div>

            {form.type === 'physical' ? (
              <div className="form-group">
                <label className="form-label">FIN (Şəxsiyyət nömrəsi)</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.fin}
                  onChange={(e) => setForm({ ...form, fin: e.target.value.toUpperCase() })}
                  placeholder="7 simvol, məsələn: 1AB2C3D"
                />
              </div>
            ) : (
              <div className="customer-form-modal__grid-spacer" aria-hidden="true" />
            )}

            <div className="form-group">
              <label className="form-label">VÖEN (Vergi nömrəsi)</label>
              <input
                type="text"
                className="form-control"
                value={form.voen}
                onChange={(e) => setForm({ ...form, voen: e.target.value })}
                placeholder="1234567890"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ünvan</label>
              <input
                type="text"
                className="form-control"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Şəhər, küçə, bina"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Referral (Kim tövsiyə edib)</label>
              <input
                type="text"
                className="form-control"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="Tövsiyə edən şəxs"
              />
            </div>

            <div className="form-group customer-form-modal__span-2">
              <label className="form-label">Əlaqə nömrəsi *</label>
              <input
                type="tel"
                className="form-control"
                value={form.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+994 XX XXX XX XX"
                maxLength={AZ_PHONE_MAX_LENGTH}
              />
            </div>
          </div>

          <div className="customer-form-modal__actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Ləğv et
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? loadingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerFormModal;
