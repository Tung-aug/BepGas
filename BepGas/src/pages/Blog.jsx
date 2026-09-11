// Trang cẩm nang nhà bếp gồm danh sách bài viết và trang chi tiết từng bài.
// Cùng một component Blog xử lý cả hai màn hình: khi URL có slug thì hiện chi tiết, không thì hiện danh sách.
// Dữ liệu bài viết là nội dung tĩnh viết thẳng trong code, không cần gọi API.

// useParams lấy slug từ URL, ví dụ /blog/chon-mua-bep-gas → slug = 'chon-mua-bep-gas'.
// Link và ChevronRight dùng trong breadcrumb điều hướng.
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Clock, Tag, ArrowLeft, BookOpen } from 'lucide-react';

// ARTICLES là mảng chứa toàn bộ nội dung bài viết. Mỗi bài có slug để tạo URL SEO-friendly,
// tiêu đề, danh mục, thời gian đọc, ngày cập nhật, đoạn mở đầu và mảng sections là các phần nội dung.
// Nội dung sections dùng định dạng giống Markdown: **chữ** thành chữ đậm, • là đầu dòng.
const ARTICLES = [
  {
    slug: 'chon-mua-bep-gas',
    title: 'Hướng dẫn chọn mua bếp gas phù hợp gia đình',
    category: 'Tư vấn mua sắm',
    readTime: '5 phút',
    date: '15/05/2025',
    thumb: null,
    intro: 'Bếp gas là thiết bị không thể thiếu trong mỗi căn bếp. Lựa chọn đúng loại bếp gas giúp tiết kiệm gas, an toàn và bền bỉ hàng chục năm.',
    sections: [
      {
        heading: '1. Xác định nhu cầu sử dụng',
        body: `Trước khi chọn mua, cần xác định rõ:\n\n• **Gia đình mấy người?** Gia đình 2–4 người: bếp đơn hoặc đôi công suất vừa (3.0–3.5 kW). Gia đình đông người hoặc nấu nhiều: bếp đôi công suất cao (4.0–5.0 kW).\n\n• **Loại bình gas?** Bình 12 kg phổ thông dùng cho hầu hết bếp gas đơn/đôi. Nếu dùng gas âm tường (gas trung tâm) cần bếp hỗ trợ gas áp thấp.\n\n• **Không gian bếp?** Bếp âm countertop tiết kiệm diện tích, bếp dương thương hiệu thường bền hơn về khung.`,
      },
      {
        heading: '2. Bếp gas âm hay bếp gas dương?',
        body: `**Bếp gas âm (built-in):**\n• Gắn chìm vào mặt đá, gọn đẹp, dễ vệ sinh\n• Phù hợp tủ bếp hiện đại\n• Cần lỗ khoét chính xác, thay thế khó hơn\n\n**Bếp gas dương (freestanding):**\n• Đặt trực tiếp lên kệ bếp, dễ di chuyển\n• Giá thành thường rẻ hơn\n• Phù hợp bếp có diện tích hạn chế hoặc bếp thuê`,
      },
      {
        heading: '3. Các thương hiệu đáng tin cậy',
        body: `• **Supor, Midea:** Công nghệ tiết kiệm gas, bền bỉ, bảo hành 2–5 năm\n• **Rinnai, Paloma:** Nhật Bản, chất lượng cao, giá nhỉnh hơn\n• **Electrolux, Bosch:** Châu Âu, thiết kế sang, phù hợp bếp cao cấp\n• **Nagakawa, Sunhouse:** Giá tốt, phổ biến phân khúc tầm trung`,
      },
      {
        heading: '4. Những tính năng cần lưu ý',
        body: `• **Hệ thống tự động châm lửa:** Tiện lợi, không cần bật lửa thủ công\n• **Van chặn gas tự động (FFD):** Tự ngắt khi lửa tắt bất ngờ — quan trọng nhất về an toàn\n• **Mâm kiềng gang:** Bền, chịu nhiệt tốt hơn mâm thép inox\n• **Mặt kính cường lực:** Dễ lau chùi nhưng cần tránh va đập mạnh`,
      },
    ],
  },
  {
    slug: 've-sinh-bep-gas',
    title: 'Cách vệ sinh bếp gas đúng cách — Bền đẹp hàng chục năm',
    category: 'Bảo dưỡng',
    readTime: '4 phút',
    date: '22/05/2025',
    thumb: null,
    intro: 'Vệ sinh bếp gas đúng cách không chỉ giữ bếp sáng đẹp mà còn tăng hiệu quả đốt cháy, tiết kiệm gas và kéo dài tuổi thọ thiết bị.',
    sections: [
      {
        heading: 'Vệ sinh hàng ngày',
        body: `Sau mỗi lần nấu, lau sạch mặt bếp khi còn ấm:\n\n• Dùng khăn ẩm lau dầu mỡ, cặn thức ăn ngay khi chưa khô cứng\n• **Không dùng xơ thép hoặc chất tẩy mạnh** lên mặt kính hoặc inox — sẽ gây trầy xước\n• Với mặt kính: dùng nước rửa kính pha loãng hoặc hỗn hợp giấm + nước ấm`,
      },
      {
        heading: 'Vệ sinh mâm kiềng và đầu đốt',
        body: `Thực hiện mỗi tuần 1 lần:\n\n1. Tháo mâm kiềng và mũ đầu đốt ra khỏi bếp\n2. Ngâm trong nước pha nước rửa chén 15–20 phút\n3. Dùng bàn chải mềm chà sạch các khe, lỗ phun lửa\n4. Tráng sạch và **để khô hoàn toàn** trước khi lắp lại — đặc biệt quan trọng để tránh lửa tắt bất ngờ\n5. Dùng tăm hoặc kim khâu thông nhẹ các lỗ phun lửa nếu bị tắc`,
      },
      {
        heading: 'Vệ sinh van gas và ống dẫn',
        body: `Mỗi 3–6 tháng nên kiểm tra:\n\n• **Kiểm tra rò rỉ gas:** Bôi nước xà phòng lên mối nối ống gas và van. Nếu có bọt khí sủi lên → có rò, cần thay ngay\n• **Thay dây dẫn gas** (ống cao su) sau mỗi 2–3 năm, hoặc khi thấy nứt nẻ, cứng giòn\n• **Không tự sửa van gas** — gọi thợ chuyên nghiệp`,
      },
    ],
  },
  {
    slug: 'an-toan-bep-gas',
    title: 'Những lưu ý an toàn không thể bỏ qua khi dùng bếp gas',
    category: 'An toàn',
    readTime: '6 phút',
    date: '28/05/2025',
    thumb: null,
    intro: 'Gas là nguồn năng lượng tiện dụng nhưng tiềm ẩn nguy hiểm nếu sử dụng không đúng cách. Nắm rõ những nguyên tắc an toàn cơ bản để bảo vệ gia đình.',
    sections: [
      {
        heading: 'Khi lắp đặt',
        body: `• **Dùng dây dẫn gas chuyên dụng** (ống thép bọc cao su hoặc ống inox mềm) — không dùng ống nhựa thông thường\n• Bếp phải đặt ở nơi **thông thoáng**, tránh gần rèm vải, giấy, hoặc tủ gỗ dễ cháy\n• Khoảng cách từ mặt bếp đến mặt tủ phía trên **tối thiểu 70 cm**\n• Bình gas nên đặt **ngoài phòng bếp** hoặc trong tủ thông gió, tránh ánh nắng trực tiếp`,
      },
      {
        heading: 'Khi sử dụng hàng ngày',
        body: `• Không để lửa ở mức cao khi không cần thiết — tốn gas và nguy hiểm\n• **Không để nồi sôi tràn** làm tắt lửa — có thể gây rò gas vào không khí\n• Sau khi nấu xong: tắt van bình gas trước, để gas trong ống cháy hết, rồi tắt núm vặn bếp\n• **Không nấu ăn khi buồn ngủ** hoặc để trẻ em một mình gần bếp đang hoạt động`,
      },
      {
        heading: 'Xử lý khi ngửi thấy mùi gas',
        body: `**Không bật bất kỳ công tắc điện nào** (kể cả đèn, quạt).\n\n1. Khoá ngay van bình gas hoặc van tổng\n2. Mở hết cửa sổ, cửa chính để thông gió\n3. Ra khỏi nhà và **gọi cứu hỏa: 114** hoặc nhà cung cấp gas\n4. Chỉ vào nhà sau khi có chuyên viên kiểm tra và đảm bảo an toàn`,
      },
      {
        heading: 'Bình gas — lưu ý quan trọng',
        body: `• Chỉ mua gas tại các đại lý **có giấy phép chính thức** — tránh gas nhái, gas kém chất lượng\n• Kiểm tra tem niêm phong và van bình trước khi nhận hàng\n• Không lăn, ném hoặc đặt bình gas nằm ngang\n• Bình gas hết nên để ở nơi thoáng khí, không cất vào tủ kín`,
      },
    ],
  },
  {
    slug: 'tiet-kiem-gas',
    title: 'Mẹo tiết kiệm gas hiệu quả — Giảm 20–30% chi phí',
    category: 'Mẹo hay',
    readTime: '3 phút',
    date: '01/06/2025',
    thumb: null,
    intro: 'Áp dụng những thói quen nấu ăn đúng đắn có thể giúp bạn tiết kiệm đáng kể lượng gas tiêu thụ mỗi tháng mà không ảnh hưởng đến chất lượng bữa ăn.',
    sections: [
      {
        heading: 'Chọn lửa phù hợp',
        body: `• **Không bao giờ bật lửa to nhất** khi không cần — lãng phí gas, dễ cháy thức ăn\n• Nấu sôi: dùng lửa vừa đến to. Sau khi sôi: hạ xuống lửa nhỏ để giữ nhiệt\n• Dùng **lửa phù hợp đáy nồi** — lửa to hơn đáy nồi là lãng phí hoàn toàn`,
      },
      {
        heading: 'Chuẩn bị trước khi bật bếp',
        body: `• Chuẩn bị sẵn nguyên liệu, thái cắt xong trước khi bật bếp — không để lửa chờ người\n• Đậy nắp nồi khi đun sôi: giảm 25–30% thời gian và lượng gas\n• Dùng **nồi áp suất** cho món hầm, kho: nhanh hơn 60–70%, tiết kiệm gas đáng kể`,
      },
      {
        heading: 'Bảo dưỡng bếp đúng cách',
        body: `• **Lỗ phun lửa bị tắc** → lửa yếu, tốn gấp đôi gas → vệ sinh đầu đốt định kỳ\n• Kiểm tra gioăng cao su van bình gas — rò rỉ nhỏ tiêu hao gas liên tục\n• Dùng **nồi chảo phẳng đáy** khớp với vòng lửa để tận dụng nhiệt tối đa`,
      },
    ],
  },
];

