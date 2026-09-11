// Định dạng tiền tệ VND — dùng chung toàn app
export const fmt = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n ?? 0);

// Định dạng số ngắn gọn: 1.5 triệu, 500 nghìn
export const fmtShort = (n) => {
  if (n >= 1000000) return (n / 1000000 % 1 === 0 ? n / 1000000 : (n / 1000000).toFixed(1)) + ' triệu';
  if (n >= 1000)    return Math.round(n / 1000) + ' nghìn';
  return n + 'đ';
};

// Định dạng số có đơn vị đ (không dùng ký hiệu ₫)
export const fmtVnd = (n) => new Intl.NumberFormat('vi-VN').format(n ?? 0) + 'đ';

// Định dạng ngày giờ
export const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

// Tự động tạo slug từ tên tiếng Việt (dùng bảng ký tự, hỗ trợ đầy đủ dấu)
export const toSlug = (text) => {
  const map = {
    'à':'a','á':'a','ả':'a','ã':'a','ạ':'a',
    'ă':'a','ắ':'a','ặ':'a','ằ':'a','ẳ':'a','ẵ':'a',
    'â':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a',
    'è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e',
    'ê':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e',
    'ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
    'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o',
    'ô':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o',
    'ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o',
    'ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
    'ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u',
    'ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y',
    'đ':'d',
  };
  return text
    .toLowerCase()
    .split('').map(c => map[c] ?? c).join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};