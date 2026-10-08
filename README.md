# Swipe

TikTok/Reels biçiminde doğrudan keşfete açılan, Türkçe ve TL kullanan moda, aksesuar ve yaşam tarzı pazaryeri. iOS, Android ve web için **Expo SDK 57 + React Native + TypeScript**; yerel servis için **Node.js + Express + PostgreSQL (Supabase / yerel PGlite)**.

## Kişiselleştirilmiş keşfet

Davranışa göre sıralama, yeni mağaza keşfi, tekrarsız sayfalama, ürün/mağaza gizleme ve profilden keşfet sıfırlama çalışır. Yorum/mesaj içerikleri analiz edilmez; demo siparişler öneriyi satın alma olarak etkilemez. AI ürün analizi ve 25 USD aylık çağrı bütçesi sunucu worker'ında hazırdır; gerçek analiz için Gemini anahtarı gerekir.

Supabase bağlantısı yoksa uygulama yerel PostgreSQL/PGlite ile açılır. Bulut bağlantısı, SQLite aktarımı, güvenli ortam değişkenleri ve test sınırları: [Keşfet teknik rehberi](docs/DISCOVERY.md).

Supabase SQL Editor için tek dosyalık şema kurulumu: [supabase/setup.sql](supabase/setup.sql). [Kurulum adımları](supabase/README.md). Bu dosya güncel yerel verileri buluta aktarmaz.

## Çalıştırma

Docker/Portainer ile sunucu kurulumu ve GitHub Actions imaj yayını: [Dağıtım rehberi](docs/DEPLOYMENT.md).

Node.js **24.12+** veya daha yeni bir sürüm gerekir (`node:sqlite` ve env-file desteği kullanılır). Bu projede Node 26.8.1 ile doğrulandı.

```sh
npm ci
```

İki terminal açın:

```sh
# Terminal 1: yerel veritabanı + açıkça demo ödeme
npm run api:demo
```

```sh
# Terminal 2: web arayüzü
npm run web
```

Alıcı uygulaması: **http://localhost:8081**. Mağazalara özel web paneli: **http://localhost:8081/studio**. API: **http://localhost:3001**.

### iOS / Android

```sh
npm start
```

Expo Go'nun SDK 57 destekleyen sürümü veya bir development build kullanın. Telefonda bilgisayarla aynı ağa bağlanın. API adresi Expo geliştirme sunucusunun LAN adresinden otomatik çıkarılır. Gerekirse `.env.example` dosyasını `.env` olarak kopyalayıp `EXPO_PUBLIC_API_URL=http://BILGISAYAR_LAN_IP:3001` ayarlayın; telefonda `localhost` bilgisayarı göstermez. `.env` değişince Expo'yu yeniden başlatın. iOS/Android derleme çıktısı doğrulandı. 6 Ekim 2026 tarihinde iPhone 18 Pro / iOS 27 simülatöründe Expo Go ile açılış, katalog bağlantısı ve akış görünümü doğrulandı; fiziksel cihaz testi henüz yapılmadı.

Yönetici paneli: **http://localhost:8082/admin** (yerel web sunucusu 8082 üzerinde). Rol ve moderasyon ayrıntıları: [Yönetim rehberi](docs/ADMIN.md).

## Çalışan akışlar

