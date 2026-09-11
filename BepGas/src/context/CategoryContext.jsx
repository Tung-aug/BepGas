// Context cung cấp danh sách danh mục cho toàn bộ ứng dụng — Header, Footer, trang sản phẩm.
// Fetch một lần khi app khởi động, có thể refresh thủ công qua refreshCategories().

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { categoryAPI } from '../services/api';

const CategoryContext = createContext();

// Chuẩn hóa field name để tương thích cả camelCase (Spring Jackson mặc định) lẫn snake_case.
const normalize = (c) => ({
  ...c,
  categoryId:       c.categoryId       ?? c.category_id       ?? c.id,
  categoryName:     c.categoryName     ?? c.category_name     ?? c.name ?? '',
  parentCategoryId: c.parentCategoryId ?? c.parent_category_id ?? null,
  isActive:         c.isActive         ?? c.is_active          ?? c.active ?? true,
  sortOrder:        c.sortOrder        ?? c.sort_order         ?? 0,
  slug:             c.slug             ?? '',
  imageUrl:         c.imageUrl         ?? c.image_url          ?? '',
});

export const CategoryProvider = ({ children }) => {
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);

  const fetchCategories = useCallback(() => {
    setLoading(true);
    categoryAPI.getAll()
      .then(res => setCategories((res?.data ?? res ?? []).map(normalize)))
      .catch(err => console.error('[CategoryContext]', err))
      .finally(() => setLoading(false));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  /* Danh mục gốc: không có parentCategoryId, đã active, theo sortOrder */
  const rootCategories = useMemo(
    () => categories
      .filter(c => !c.parentCategoryId && (c.isActive ?? c.active ?? true))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories]
  );

  /* Map: "parentId" → [danh mục con active, đã sort] */
  const childMap = useMemo(() => {
    const map = {};
    categories.forEach(c => {
      if (!c.parentCategoryId) return;
      const pid = String(c.parentCategoryId);
      if (!map[pid]) map[pid] = [];
      if (c.isActive ?? c.active ?? true) map[pid].push(c);
    });
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    );
    return map;
  }, [categories]);

  const getChildren = useCallback(
    (parentId) => childMap[String(parentId)] ?? [],
    [childMap]
  );

  const hasChildren = useCallback(
    (parentId) => (childMap[String(parentId)]?.length ?? 0) > 0,
    [childMap]
  );

  // getAllCategoryIds dùng BFS để lấy ID của danh mục và tất cả con ở mọi cấp.
  // Truyền vào trang sản phẩm để filter sản phẩm thuộc cả danh mục cha lẫn danh mục con.
  const getAllCategoryIds = useCallback(
    (categoryId) => {
      const result = [];
      const queue  = [String(categoryId)];
      while (queue.length) {
        const id = queue.shift();
        result.push(id);
        const kids = childMap[id] ?? [];
        kids.forEach(c => queue.push(String(c.categoryId ?? c.id)));
      }
      return result;
    },
    [childMap]
  );

  return (
    <CategoryContext.Provider value={{
      categories, loading,
      rootCategories, childMap,
      getChildren, hasChildren, getAllCategoryIds,
      refreshCategories: fetchCategories,
    }}>
      {children}
    </CategoryContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCategories = () => useContext(CategoryContext);