/** UI: Nağd | Bank (POS/Bank) | Nisyə → API paymentType + paymentMethod */

export const PAYMENT_SELECTION = {
  CASH: 'cash',
  BANK: 'bank',
  CREDIT: 'credit'
};

export const BANK_METHOD = {
  POS: 'pos',
  BANK: 'bank'
};

export function toApiPayment(paymentSelection, bankMethod = BANK_METHOD.POS) {
  if (paymentSelection === PAYMENT_SELECTION.CREDIT) {
    return { paymentType: 'credit' };
  }
  if (paymentSelection === PAYMENT_SELECTION.CASH) {
    return { paymentType: 'prepaid', paymentMethod: 'cash' };
  }
  return { paymentType: 'prepaid', paymentMethod: bankMethod };
}

export function formatPaymentLabel(paymentType, paymentMethod) {
  if (paymentType === 'credit') return 'Nisyə';
  if (paymentMethod === 'cash') return 'Nağd';
  if (paymentMethod === 'pos') return 'Bank — POS';
  if (paymentMethod === 'bank') return 'Bank — Köçürmə';
  if (paymentType === 'prepaid') return 'Nağd';
  return '-';
}

export function paymentFromApi(paymentType, paymentMethod) {
  if (paymentType === 'credit') {
    return { paymentSelection: PAYMENT_SELECTION.CREDIT, bankMethod: BANK_METHOD.POS };
  }
  if (paymentMethod === 'cash') {
    return { paymentSelection: PAYMENT_SELECTION.CASH, bankMethod: BANK_METHOD.POS };
  }
  if (paymentMethod === 'pos' || paymentMethod === 'bank') {
    return {
      paymentSelection: PAYMENT_SELECTION.BANK,
      bankMethod: paymentMethod
    };
  }
  return { paymentSelection: PAYMENT_SELECTION.CASH, bankMethod: BANK_METHOD.POS };
}
