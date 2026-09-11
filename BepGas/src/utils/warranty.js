const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

/**
 * Tính trạng thái bảo hành của một OrderItem.
 * @param {object} item         - OrderItem với field warrantyMonths
 * @param {string} deliveredAt  - ISO date string khi đơn được giao
 * @param {string} orderStatus  - trạng thái đơn hàng
 * @returns {{
 *   hasWarranty: boolean,
 *   months: number,
 *   status: 'none'|'not_started'|'active'|'expiring'|'expired',
 *   statusLabel: string,
 *   startDate: Date|null,
 *   endDateStr: string,
 *   startDateStr: string,
 *   daysLeft: number|null
 * }}
 */
export function getWarrantyInfo(item, deliveredAt, orderStatus) {
  const months = item.warrantyMonths ?? 0;

  if (months <= 0) {
    return {
      hasWarranty: false, months: 0, status: 'none',
      statusLabel: 'Không áp dụng bảo hành',
      startDate: null, startDateStr: '—', endDateStr: '—', daysLeft: 0,
    };
  }

  if (orderStatus !== 'delivered' || !deliveredAt) {
    return {
      hasWarranty: true, months, status: 'not_started',
      statusLabel: 'Bảo hành bắt đầu khi nhận hàng',
      startDate: null, startDateStr: '—', endDateStr: '—', daysLeft: null,
    };
  }

  const start = new Date(deliveredAt);
  const end   = new Date(deliveredAt);
  end.setMonth(end.getMonth() + months);

  const now      = new Date();
  const daysLeft = Math.ceil((end - now) / 86_400_000);

  let status, statusLabel;
  if (daysLeft <= 0) {
    status = 'expired';
    statusLabel = 'Đã hết hạn bảo hành';
  } else if (daysLeft <= 30) {
    status = 'expiring';
    statusLabel = `Sắp hết hạn (còn ${daysLeft} ngày)`;
  } else {
    status = 'active';
    statusLabel = `Còn bảo hành (còn ${daysLeft} ngày)`;
  }

  return {
    hasWarranty: true, months, status, statusLabel,
    startDate: start,
    startDateStr: fmtDate(start),
    endDateStr:   fmtDate(end),
    daysLeft,
  };
}