// CATEGORY_COLORS ánh xạ tên danh mục sang màu sắc để hiện badge màu trên mỗi bài viết.
// Màu được dùng trực tiếp trong style inline: nền là màu với độ trong 18%, chữ là màu đầy đủ.
const CATEGORY_COLORS = {
  'Tư vấn mua sắm': '#3b82f6',
  'Bảo dưỡng':      '#10b981',
  'An toàn':        '#ef4444',
  'Mẹo hay':        '#f59e0b',
};

// ArticleCard hiển thị thẻ tóm tắt một bài viết trong trang danh sách.
// Khi click vào card sẽ điều hướng đến /blog/[slug] để xem chi tiết bài viết đó.
// Dùng icon BookOpen làm ảnh thumbnail vì ARTICLES không có ảnh thật.
const ArticleCard = ({ article }) => (
  <Link to={`/blog/${article.slug}`} className="blog-card">
    <div className="blog-card-img">
      <BookOpen size={40} color="var(--primary)" strokeWidth={1.5} />
    </div>
    <div className="blog-card-body">
      {/* Badge danh mục màu sắc riêng biệt để người đọc nhận ra chủ đề ngay từ danh sách. */}
      <span
        className="blog-tag"
        style={{ background: CATEGORY_COLORS[article.category] + '18', color: CATEGORY_COLORS[article.category] }}
      >
        <Tag size={11} /> {article.category}
      </span>
      <h2 className="blog-card-title">{article.title}</h2>
      <p className="blog-card-intro">{article.intro}</p>
      <div className="blog-card-meta">
        <span><Clock size={13} /> {article.readTime} đọc</span>
        <span>{article.date}</span>
      </div>
    </div>
  </Link>
);

