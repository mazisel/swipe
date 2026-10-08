# Swipe

Türkiye için Türkçe ve TL kullanan, moda / aksesuar / yaşam tarzı pazaryeri.

## Kabul edilen ürün kararları

- iOS, Android ve web: React Native, Expo SDK 57, TypeScript.
- Uygulama onboarding veya giriş duvarı olmadan Keşfet ekranında açılır.
- Dikey akışta fotoğraf ve video birlikte yer alır. Görünmeyen / arka plandaki videolar durur.
- Satıcı hesabı, mağaza açma, profil düzenleme, fotoğraf/video yükleme ve ürün yayımlama yalnızca ayrı web Studio panelinde yer alır. Alıcı uygulamasında mağazaların herkese açık profili görüntülenebilir.
- Çok satıcılı sepet ve uygulama içi sipariş adımı.
- Üst çubuksuz, kenardan kenara Reels deneyimi; medyanın üzerine yerleşen mağaza, kaydetme/paylaşma ve küçük ürün bağlantısı.
- Ürün detayı akış üzerinde alt panel olarak açılır. Arama ayrı bir alt menü sekmesindedir.
- Yüzen cam alt menü: Akış, Ara, DM, Çanta, Sen. Kaydedilenler profildedir. iOS'ta kullanılabilirlik kontrolüyle native Liquid Glass; diğer platformlarda bulanıklık ve saydam yüzey. Koyu renkler medyanın ön planda kalmasını sağlar.

- Her ürünün yorumları ve değerlendirmeleri akış üstündeki iki sekmeli alt panelde açılır. Yorum yazmak için giriş, değerlendirmek için ilgili ürünü içeren sipariş gerekir. Kullanıcı kendi yorumunu silebilir ve tek değerlendirmesini güncelleyebilir.
- İlk DM kapsamı alıcı–mağaza metin sohbetidir. Konuşma ürünle ilişkilidir; uygulamada alıcı gelen kutusu, web Studio'da satıcı gelen kutusu bulunur. Başka hesaplar sohbeti okuyamaz veya mesaj gönderemez.

## Araştırma

Lazyweb public search API üzerinden TikTok, Confirmed ve Depop akışları incelendi. MCP bağlı olmadığı için Agentic Search kaydı oluşturulmadı.

- https://www.lazyweb.com/flow/confirmed/shop — video ve alışveriş ilişkisinin örneği.
- https://www.lazyweb.com/company/tiktok — dikey video keşfi.
- https://www.lazyweb.com/flow/depop/checkout-item-in-bag — ürün, sepet ve ödeme akışı.
- https://www.lazyweb.com/company/depop — satıcı ve alıcı rollerinin tek uygulamada birleşmesi.
- https://www.lazyweb.com/flow/ig/comment-on-reel — Reels üzerindeki kontroller ve içerik katmanı.
- https://www.lazyweb.com/flow/ig/message-business-account — işletme bağlamından özel sohbete geçiş referansı; Lazyweb public search ile okundu.
- https://www.lazyweb.com/flow/ig/search-for-account — aramanın ayrı akışta sunulması.
- https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/ — native Liquid Glass ve kullanılabilirlik kontrolleri.
- https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/ — web/Android bulanıklık ve Android blur hedefi.

Son revizyon, kullanıcının satıcı yönetimini web'e ayırma ve alışverişi Reels akışına taşıma kararıyla uygulanmıştır. Referanslar ürün kararı için kanıttır; başka ürünlerin tüm davranışları kopyalanmaz.

## İlk yerel sürümün sınırı

Hesaplar, mağazalar, medya, ürünler ve demo siparişler yerel API'de kalıcıdır. Katalogdaki başlangıç ürünleri örnektir. Siparişler açık biçimde `demo` durumundadır; ücret alınmaz, stok düşmez, kargo çıkmaz. Kart verisi toplanmaz. `CHECKOUT_MODE` açıkça `demo` değilse sipariş endpoint'i kapalıdır.

Gerçek satış için ödeme sağlayıcısı ve alt satıcı/payout entegrasyonu, ödeme webhook doğrulaması ve idempotency, stok rezervasyonu, satıcı kimlik doğrulaması ve onayı, iade/kargo, ürün moderasyonu, e-posta doğrulama ve şifre kurtarma, KVKK/sözleşme metinleri, üretim depolaması ve izleme tamamlanmalıdır. Yerel test sunucusu bu süreçlerin tamamlandığı anlamına gelmez.

İlk sürümde stok ürün düzeyindedir, bedenler arasında ortaktır. Ödeme/adres formu demo akışını doğrular; adres verisi saklanmaz. Listeleme yönetiminde ilk kapsam ürün oluşturmaktır; düzenleme, arşivleme ve mağaza sipariş paneli sonraki aşamadır.

Demo siparişlere verilen puanlar açıkça demo olarak işaretlenir; doğrulanmış gerçek satın alma rozeti gösterilmez. Canlı sipariş yaşam döngüsü eklenince değerlendirme uygunluğu teslim edilen siparişlere bağlanmalıdır. Sosyal içerikler için moderasyon, engelleme/şikâyet, sayfalama ve push bildirimleri üretim öncesi ek kapsamdır. Mevcut DM yenilemesi odakta 7 saniyelik sorgulamadır.
