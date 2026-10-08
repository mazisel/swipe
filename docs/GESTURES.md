# Akışta kaydırma

- Sol: kaydet. Sağ: çantaya ekle. Dikey hareket ürün akışını sürdürür. Tam ekran içerik yatayda parmağı izleyip hafifçe döner; eşik aşılınca işlem tamamlanır ve sıradaki ürüne geçilir. Eşik altında bırakınca yay hareketiyle yerine döner.
- Tek beden/seçenek doğrudan eklenir. Birden fazla seçenek varsa aynı ürünün üzerinde glass beden paneli açılır; seçilmeden çanta veya öneri sinyali değişmez. Panel kapatılırsa aynı üründe kalınır; seçim tamamlanınca içerik yana çıkar. Mevcut ikonla yapılan çantaya ekleme ise önceki gibi aynı üründe kalır.
- Tekrarlı sol hareket kaydı kaldırmaz. Ürün herhangi bir bedeniyle çantadaysa sağ hareket adet artırmaz. Mevcut ürün detayı/çanta ekranı beden ve adet yönetimini korur.
- 14 pt yatay niyet, en az 1,65 yatay/dikey oran ve ekran genişliğine göre 72–112 pt tamamlama eşiği uygulanır. Kenardaki 16 pt sistem hareketlerine bırakılır. Dikey başlayan hareket sonradan alışveriş işlemine dönüşmez; çoklu dokunuş ve iptal işlemi tamamlamaz.
- React Native responder devralırken mesafeyi sıfırladığı için devralmadan önceki hareket de toplam mesafeye katılır. Hızlı tek hareketli kaydırmalar iOS simülatöründe doğrulandı.
- Hareket sırasında “Kaydet / Çantaya ekle” yazıları küçük ikonlu, düz glass kapsüller içinde görünür. Kapsül ekranın üst orta bölümünde sabit kalır; içerikle birlikte dönmez. Tamamlanınca desteklenen cihazda hafif dokunsal geri bildirim bulunur. Kaydet ve Çantaya düğmeleri erişilebilir alternatiflerdir. Yatay sürükleme videoyu yanlışlıkla duraklatmaz.
- Yeni işlemin 8 saniyelik geri alma süresi vardır. Geri alma yalnızca o işlemin oluşturduğu, sonradan değiştirilmemiş kaydı etkiler. Mükerrer kaydırma mevcut geri alma süresini yenilemez veya kaldırmaz.
- Kaydet/çanta öneri sinyali bu sürenin sonunda gönderilir; geri alınan işlem sinyal oluşturmaz. Bekleyen sinyal eski kimlik/nesil ile bağlıdır, giriş/çıkış veya keşfet sıfırlama sonrası gönderilmez.

Tam ekran Reels yerleşimi ve glass alt menü korunur. Ayrı kart çerçevesi, kenar boşluğu veya büyük yuvarlak işlem düğmeleri yoktur. Sıradaki ürünün yalnızca görsel önizlemesi hareket altında görünür; bu önizleme izlenme olayı üretmez. Hareketi azalt sistem tercihi açıksa dönüş ve çıkış animasyonu kaldırılır.

## Öğretici

İlk ekranı kesmez. Dikey kaydırma veya tamamlanan yatay işlemle üç gerçek ürün geçişinden sonra 650 ms bekleyip küçük bir glass panel gösterir. Katalog güncellemeleri, ürün gizleme, yeni akış oturumu ve aynı ürünün yeniden görünürlük bildirimi geçiş sayılmaz. Uygulama arka plandaysa, beden/seçenek paneli veya işlem bildirimi açıksa gösterim bekler. Öğretici açıkken medya izleme süresi işlemez.

“Anladım, keşfe devam”, kapatma veya öğreticiyi gördükten sonraki yatay işlem, `swipe-horizontal-lesson-v1` cihaz tercihine kaydedilir. Sonraki açılışlarda yeniden gösterilmez. Bu tercih keşfet ilgi profilinden ayrıdır.

## Doğrulama — 6 Ekim 2026