// ArticleDetail hiển thị toàn bộ nội dung một bài viết khi người dùng click vào.
// Nội dung body của mỗi section được xử lý từng dòng: dòng trống thành <br>,
// **văn bản** thành <strong> bằng regex replace trước khi render HTML.
// dangerouslySetInnerHTML an toàn ở đây vì nội dung do lập trình viên viết, không phải user nhập.
const ArticleDetail = ({ article }) => (
  <div className="blog-article">
    {/* Nút quay lại danh sách bài viết, đặt ngay đầu trang để dễ tìm. */}
    <Link to="/blog" className="blog-back">
      <ArrowLeft size={16} /> Cẩm nang nhà bếp
    </Link>

    <div className="blog-article-header">
      <span
        className="blog-tag"
        style={{ background: CATEGORY_COLORS[article.category] + '18', color: CATEGORY_COLORS[article.category] }}
      >
        <Tag size={11} /> {article.category}
      </span>
      <h1 className="blog-article-title">{article.title}</h1>
      <div className="blog-article-meta">
        <span><Clock size={14} /> {article.readTime} đọc</span>
        <span>Cập nhật {article.date}</span>
      </div>
      {/* Đoạn mở đầu tóm tắt nội dung bài, hiện nổi bật phía trên phần nội dung chính. */}
      <p className="blog-article-intro">{article.intro}</p>
    </div>

    {/* Phần nội dung chính duyệt qua các sections, mỗi section có heading và body riêng. */}
    <div className="blog-article-body">
      {article.sections.map((sec, i) => (
        <div key={i} className="blog-section">
          <h2 className="blog-section-heading">{sec.heading}</h2>
          <div className="blog-section-body">
            {/* Xử lý từng dòng trong body: bỏ qua dòng trống (thành <br>),
                còn lại replace **chữ** thành <strong>chữ</strong> rồi render HTML. */}
            {sec.body.split('\n').map((line, j) => {
              if (!line.trim()) return <br key={j} />;
              const formatted = line
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
              return <p key={j} dangerouslySetInnerHTML={{ __html: formatted }} />;
            })}
          </div>
        </div>
      ))}
    </div>

    {/* Footer cuối bài gợi ý hành động tiếp theo: xem sản phẩm hoặc đọc bài viết khác. */}
    <div className="blog-article-footer">
      <p>Bạn cần tư vấn thêm?</p>
      <div className="blog-article-ctas">
        <Link to="/products" className="btn btn-primary">Xem sản phẩm</Link>
        <Link to="/blog" className="btn btn-outline">Bài viết khác</Link>
      </div>
    </div>
  </div>
);

