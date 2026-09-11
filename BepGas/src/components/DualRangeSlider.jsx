// Slider hai đầu để chọn khoảng giá — hỗ trợ cả chuột lẫn cảm ứng.
// onDrag gọi liên tục khi đang kéo để cập nhật UI tức thì.
// onChange chỉ gọi khi nhả tay để tránh gọi API/filter quá nhiều lần.
// Khoảng cách tối thiểu giữa hai đầu là 1.000đ để không bị chồng lên nhau.

import { useRef, useEffect, useState, useCallback } from 'react';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const DualRangeSlider = ({ min, max, valueMin, valueMax, onChange, onDrag }) => {
  const trackRef = useRef(null);
  // dragging dùng ref thay vì state để không trigger re-render khi bắt đầu/kết thúc kéo.
  const dragging = useRef(null);

  // localMin/Max là state để React re-render vị trí thumb.
  const [localMin, setLocalMin] = useState(valueMin);
  const [localMax, setLocalMax] = useState(valueMax);
  // localMinRef/MaxRef là bản sao ref của state, dùng trong closure onMove để tránh stale value.
  const localMinRef = useRef(valueMin);
  const localMaxRef = useRef(valueMax);

  // Đồng bộ từ props chỉ khi không đang kéo
  useEffect(() => {
    if (!dragging.current) {
      setLocalMin(valueMin);
      setLocalMax(valueMax);
      localMinRef.current = valueMin;
      localMaxRef.current = valueMax;
    }
  }, [valueMin, valueMax]);

  const toPercent = (v) => clamp(((v - min) / (max - min)) * 100, 0, 100);

  const getValueFromX = useCallback((clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const pct  = clamp((clientX - rect.left) / rect.width, 0, 1);
    // Làm tròn về nghìn đồng
    return Math.round((pct * (max - min) + min) / 1000) * 1000;
  }, [min, max]);

  const startDrag = (thumb) => (e) => {
    e.preventDefault();
    // eslint-disable-next-line react-hooks/refs
    dragging.current = thumb;

    const onMove = (ev) => {
      // Hỗ trợ cả touch event (mobile) lẫn mouse event (desktop).
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      // eslint-disable-next-line react-hooks/refs
      const val = getValueFromX(clientX);

      if (dragging.current === 'min') {
        // eslint-disable-next-line react-hooks/refs
        const newMin = clamp(val, min, localMaxRef.current - 1000);
        // eslint-disable-next-line react-hooks/refs
        localMinRef.current = newMin;
        setLocalMin(newMin);
        onDrag?.(newMin, localMaxRef.current);
      } else {
        const newMax = clamp(val, localMinRef.current + 1000, max);
        localMaxRef.current = newMax;
        setLocalMax(newMax);
        onDrag?.(localMinRef.current, newMax);
      }
    };

    const onUp = () => {
      // Chỉ gọi onChange khi nhả tay — không làm gián đoạn khi đang kéo
      onChange(localMinRef.current, localMaxRef.current);
      dragging.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onUp);
    };

    // Lắng nghe trên window để xử lý kéo ngay cả khi con trỏ ra ngoài vùng thumb.
    // touchmove cần passive: false để có thể gọi preventDefault() chặn scroll.
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend',  onUp);
  };

  // Click trên track — di chuyển thumb gần nhất đến vị trí click
  const handleTrackClick = (e) => {
    if (dragging.current) return; // đang kéo thì bỏ qua
    const val = getValueFromX(e.clientX);
    const distMin = Math.abs(val - localMinRef.current);
    const distMax = Math.abs(val - localMaxRef.current);
    if (distMin <= distMax) {
      const newMin = clamp(val, min, localMaxRef.current - 1000);
      localMinRef.current = newMin;
      setLocalMin(newMin);
      onDrag?.(newMin, localMaxRef.current);
      onChange(newMin, localMaxRef.current);
    } else {
      const newMax = clamp(val, localMinRef.current + 1000, max);
      localMaxRef.current = newMax;
      setLocalMax(newMax);
      onDrag?.(localMinRef.current, newMax);
      onChange(localMinRef.current, newMax);
    }
  };

  const leftPct  = toPercent(localMin);
  const rightPct = toPercent(localMax);

  return (
    <div className="drs-wrap">
      <div className="drs-track" ref={trackRef} onClick={handleTrackClick}>
        <div className="drs-fill" style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }} />

        <div className="drs-thumb" style={{ left: `${leftPct}%` }}
          onMouseDown={startDrag('min')} onTouchStart={startDrag('min')}
          onClick={e => e.stopPropagation()}>
          <div className="drs-thumb-inner" />
        </div>

        <div className="drs-thumb" style={{ left: `${rightPct}%` }}
          onMouseDown={startDrag('max')} onTouchStart={startDrag('max')}
          onClick={e => e.stopPropagation()}>
          <div className="drs-thumb-inner" />
        </div>
      </div>
    </div>
  );
};

export default DualRangeSlider;