- `npm run typecheck`, `npm run lint`, 38 test başarılı.
- iOS, Android ve web Expo export başarılı.
- Web: sağ/sol, beden seçimi, geri alma, aynı ürüne tekrar kaydırma, videonun duraklamaması, üçüncü geçişte öğretici ve kapatma tercihinin yeniden açılışta korunması.
- iPhone 18 Pro / iOS 27 simülatörü: hızlı sol/sağ hareket, tek seçenekli ürünün doğrudan eklenmesi, geri alma, yatay işlemden sonra dikey akış ve gecikmeli native glass öğretici.
- Android cihaz etkileşimi ve fiziksel haptik henüz doğrulanmadı.

Ekranlar: [Web öğretici](screenshots/swipe-tutorial.png), [iOS öğretici](screenshots/swipe-tutorial-ios.png), [beden seçimi](screenshots/swipe-size-picker.png).

Lazyweb public araması üzerinden [AliExpress ürün ekleme akışı](https://www.lazyweb.com/flow/aliexpress/add-item-to-cart) beden seçimini tamamlayıp ekleme için referans olarak kullanıldı. Üçüncü geçişte öğretici gösterme ve yatay hareket eşikleri Swipe'ın ürün kararıdır; referansların ölçülmüş dönüşüm iddiası değildir. Lazyweb MCP bağlı olmadığı için Agentic Search kaydı oluşturulmadı.

## Tam ekran hareket revizyonu — 7 Ekim 2026

Web: tam ekran yerleşim, beden panelini iptal edince aynı üründe kalma, beden seçimiyle tek ürün ilerleme ve geri alma doğrulandı. iPhone 18 Pro simülatöründe sola kaydetme ve sağa ekleme sonrası sıradaki tam ekran ürüne geçiş ile geri alma doğrulandı. 38 test, lint, typecheck ve üç platform export başarılı. Android etkileşimleri fiziksel cihazda doğrulanmadı.

Lazyweb [Tinder ekranları](https://www.lazyweb.com/company/tinder) hareket mantığı için incelendi. Swipe yalnızca doğrudan sürükleme/dönüş/çıkış davranışından yararlanır; uygulamanın tam ekran düzeni korunur.

## Etiket ve yanlış geçiş düzeltmesi — 7 Ekim 2026

DM ikonundan başlayan 20 px kısa sürüklemenin mesaj ekranını açması web'de yeniden üretildi. Alt menü ve akış bağlantıları artık 10 pt'den fazla hareket eden, iptal edilen veya çoklu dokunuşa dönüşen hareketleri tıklama saymaz. Parmağın başlangıç noktasına geri dönmesi de bunu değiştirmez; sonraki gerçek dokunma normal çalışır. Kenar kontrolünde ikonun yerel koordinatı yerine akış yüzeyine göre koordinat kullanılır.

Web ve iPhone simülatöründe kısa DM/menü sürüklemesi ve ardından normal menü dokunması doğrulandı. Web klavye ile menü geçişi doğrulandı. 41 test, lint ve typecheck başarılı; Android cihaz etkileşimi bu revizyonda denenmedi.

Lazyweb public [Pinterest ekranları](https://www.lazyweb.com/company/pinterest) ve [Glass keşif akışı](https://www.lazyweb.com/flow/glass/browse-explore) incelendi. Yeni glass kapsül Swipe'ın tasarım kararıdır. MCP bağlı olmadığı için Agentic Search kaydı oluşturulmadı. [Hareket sırasında etiket](screenshots/swipe-glass-feedback.png).

Profil bağlantısı takibi: koordinatsız veya `detail=0` olayları artık otomatik olarak klavye olayı sayılmıyor. Başlangıç koordinatları olay nesnesinden kopyalanıyor; Pressable hareketleri de izleniyor. Akış yüzeyi, hareket responder eşiğine ulaşmasa bile hareket eden dokunuşun bağlantıları açmasını engelliyor. Web'de mağaza adı üzerinden kısa sol sürükleme ve normal dokunma; iPhone'da kısa sol sürükleme ve tam sol sürüklemenin profil açmadan sonraki ürüne geçmesi doğrulandı. İlgili 9 test başarılı.
