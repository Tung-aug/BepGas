// Kho icon SVG dùng cho danh mục sản phẩm trong mega menu và trang quản trị.
// Admin chọn icon qua picker, tên icon được lưu vào database dưới dạng chuỗi (ví dụ "FaFire").
// Khi render, ICON_REGISTRY tra cứu tên chuỗi đó để lấy React component tương ứng.
import { FaFire, FaBlender, FaCoffee, FaUtensils, FaWrench, FaShoppingCart, FaHome, FaBoxOpen, FaStar } from 'react-icons/fa';
import { GiCookingPot, GiKnifeFork, GiFrenchFries, GiTeapot, GiSteam, GiElectric, GiFurnace, GiWok, GiMeal } from 'react-icons/gi';
import { MdMicrowave, MdOutdoorGrill, MdKitchen, MdBlender, MdRiceBowl } from 'react-icons/md';
import { TbToolsKitchen, TbToolsKitchen2, TbSoup, TbTeapot } from 'react-icons/tb';
import { BiDish } from 'react-icons/bi';
import { LuCookingPot, LuUtensilsCrossed } from 'react-icons/lu';

// Map tên icon (chuỗi từ DB) sang React component tương ứng.
export const ICON_REGISTRY = {
  /* Font Awesome */
  FaFire,
  FaBlender,
  FaCoffee,
  FaUtensils,
  FaWrench,
  FaShoppingCart,
  FaHome,
  FaBoxOpen,
  FaStar,

  /* Game Icons */
  GiCookingPot,
  GiKnifeFork,
  GiFrenchFries,
  GiTeapot,
  GiSteam,
  GiElectric,
  GiFurnace,
  GiWok,
  GiMeal,

  /* Material Design */
  MdMicrowave,
  MdOutdoorGrill,
  MdKitchen,
  MdBlender,
  MdRiceBowl,

  /* Tabler Icons */
  TbToolsKitchen,
  TbToolsKitchen2,
  TbSoup,
  TbTeapot,

  /* Bootstrap / Lucide */
  BiDish,
  LuCookingPot,
  LuUtensilsCrossed,
};

// Danh sách hiển thị trong icon picker của trang AdminCategories — có nhãn tiếng Việt để dễ chọn.
export const CATEGORY_ICONS = [
  { name: 'FaFire',           label: 'Lửa' },
  { name: 'GiCookingPot',     label: 'Nồi nấu' },
  { name: 'GiWok',            label: 'Chảo wok' },
  { name: 'FaUtensils',       label: 'Dụng cụ' },
  { name: 'GiKnifeFork',      label: 'Dao nĩa' },
  { name: 'LuUtensilsCrossed',label: 'Đũa muỗng' },
  { name: 'FaBlender',        label: 'Máy xay' },
  { name: 'MdBlender',        label: 'Máy sinh tố' },
  { name: 'MdMicrowave',      label: 'Lò vi sóng' },
  { name: 'GiFurnace',        label: 'Lò nướng' },
  { name: 'MdOutdoorGrill',   label: 'Vỉ nướng' },
  { name: 'MdRiceBowl',       label: 'Nồi cơm' },
  { name: 'TbSoup',           label: 'Canh súp' },
  { name: 'LuCookingPot',     label: 'Nồi' },
  { name: 'TbTeapot',         label: 'Ấm đun' },
  { name: 'GiTeapot',         label: 'Ấm trà' },
  { name: 'FaCoffee',         label: 'Cà phê' },
  { name: 'GiFrenchFries',    label: 'Chiên' },
  { name: 'GiMeal',           label: 'Bữa ăn' },
  { name: 'BiDish',           label: 'Đĩa' },
  { name: 'GiSteam',          label: 'Hơi nước' },
  { name: 'GiElectric',       label: 'Điện' },
  { name: 'MdKitchen',        label: 'Nhà bếp' },
  { name: 'TbToolsKitchen',   label: 'Dụng cụ bếp' },
  { name: 'TbToolsKitchen2',  label: 'Đồ bếp' },
  { name: 'FaWrench',         label: 'Công cụ' },
  { name: 'FaShoppingCart',   label: 'Giỏ hàng' },
  { name: 'FaHome',           label: 'Nhà' },
  { name: 'FaBoxOpen',        label: 'Hộp' },
  { name: 'FaStar',           label: 'Nổi bật' },
];

// Kiểm tra xem một chuỗi có phải tên icon trong registry không.
export const isIconName = (str) =>
  typeof str === 'string' && str in ICON_REGISTRY;

// Render icon cho danh mục theo thứ tự ưu tiên:
//   1. Nếu imageUrl là tên icon trong registry → trả về JSX component
//   2. Nếu imageUrl là emoji (không phải URL) → trả về chuỗi emoji
//   3. Trả về null để caller dùng getCategoryEmoji làm fallback
export const renderCategoryIcon = (category, iconProps = {}) => {
  if (!category) return '🏠';

  const raw = category.imageUrl;

  // 1) Tên icon SVG
  if (isIconName(raw)) {
    const Comp = ICON_REGISTRY[raw];
    return <Comp {...iconProps} />;
  }

  // 2) URL ảnh upload — render thẻ <img> thay vì dùng fallback emoji
  if (raw && (raw.startsWith('http') || raw.startsWith('/'))) {
    return <img src={raw} alt="" style={{ width: iconProps.size ?? 22, height: iconProps.size ?? 22, objectFit: 'contain', borderRadius: 3 }}/>;
  }

  // 3) Emoji (không phải URL, không phải icon name)
  if (raw) {
    return raw; // trả về string emoji, caller wrap trong <span>
  }

  // 4) Fallback: slug-based emoji map (import từ emojis.js)
  return null; // caller sẽ dùng getCategoryEmoji làm fallback
};