// Blog là component chính xử lý cả hai chế độ: danh sách và chi tiết.
// useParams lấy slug từ URL — nếu có slug thì tìm bài viết tương ứng, nếu không thì hiện danh sách.
// Khi slug không khớp bài nào (người dùng gõ URL sai), article sẽ là undefined và hiện danh sách thay thế.
const Blog = () => {
  const { slug } = useParams();

  // Tìm bài viết theo slug, nếu không có slug hoặc không tìm thấy thì article = null.
  const article = slug ? ARTICLES.find(a => a.slug === slug) : null;

  return (
    <main className="blog-page">
      <div className="container">

        {/* Breadcrumb điều hướng thay đổi tuỳ theo đang ở danh sách hay bài viết cụ thể. */}
        <nav className="breadcrumb" aria-label="Điều hướng">
          <Link to="/">Trang chủ</Link>
          <ChevronRight size={14} />
          {article ? (
            <>
              <Link to="/blog">Cẩm nang nhà bếp</Link>
              <ChevronRight size={14} />
              <span>{article.title}</span>
            </>
          ) : (
            <span>Cẩm nang nhà bếp</span>
          )}
        </nav>

        {/* Chọn hiển thị chi tiết bài viết hoặc lưới danh sách tuỳ vào có article hay không. */}
        {article ? (
          <ArticleDetail article={article} />
        ) : (
          <>
            <div className="blog-hero">
              <h1 className="blog-hero-title">Cẩm nang nhà bếp</h1>
              <p className="blog-hero-sub">Kiến thức hữu ích về bếp gas, an toàn, bảo dưỡng và mẹo tiết kiệm</p>
            </div>
            {/* Lưới card hiển thị tất cả bài viết, mỗi card dùng slug làm key duy nhất. */}
            <div className="blog-grid">
              {ARTICLES.map(a => <ArticleCard key={a.slug} article={a} />)}
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default Blog;