- Girişsiz, üst çubuksuz ve tam ekran Reels akışı. Arama ve kategori filtreleri alt menüdeki Ara ekranında.
- Kısa mikro animasyonlar: kayan menü seçimi, beğeni/çanta tepkisi, takip onayı, fiyat dokunuşu, galeri çizgileri, beden seçimi ve açılan öneri açıklaması. Sistem/web “Hareketi azalt” tercihi canlı izlenir. [Hareket rehberi](docs/MOTION.md).
- Cam görünümlü yüzen alt menü: Akış, Ara, DM, Çanta ve Sen. Beğendiklerin profilden açılır. Desteklenen iOS 26+ ortamında native Liquid Glass; web ve Android'de bulanıklık tabanlı görünüm. Şeffaflığı azalt tercihi desteklenir.
- Ürün başına en fazla 6 fotoğraf/video. Tam ekran akışta sağ/sol bölgeye dokunarak galeri geçişi, üstte ince ilerleme çizgileri. Yatay kaydırma beğen/çanta davranışını korur. Görünür videoda otomatik oynatma, sessize alma, duraklatma ve arka planda durma. [Galeri rehberi](docs/GALLERY.md).
- Tam ekran içerik parmağı takip eder, hafif döner ve tamamlanan işlemden sonra yana çıkarak sıradaki ürüne geçer. Sola kaydırarak beğenme, sağa kaydırarak çantaya ekleme; çok bedenli ürünlerde glass beden seçimi ve 8 saniyelik geri alma. Aynı ürüne tekrar kaydırmak beğeniyi kaldırmaz veya çanta adedini artırmaz.
- Kalp ve herkese açık gerçek beğeni toplamı; kişisel Beğendiklerin listesi sunucuda korunur. Eski cihaz kayıtları bir kez aktarılır. [Beğeni rehberi](docs/LIKES.md).
- Üç ürün geçişinden sonra kısa glass öğretici. Kapatma tercihi cihazda saklanır; ilk açılışı kesmez. [Davranışlar ve doğrulama](docs/GESTURES.md).
- Mağaza profili ve üç nokta menüsünden takip/takipten çıkma; profilde takip edilen mağazalar. Misafir takipleri girişte bir kez hesaba taşınır, keşfet sıfırlansa da korunur. Takip edilen mağazalar sonraki önerilerde öncelik alır.
- Üç nokta menüsünde “Neden bunu görüyorum?”: seçki oluşturulurken kullanılan gerçek seçim nedeni saklanır. Ayrıntılar: [Takip, açıklama ve medya](docs/FOLLOWING.md).
- Akışın üzerinde açılan ürün paneli, beden seçimi, beğeniler, çok satıcılı çanta ve adet değiştirme.
- Reels üzerinden yorum paneli, giriş yapan kullanıcılar için yorum gönderme ve kendi yorumunu silme.
- Siparişe bağlı 1–5 yıldızlı ürün değerlendirmesi, puan ortalaması ve kullanıcı başına güncellenebilir tek değerlendirme. Demo siparişler gerçek satın alma gibi gösterilmez; açıkça demo etiketi bulunur. Mağaza kendi ürününü puanlayamaz.
- Ürün bağlamını koruyan alıcı–mağaza DM'i, gelen kutusu, okunmamış sayısı ve görüldü bilgisi. Alıcı uygulamadan, satıcı yalnızca web Studio'nun Mesajlar sekmesinden yanıtlar. Sohbetler yalnızca katılımcılara açıktır; yeniden denenen mesaj çift kaydedilmez.
- E-posta/şifre kaydı, giriş/çıkış. Sunucuda scrypt şifre özeti ve süreli oturumlar. Native oturum anahtarı SecureStore'da, web oturumu sessionStorage'da saklanır.
- Yalnızca web Studio'da satıcı kaydı, mağaza açma, mağaza adı/açıklaması düzenleme, 50 MB'a kadar JPG/PNG/WebP/MP4/MOV yükleme ve ürün yayımlama. Native uygulamada Studio yönetimi bulunmaz; mağaza sayfası alıcıların gördüğü herkese açık profildir.
- Sunucu tarafında fiyat, seçenek ve toplam stok kontrolü; tekrar gönderilen siparişte idempotency.
- Açık onaylı demo sipariş ve kişisel sipariş geçmişi.
- Sepet cihazda; beğeniler, hesap, mağaza, ürün, sipariş, yorum, değerlendirme ve mesajlar PostgreSQL'de kalıcıdır.

`server/data/` yerel veri ve yüklemeleri içerir ve Git'e alınmaz. Mevcut gerçek kullanıcı hesabı veya sabit demo şifresi yoktur; UI'dan kendi yerel test hesabınızı oluşturabilirsiniz. Başlangıç kataloğu 5 mağazada 20 temsilî ürün içerir; 3 ürünün kapağı videodur. Fotoğraflar Unsplash, videolar Cloudinary üzerinde yayımlanmış demo kaynaklarıdır. Kaynaklar: [demo medya](server/demo-media/README.md). Canlı kullanımda kendi ürün medyanız ve gerekli kullanım hakları gerekir.

## Hesap güvenliği

Resend ile e-posta doğrulama ve tek kullanımlık bağlantıyla şifre sıfırlama hazır. Gönderim için sunucu yapılandırması gerekir; gerçek teslimat henüz denenmedi. [Kurulum ve güvenlik davranışı](docs/ACCOUNT_SECURITY.md).

