// Banner cuộn ngang với vòng lặp vô hạn (infinite loop) và tự động chuyển mỗi 4.5 giây.
// Kỹ thuật infinite loop: nhân bản perView phần tử đầu vào cuối và perView phần tử cuối vào đầu.
// Khi cuộn đến vùng clone, nhảy tức thì (không animation) về vị trí thật tương ứng để tạo ảo giác loop.

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// GAP phải khớp với CSS gap trên .sbs-track để tính toán chiều rộng item chính xác.
const GAP = 12;

const ScrollBannerRow = ({ banners }) => {
  const N = banners.length;

  // perView là số banner hiển thị cùng lúc — 2 trên tablet/desktop, 1 trên mobile.
  const getPerView = () => (typeof window !== 'undefined' && window.innerWidth >= 768 ? 2 : 1);
  const [perView, setPerView] = useState(getPerView);
  // dotIdx theo dõi dot indicator nào đang active để người dùng biết đang ở vị trí nào.
  const [dotIdx, setDotIdx] = useState(0);

  const trackRef = useRef(null);
  const timerRef = useRef(null);
  // posRef lưu vị trí track hiện tại dưới dạng index (không phải pixel) để tính nhảy loop.
  const posRef = useRef(0);
  // isTransitioningRef chặn click trong khi animation đang chạy để tránh lệch track.
  const isTransitioningRef = useRef(false);

  // Chỉ loop khi số banner nhiều hơn số slot hiển thị cùng lúc.
  const canLoop = N > perView;
  const showCount = Math.min(N, perView);

  const items = useMemo(() => {
    if (!canLoop) return banners;
    // Nối thêm perView phần tử cuối vào đầu và perView phần tử đầu vào cuối để tạo vùng clone.
    // Ví dụ N=4, perView=2: items = [3,4, 1,2,3,4, 1,2] — index thật bắt đầu từ vị trí perView.
    return [
      ...banners.slice(-perView),
      ...banners,
      ...banners.slice(0, perView),
    ];
  }, [banners, perView, canLoop]);

  const itemStyle = {
    flex: `0 0 calc(${100 / showCount}% - ${(showCount - 1) * GAP / showCount}px)`,
  };

  const itemW = () => trackRef.current?.children[0]?.offsetWidth ?? 0;

  const setTranslate = (pos, animate = true) => {
    const el = trackRef.current;
    if (!el) return;

    const px = pos * (itemW() + GAP);

    if (!animate) {
      // Tắt transition rồi bật lại ngay sau khi gán transform để nhảy tức thì không tạo animation.
      // void el.offsetWidth buộc trình duyệt tính toán lại layout (force reflow) trước khi bật lại transition.
      el.style.transition = 'none';
      el.style.transform = `translateX(-${px}px)`;
      void el.offsetWidth;
      el.style.transition = '';
    } else {
      el.style.transition = 'transform 0.4s ease-out';
      el.style.transform = `translateX(-${px}px)`;
      isTransitioningRef.current = true;
    }

    posRef.current = pos;

    if (canLoop) {
      // Tính vị trí thật trong mảng gốc từ vị trí logic (đã dịch qua vùng clone).
      const real = ((pos - perView) % N + N) % N;
      const maxDotIdx = N - perView;
      setDotIdx(Math.max(0, Math.min(real, maxDotIdx)));
    }
  };

  const onTransitionEnd = (e) => {
    if (e.target !== trackRef.current) return;
    isTransitioningRef.current = false;

    if (!canLoop) return;

    // Khi đến cuối vùng clone thì nhảy ngược về vị trí thật tương ứng để tiếp tục loop.
    const pos = posRef.current;
    if (pos >= N + perView) setTranslate(pos - N, false);
    else if (pos < perView) setTranslate(pos + N, false);
  };

  const startAutoPlay = () => {
    if (!canLoop) return;
    // clearInterval trước khi tạo timer mới để tránh nhiều timer chạy song song sau mỗi click.
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      slideTo(posRef.current + 1);
    }, 4500);
  };

  const slideTo = (pos) => {
    if (isTransitioningRef.current && canLoop) return;
    setTranslate(pos, true);
    // Reset auto-play timer sau mỗi lần người dùng click để không chuyển quá nhanh.
    startAutoPlay();
  };

  useEffect(() => {
    const startPos = canLoop ? perView : 0;
    posRef.current = startPos;
    // setTimeout 50ms đảm bảo DOM đã render xong và itemW() trả về kích thước chính xác.
    const timer = setTimeout(() => {
      setTranslate(startPos, false);
    }, 50);
    return () => clearTimeout(timer);
  }, [perView, canLoop]);

  useEffect(() => {
    if (canLoop) startAutoPlay();
    return () => clearInterval(timerRef.current);
  }, [banners, perView, canLoop]);

  useEffect(() => {
    const onResize = () => {
      const nextPerView = getPerView();
      setPerView(nextPerView);
      // Giữ nguyên banner đang hiện sau khi resize bằng cách tính lại vị trí từ index thật.
      const currentRealIdx = ((posRef.current - perView) % N + N) % N;
      const nextPos = nextPerView + currentRealIdx;
      requestAnimationFrame(() => {
        setTranslate(nextPos, false);
      });
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [perView, N]);

  if (!N) return null;

  const maxDot = N - perView;

  return (
    <section className="scroll-banner-section">
      <div className="container">
        <div className="sbs-wrapper">
          <div className="sbs-viewport" style={{ overflow: 'hidden' }}>
            <div className="sbs-track" ref={trackRef} onTransitionEnd={onTransitionEnd} style={{ display: 'flex', gap: `${GAP}px` }}>
              {items.map((b, i) => (
                <div key={i} className="sbs-item" style={itemStyle}>
                  <a href={b.linkUrl || '#'} className="sbs-link" onClick={(e) => !b.linkUrl && e.preventDefault()}>
                    <img src={b.imageUrl} alt={b.bannerTitle || 'Banner khuyến mãi BếpGasVN'} />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {canLoop && (
            <>
              <button className="sbs-arrow sbs-prev" onClick={() => slideTo(posRef.current - 1)}>
                <ChevronLeft size={20} />
              </button>
              <button className="sbs-arrow sbs-next" onClick={() => slideTo(posRef.current + 1)}>
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {canLoop && maxDot > 0 && (
          <div className="sbs-dots">
            {Array.from({ length: maxDot + 1 }).map((_, i) => (
              <button
                key={i}
                className={`sbs-dot ${i === dotIdx ? 'active' : ''}`}
                onClick={() => slideTo(perView + i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ScrollBannerRow;