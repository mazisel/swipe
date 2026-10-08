const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;
export const seedProducts = [
  { id: 'soft-knit', sellerId: 'studio-m', shop: 'Studio M', title: 'Biraz yavaş, biraz yumuşak.', description: 'Serin sabahlara, uzun kahvelere. Rahat kesimli, yumuşak dokulu ekru triko.\n\n%60 pamuk, %40 akrilik. 30°C hassas yıkama önerilir. Bu ürün ilk sürümü denemek için hazırlanmış bir örnektir.', price: 129900, category: 'Giyim', media: photo('photo-1434389677669-e08b4cac3105'), mediaType: 'image', poster: '', sizes: ['XS', 'S', 'M', 'L'], stock: 24, color: 'Ekru' },
  { id: 'everyday-bag', sellerId: 'form-atelier', shop: 'Form Atelier', title: 'Her güne bir eşlikçi.', description: 'Günlük omuz çantası. Ayarlanabilir askı, iç cep ve zamansız bir form.\n\nÖlçü: 24 × 18 × 8 cm. Suni deri. Örnek katalog ürünü.', price: 189000, category: 'Çanta', media: photo('photo-1548036328-c9fa89d128fa'), mediaType: 'image', poster: '', sizes: ['Standart'], stock: 12, color: 'Karamel' },
  { id: 'court-sneaker', sellerId: 'daily-objects', shop: 'Daily Objects', title: 'Günün ritmini yakala.', description: 'Hafif tabanlı, günlük sneaker. Şehirde, yolda, hareket halinde.\n\nVideo, oynatımı göstermek için kullanılan örnek bir yaşam tarzı çekimidir. Örnek katalog ürünü.', price: 249900, category: 'Ayakkabı', media: photo('photo-1542291026-7eec264c27ff'), mediaType: 'image', poster: '', sizes: ['37', '38', '39', '40', '41', '42'], stock: 18, color: 'Kırmızı' },
  { id: 'gold-detail', sellerId: 'form-atelier', shop: 'Form Atelier', title: 'Küçük bir detay, bütün gün.', description: 'Günlük kullanıma uygun altın renkli takı. Sade kombinlerin küçük tamamlayıcısı.\n\nKaplama yüzeyi parfüm ve sudan koruyun. Örnek katalog ürünü.', price: 64900, category: 'Aksesuar', media: photo('photo-1611652022419-a9419f74343d'), mediaType: 'image', poster: '', sizes: ['Standart'], stock: 30, color: 'Altın' },
  { id: 'slow-sound', sellerId: 'daily-objects', shop: 'Daily Objects', title: 'Kendi dünyana bir mola.', description: 'Kulak üstü kablosuz kulaklık. Rahat yastıklar, sade tasarım.\n\nÖrnek katalog ürünü; marka veya gerçek teknik özellik iddiası içermez.', price: 329900, category: 'Yaşam', media: photo('photo-1505740420928-5e560c06d30e'), mediaType: 'image', poster: '', sizes: ['Standart'], stock: 8, color: 'Siyah' },
];

// Demo detail frames are crops of the same photo, not claimed alternate angles.
const imageGallery = url => [
  { url, type: 'image' },
  { url: `${url}&rect=120,120,800,1000`, type: 'image' },
];
for (const product of seedProducts) product.gallery = product.mediaType === 'video'
  ? [{ url: product.media, type: 'video', poster: product.poster }, { url: product.poster, type: 'image' }]
  : imageGallery(product.media);
