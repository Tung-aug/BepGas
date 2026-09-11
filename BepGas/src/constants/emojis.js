// Bộ emoji dùng cho icon danh mục trong admin picker
export const KITCHEN_EMOJIS = [
  // Bếp & nấu nướng
  '🔥', '🍳', '🥘', '🍲', '🫕', '🍜',
  '🍚', '🥗', '🥙', '🌮', '🍕', '🥪',
  // Đồ uống
  '🍵', '☕', '🧋', '🥤', '🍶', '🫖',
  // Dụng cụ
  '🔪', '🥄', '🍴', '🥢', '🫙', '🧊',
  // Thiết bị
  '♨️', '💨', '⚡', '🌡️', '🫧', '💧',
  // Khác
  '🏠', '🛒', '📦', '⭐', '🔧', '⚙️',
];

// Bản đồ từ khóa slug → emoji (fallback khi không có icon riêng)
export const CATEGORY_EMOJI_MAP = {
  'bep':         '🔥',
  'noi-chao':    '🍳',
  'noi-com-dien':'🍚',
  'may-hut-mui': '💨',
  'may-rua-bat': '🫧',
  'dao-cat':     '🔪',
  'lo-nuong':    '♨️',
  'do-dung':     '🥄',
  'phu-kien':    '🔧',
};

export const DEFAULT_EMOJI = '🏠';

// Kiểm tra một string có phải emoji/ký tự đặc biệt không (không phải URL)
const isEmojiIcon = (str) =>
  str && !str.startsWith('http') && !str.startsWith('/') && !str.startsWith('.');

export const getCategoryEmoji = (category) => {
  if (!category) return DEFAULT_EMOJI;

  // ① Ưu tiên: imageUrl chứa emoji được chọn trong admin
  if (isEmojiIcon(category.imageUrl)) return category.imageUrl;

  // ② Fallback: tìm theo từ khóa trong slug
  const slug = category.slug ?? category.categorySlug ?? '';
  const key  = Object.keys(CATEGORY_EMOJI_MAP).find(k => slug.includes(k));
  return key ? CATEGORY_EMOJI_MAP[key] : DEFAULT_EMOJI;
};