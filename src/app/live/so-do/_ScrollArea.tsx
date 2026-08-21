"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Vùng cuộn ngang chỉ hiện dòng nhắc vuốt khi thật sự cuộn được.
 *
 * Trên điện thoại sơ đồ luôn rộng hơn màn hình nên cần nhắc; trên iPad nằm
 * ngang thì vừa trọn, mà vẫn nhắc "vuốt ngang" là nói sai và làm người xem đi
 * tìm thứ không có. Không dùng breakpoint được: bề rộng sơ đồ tính bằng rem nên
 * co giãn theo cỡ chữ người dùng chọn, còn breakpoint thì tính bằng px.
 *
 * Mặc định coi như cuộn được, để HTML từ server đã đúng cho phần lớn máy và
 * không lệch hydrate; ResizeObserver tắt dòng nhắc đi khi đo thấy vừa.
 */
export function ScrollArea({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint: React.ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(true);

  useEffect(() => {
    const el = viewport.current;
    const content = el?.firstElementChild;
    if (!el || !content) return;

    // Đo trong callback của observer, không gọi thẳng trong thân effect.
    // Theo dõi cả khung lẫn ruột: đổi cỡ chữ làm ruột rộng ra trong khi khung
    // giữ nguyên, nếu chỉ theo dõi khung thì không hay biết.
    const ro = new ResizeObserver(() =>
      setScrollable(el.scrollWidth > el.clientWidth + 1),
    );
    ro.observe(el);
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <div
        ref={viewport}
        className="overflow-x-auto [scroll-snap-type:x_proximity]"
      >
        {children}
      </div>
      {scrollable && hint}
    </>
  );
}