const extra = [
  ['linen-shirt', 'studio-m', 'Studio M', 'Hafif bir gün.', 'Giyim', 'photo-1598033129183-c4f50c736f10', 159900, 'Beyaz'],
  ['denim-days', 'studio-m', 'Studio M', 'Denimin en rahat hali.', 'Giyim', 'photo-1542272604-787c3835535d', 219900, 'Mavi'],
  ['quiet-tee', 'studio-m', 'Studio M', 'Her şeyin başlangıcı.', 'Giyim', 'photo-1521572163474-6864f9cf17ab', 79900, 'Beyaz'],
  ['weekend-jacket', 'north-studio', 'North Studio', 'Şehre bir katman daha.', 'Giyim', 'photo-1551028719-00167b16eac5', 399900, 'Siyah'],
  ['city-sneaker', 'north-studio', 'North Studio', 'Adımların hafiflesin.', 'Ayakkabı', 'photo-1549298916-b41d501d3772', 279900, 'Toprak'],
  ['soft-step', 'north-studio', 'North Studio', 'Yeni yollar, aynı rahatlık.', 'Ayakkabı', 'photo-1600185365926-3a2ce3cdb9eb', 289900, 'Krem'],
  ['weekend-pack', 'form-atelier', 'Form Atelier', 'Hafta sonunu yanına al.', 'Çanta', 'photo-1553062407-98eeb64c6a62', 169900, 'Gri'],
  ['little-watch', 'form-atelier', 'Form Atelier', 'Zaman biraz yavaşlasın.', 'Aksesuar', 'photo-1524805444758-089113d48a6d', 189900, 'Gümüş'],
  ['sun-day', 'form-atelier', 'Form Atelier', 'Güneşe küçük bir selam.', 'Aksesuar', 'photo-1511499767150-a48a237f0083', 99900, 'Siyah'],
  ['morning-cup', 'slow-home', 'Slow Home', 'Sabahın en güzel molası.', 'Yaşam', 'photo-1514228742587-6b1558fcca3d', 44900, 'Beyaz'],
  ['little-light', 'slow-home', 'Slow Home', 'Akşamın sıcak köşesi.', 'Yaşam', 'photo-1507473885765-e6ed057f782c', 149900, 'Krem'],
  ['green-corner', 'slow-home', 'Slow Home', 'Bir köşe, biraz yeşil.', 'Yaşam', 'photo-1485955900006-10f4d324d411', 59900, 'Yeşil'],
  ['sound-on', 'daily-objects', 'Daily Objects', 'Bir şarkı daha.', 'Yaşam', 'photo-1484704849700-f032a568e944', 229900, 'Siyah'],
  ['coffee-moment', 'slow-home', 'Slow Home', 'Kahveye zaman ayır.', 'Yaşam', 'photo-1509042239860-f550ce710b93', 54900, 'Toprak'],
  ['sand-time', 'daily-objects', 'Daily Objects', 'Beş dakika kendine.', 'Yaşam', 'photo-1501139083538-0139583c060f', 74900, 'Doğal'],
];
for (const [id, sellerId, shop, title, category, image, price, color] of extra) {
  const media = photo(image);
  seedProducts.push({ id, sellerId, shop, title, description: 'Swipe deneyimini denemek için hazırlanmış örnek katalog ürünü. Görseller temsilidir; detay kareleri aynı fotoğrafın yakın planlarıdır.', price, category, media, mediaType: 'image', poster: '', gallery: imageGallery(media), sizes: category === 'Giyim' ? ['S', 'M', 'L'] : category === 'Ayakkabı' ? ['37', '38', '39', '40', '41', '42'] : ['Standart'], stock: 15, color });
}
const videos = [
  ['sun-day', '/demo-media/style.mp4', 'https://res.cloudinary.com/hackit-africa/video/upload/so_0/v1745525294/shoppable-video/shoppable_demo.jpg'],
  ['coffee-moment', '/demo-media/coffee.mp4', 'https://res.cloudinary.com/jlengstorf/video/upload/so_0/mediajams/disappointed-coffee.jpg'],
  ['sand-time', '/demo-media/hourglass.mp4', 'https://res.cloudinary.com/demo/video/upload/so_0/hourglass_timer.jpg'],
];
for (const [id, url, poster] of videos) {
  const product = seedProducts.find(item => item.id === id);
  const photoUrl = product.poster || product.media;
  Object.assign(product, { media: url, mediaType: 'video', poster, gallery: [{ url, type: 'video', poster }, { url: photoUrl, type: 'image' }] });
  product.description += '\n\nVideo, oynatımı denemek için kullanılan temsili demo çekimidir; gerçek ürün tanıtımı değildir.';
}