## Ödeme sınırı

Kullanıcının seçimiyle bu sürüm **demo ödeme** kullanır. Kart verisi alınmaz, para çekilmez, kargo oluşturulmaz ve stok düşmez. Demo alıcı/adres alanları doğrulanır fakat adres saklanmaz. `CHECKOUT_MODE=demo` olmadan (`npm run api`) checkout endpoint'i 503 döner. Gerçek ödeme sağlayıcısına gizli anahtar bağlanmış değildir.

Canlı pazaryeri için iyzico/PayTR gibi sağlayıcıda pazaryeri/alt satıcı hesabı, sunucu tarafı ödeme ve webhook akışı, satıcı doğrulama, stok rezervasyonu, kargo/iade, ürün moderasyonu, KVKK/sözleşmeler ve üretim altyapısı eklenmelidir. Bu yerel sürüm kamuya açık üretim dağıtımı için hazır değildir.

## Kontroller

```sh
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx expo export --platform all
```

61 test; PostgreSQL/PGlite + pgvector üzerinde hesap, yetkilendirme, dosya içeriği, mağaza sahipliği, fiyat/beden/stok, sipariş, sosyal özellikler, öneri sistemi, AI bütçesi ve aktarım kontrollerini; ayrıca kaydırma eşiği, mükerrer işlemler, geri alma ve öğretici sayacını kapsar. Kaydırma akışı web ve iPhone 18 Pro / iOS 27 simülatöründe denendi. Android paketi üretildi; Android cihaz ve fiziksel dokunsal geri bildirim henüz denenmedi.

6 Ekim 2026 kontrolünde Expo Doctor 21/21 geçti. `npm audit`, Expo/Metro ve yönlendiricinin geçişli bağımlılıklarında 28 uyarı (18 yüksek, 10 orta) bildirdi. Registry'de `braces` ve `node-forge` için uyumlu yeni yama henüz bulunmadı; `npm audit fix --force` uyumsuz framework sürümleri önerdiği için uygulanmadı. Üretim öncesi tekrar değerlendirilmeli; geliştirme sunucusu internete açılmamalı.

Ürün kararları, araştırma kaynakları ve bilinen kapsam: [docs/PRODUCT.md](docs/PRODUCT.md).

DM listesi ve açık sohbet, ekran odaktayken ve uygulama ön plandayken 7 saniyede bir yenilenir. Bu sürümde metin mesajları vardır; telefon push bildirimleri, kullanıcılar arası DM ve medya mesajları eklenmemiştir. Ürün/mağaza/mesaj şikâyetleri, yönetici inceleme kuyruğu, iki yönlü DM engelleme ve uygulama içi bildirimler vardır. [Güvenlik ve bildirimler](docs/SAFETY_NOTIFICATIONS.md). Sosyal listelerde üretim ölçeği için sayfalama gerekir.

### Bu Mac üzerinde simülatör bağlantısı

Node'un localhost için IPv6 seçmesi, Expo Go'nun `127.0.0.1` adresine bağlantısını engelleyebilir. Doğrulanan geliştirme komutu:

```sh
NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --port 8082 --localhost
```

Simülatörde Expo Go'ya `exp://127.0.0.1:8082` adresini açın. Yerel API `npm run api:demo` ile 3001 portunda çalışmalıdır. Xcode Device Hub penceresini algılamada Expo CLI zaman aşımına uğrarsa sunucu ve simülatör ayrı başlatılabilir.

Manuel kargo durumu, firma ve takip numarasi yonetimi: [Kargo rehberi](docs/SHIPPING.md).

Keşfet sırası 20 ürünlük sayfalarla oluşturulur. Yeni sayfa isteği, sunucuya ulaşmış güncel davranışları kullanır; önceden hazırlanmış sayfanın sırası sabittir. Katalog tek sayfaya sığıyorsa yeni sıralama yeniden keşfetmede görünür. Video hazırlama penceresi kartlar arasındaki görünürlük boşluğunda korunur; görünmeyen oyuncular duraklatılır. Yakındaki videoların hazır tutulması ileri/geri geçişte yeniden yüklemeyi azaltır. Native medya yüklemesi `replaceAsync` kullanır.
