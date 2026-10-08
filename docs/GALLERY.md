# Çoklu medya

Ürün başına 1–6 fotoğraf/video desteklenir. Studio yükleme sırasını değiştirme, kapak seçme ve yayımlamadan önce medya kaldırma sağlar. İlk medya kapaktır. Her dosya en fazla 50 MB; tüm dosyaların satıcıya ait olduğu API tarafından doğrulanır. Tek medya kullanan eski ürünler desteklenmeye devam eder.

Tam ekran keşfette sağdaki %35 alana dokunmak sonraki, soldaki %35 alana dokunmak önceki medyayı açar. Ortaya dokunma videoyu duraklatır. Galeri uçlarında döngü yoktur. Yatay sürükleme kaydet/çanta, dikey sürükleme ürün geçişi olarak kalır. İnce çizgiler ve sayaç geçerli medyayı gösterir. Ürün detay panelinin arka planı kapak medyasını kullanır.

Seçilen medyaya ek olarak galerinin sonraki medyası ve sıradaki ürünün kapağı duraklatılmış şekilde hazırlanabilir. Yalnızca görünür ve oynayan medya görüntüleme süresi kazanır. Medya geçişi ürünü hızlı geçme olarak işlenmez. AI analizi şu aşamada kapak medyasını analiz eder.

## Demo katalog

20 ürün, 5 mağaza ve 3 video kapak bulunur. Fotoğraf galerilerinin ikinci kareleri aynı fotoğrafın kırpımlarıdır; gerçek farklı açılar değildir. Videolar temsilî oynatım örnekleridir. Demo videolar küçük yerel MP4 dosyalarından servis edilir; fotoğraflar internet bağlantısı gerektirir. Seed güncellemesi mevcut ürün kimliklerini, stok ve ilişkileri korur.

## 7 Ekim 2026 doğrulaması

- 45 test geçti: galeri sınırları, eski ürün uyumu, medya sahipliği, yinelenen ve fazla medya reddi, kapak/sıra kalıcılığı dahil.
- Lint, TypeScript ve web/iOS/Android Expo export başarılı.
- Web ve iPhone 18 Pro simülatöründe dokunarak ikinci fotoğrafa geçiş doğrulandı.
- Web video oynatımı ve tam ekran boyutu doğrulandı.
- Android cihaz testi yapılmadı.

UI araştırması: Lazyweb üzerinden Etsy ürün galerisi örnekleri: https://www.lazyweb.com/company/etsy
