# Kişiselleştirilmiş keşfet

## Çalışan mimari

Express artık yalnızca PostgreSQL SQL'i çalıştırır. `DATABASE_URL` varsa `pg` havuzu üzerinden Supabase/PostgreSQL'e, yoksa geliştirmede disk üzerinde PGlite'a bağlanır. PGlite gerçek PostgreSQL motorunun WASM sürümüdür; pgvector uzantısı ve aynı SQL migrations kullanılır. Üretimde DATABASE_URL zorunludur. Yerel PGlite tek süreçte açılır; ayrı worker/metrics/migration çalıştırmadan API durdurulmalıdır. Testler izole, bellekte PostgreSQL kullanır.

`swipe` özel şeması REST Data API'ye açılmaz; anonim ve authenticated Supabase rollerine şema erişimi verilmez. İstemci yalnızca Express'e gider; mevcut scrypt/opaque-session kimlik doğrulaması korunur. Supabase Auth'a geçiş yapılmadı. Database ve Storage servis anahtarları istemciye taşınmaz.

### Davranışlar

- 65% görünür içerik etkinleşir. Fotoğraf onLoad sonrası, video gerçek oynatma ilerlemesiyle ölçülür. Arka plan, gizli web sekmesi, modal, hata, duraklama, buffering ve ileri sarma süre üretmez.
- En az 1 saniye gösterim; 3 saniye veya videonun en az %95'inin 1 saniyeden uzun izlenmesi nitelikli görüntülemedir. 2 saniyeden hızlı **kaydırma** negatif sinyaldir. Duraklatma/navigasyon negatif sayılmaz.
- Bir oturum görüntülemesi en fazla 120 saniye ve video için iki tur sayılır. Olaylar 5 saniye/20 öğede gönderilir, ağ tekrarları UUID ile tekilleştirilir. Bellek kuyruğu 200 olayla sınırlıdır; uygulama kapanınca bekleyen telemetri kaybolabilir.
- Kişisel ağırlıklar: çanta 6, kaydetme 4, detay/arama seçimi 2, nitelikli görüntüleme 1, hızlı kaydırma −1, gönderilmiş yorum/mesaj 0.25. Aynı kişi/ürün/olay günde bir ağırlık kazanır. Mağazanın kendi ürünü sinyal üretmez. Yedi günlük yarı ömür, 90 günlük olay saklama.
- Mesaj içeriği/arama metni/adres/e-posta öneri verisine veya Gemini'ye gönderilmez. DM için yalnızca sunucuda doğrulanmış mesaj gönderimi ve ürün kimliği kullanılır. Demo siparişler hiçbir satın alma sinyali üretmez.
- Kimlik rastgele, cihazda saklanan token'dır; IP/fingerprint kullanılmaz. Web AsyncStorage, native SecureStore. Girişte misafir geçmişi bir kez birleştirilir ve eski token tüketilir. Çıkış yeni misafir oluşturur. Sıfırlama profil sürümünü artırır; eski kuyruk/akış kabul edilmez.

### Sıralama

20 içerikte 14 kişisel, 4 yeni/az gösterilmiş, 2 yükselen aday. Adaylar stok/gizleme/oturum içi tekrar filtresinden geçer. Alternatif varsa aynı mağaza art arda gelmez, kayan 10 içerikte mağaza üç kezle sınırlanır; küçük katalogda bu yumuşak çeşitlilik kuralı gevşer. Oturumda ürün tekrarı yapılmaz. Katalog sonu yeniden keşfet düğmesi gösterir.

Sıralama: %35 vektör benzerliği + %25 kategori/stil/renk/fiyat ilgisi + %25 gösterime göre düzeltilmiş kaydetme/çanta oranı + %10 yenilik + %5 yakın zamanlı yükseliş. AI vektörü yoksa anlamsal bileşen ürün etiketlerine geri döner. Yapay bir embedding üretilmez. Soğuk başlangıçta nötr ilgi ve mağaza/kategori çeşitliliği kullanılır. İlk sürüm ağırlıkları hipotezdir; dönüşüm artışı iddiası yoktur.

Sayfalar oturuma bağlı kalıcı ürün ID listeleridir. İmleç aynı kullanıcı için aynı sayfayı döndürür; stok ve gizleme yeniden kontrol edilir. Ürün özeti güncellemeleri mevcut sıralamayı değiştirmez. Son beş ürüne gelmeden sonraki sayfa önceden yüklenir. `FEED_PERSONALIZED=false` yeni oturumları dengeli genel akışa çevirir; eski sürüm imleci yenileme ister.

API: `POST /api/feed/identity`, `GET /api/feed?cursor=...`, `POST /api/feed/events`, `POST /api/feed/preferences`, `POST /api/feed/reset`. Misafir istekleri `X-Feed-Token`, hesap istekleri mevcut Bearer token taşır. İstemcinin userId/generation sahteciliği otorite değildir. Yeni types `FeedIdentity`, `FeedEvent`, `FeedPage` paylaşılır.

## AI worker ve maliyet

`gemini-3.1-flash-lite` ürün görseli/video için doğrulanan JSON çıkarır; `gemini-embedding-2` ürün ve görsel açıklama metnini 768 boyutta embed eder. Fiyat/stok/kategori değiştirilmez. Yalnızca mağazanın yüklediği ve hash'i doğrulanan medya okunur. Seed Unsplash/Cloudinary dosyaları harici API'ye gönderilmez. Analiz hash + metadata + model/prompt sürümü ile önbelleklenir. Ürün yayını AI beklemez.

API içinde 15 saniyede bir worker çalışır. PostgreSQL satır kilitleri, job claim kilidi ve SKIP LOCKED birden fazla worker için güvenlik sağlar. En fazla üç deneme, beş dakika geri çekilme. 20 dakika sonra terk edilmiş işler yeniden denenebilir; önceki maliyet payı bırakılmaz. Ürünler model erişilemese de metadata ile sıralanır.

Aylık üst sınır 25 USD, daha düşük bir değer seçilebilir. Her ücretli iş öncesi atomik olarak 0.60 USD ayrılır: izin verilen model bağlamı + en fazla 2048 çıktı/düşünme token'ı + 8192 token metin embedding üst sınırını karşılayan ihtiyatlı pay. Başarılı işlerde raporlanan analiz token'ları ve embedding üst sınırı üzerinden pay düşürülür. Eşzamanlı harcanan + ayrılan tutar sınırı aşamaz. Belirsiz hata/timeout/crash rezervasyonu korunur; otomatik iade yoktur. Bütçe dolu işleri sonraki UTC ayına bekler.

Bu uygulamanın çağrı bütçesidir; vergi, fiyat değişikliği veya aynı API anahtarının başka uygulamalarda kullanımına ilişkin sağlayıcı fatura limiti değildir. Sabit tarife tablosu 6 Ekim 2026 belgeleriyle eşleşir; model/tarife değişikliğinde rezervasyon hesabı birlikte gözden geçirilmelidir. Ücretli Google API anahtarı kullanın. Canlı sağlayıcı bağlantısı anahtar olmadan doğrulanmış sayılmaz.

## Supabase'e bağlama ve veri aktarımı

1. Yeni bir Supabase geliştirme projesi oluşturun. `.env.example` içindeki DATABASE_URL (direct veya session pooler), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY alanlarını sunucunun `.env` dosyasına girin. Parolayı URI içinde doğru encode edin; TLS sertifika doğrulamasını kapatmayın. `swipe` şemasını Data API exposed schemas listesine eklemeyin.
2. Eski API'yi durdurun. Boş hedefe `npm run db:migrate` ile deneme yapın. Bu komut kayıtları PostgreSQL transaction içinde ekleyip karşılaştırır ve geri alır. Schema migrations kalır; ürün medyası dry run'da yüklenmez.
3. `npm run db:migrate -- --apply` çalıştırın. Kaynak SQLite online backup ile `server/data/backups/` içine yedeklenir. Kullanıcılar, parola hash'leri, ürün ve sosyal ilişkiler korunur; oturumlar aktarılmaz. Sahip olunan yerel medyalar Storage'a yüklenir, URL'ler güncellenir. Satır karşılaştırması/checksum uyuşmazlığı tüm DB aktarımını geri alır. Boş olmayan hedefe yazılmaz. Başarısız DB aktarımından önce yüklenen dosyalar Storage'da kalabilir; deterministik dosya isimleri güvenli tekrar sağlar.
4. `npm run api:demo` başlatın. Gerçek ödeme kapalıdır. GEMINI_API_KEY eklenince worker bekleyen yeni yüklemeleri işler; gizli anahtarlar EXPO_PUBLIC_ ile başlamaz. Geliştirmede seed kullanabilirsiniz; boş canlı katalog için SEED_DEMO=false.
5. Ayrı bulut worker istenirse API'de AI_WORKER=false, aynı DATABASE_URL ile `npm run ai:worker`. Yerelde worker API sürecinde kalır.

Yerel SQLite kaynak yedeği bu görevde PostgreSQL/PGlite'a taşındı. Sonradan PostgreSQL'de yazılmış yeni veriler için eski SQLite yedeği güncel kaynak değildir. Buluta sonraki geçişte mevcut PostgreSQL verisini aktarın veya güncel verinin bulunduğu kaynağı açıkça seçin; eski SQLite aktarımını yeniden çalıştırarak yeni verileri atmayın.

## Ölçüm ve doğrulama

`npm run feed:metrics` yalnızca sunucu ortamında sürüm başına olay/ürün/mağaza kapsamı, ortalama/en yüksek API süresi, AI harcama/ayrılan pay ve iş kuyruğunu verir. PGlite kullanırken API'yi önce durdurun. Ham kullanıcı kimlikleri ve DM içeriği rapora girmez. Kaydetme/çanta oranını gösterimle birlikte değerlendirin; yalnızca izleme süresini optimize etmeyin. Gerçek trafik ve A/B testi olmadan ticari başarı sonucu çıkarılmaz.

33 otomatik test: mevcut 18 özellik, sahipli sayfalama, sıfırlama/merge, tekrar engelleme, farklı ilgi sıralamaları, görünürlük/oynatma saati, eşzamanlı bütçe, AI cache/hata/kesinti ve veritabanı aktarımı. Gerçek PostgreSQL motoru PGlite/pgvector ile çalıştırıldı; uzaktaki Supabase bağlantısı veya gerçek Gemini modeli için canlı doğrulama değildir. Web arayüzünde gizleme, sıfırlama, katalog sonu ve yeniden keşfet kontrol edildi. iOS/Android/web paketleri export edildi. iPhone 18 Pro / iOS 27 Expo Go açılışı ve yeni keşfet kontrolleri simülatörde görüldü; Android cihaz etkileşim testi yapılmadı. Başlangıçtaki eski Expo Go çalışma oturumu kapatılıp yeniden açılınca native modül hatası giderildi.

Kaynaklar: [Instagram Explore](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Embeddings](https://ai.google.dev/gemini-api/docs/embeddings), [PGlite extensions](https://pglite.dev/extensions/), [Lazyweb TikTok](https://www.lazyweb.com/company/tiktok). Lazyweb public araştırması kullanıldı; imzalı MCP bağlantısı olmadığı için özel Agentic Search kaydı oluşturulmadı.


## 8 Ekim 2026 — Supabase veri aktarımı

Güncel yerel PostgreSQL/PGlite kaynağı Supabase'e aktarıldı. Kaynakta 5 demo mağaza hesabı, 20 ürün, 3 beğeni, 2 takip, 2 misafir aktörü, 107 davranış olayı ve 1.257 gösterim vardı. Keşfet oturumları, sayfalar ve tekrar önleme kayıtları da korundu. Kaynakta sipariş, yorum, değerlendirme, DM veya hesap oturumu yoktu.

Üç yerel demo video Supabase Storage `product-media` alanına içerik özetiyle adlandırılarak yüklendi. Ürün medya ve galeri URL'leri güncellendi; mevcut dış kaynak fotoğraf URL'leri korundu. Her video için HTTP erişimi doğrulandı.

Araç: `server/migrate-postgres.mjs`. Önce `--snapshot DOSYA`, ardından `--dry-run DOSYA`, son olarak `--apply DOSYA` kullanılır. Kaynak API kapalı olmalıdır. Hedefin tüm uygulama tabloları boş olmalı ve migration sürümleri aynı olmalıdır. İşlem kilit ve transaction kullanır; deneme sonunda geri alınır. Kimlikler ve ilişkiler korunur, hesap oturumları aktarılmaz. Tablo içerikleri hedef veri tiplerine dönüştürülerek karşılaştırılır; deneme ve kalıcı aktarım özetleri de eşleştirilir. Başarısız veritabanı aktarımından önce yüklenmiş medya nesneleri Storage'da kalabilir.

Yerel yedekler (Git dışında, yalnızca dosya sahibi okuyabilir):
- `server/data/backups/pre-cloud-20261008.tar.gz`: aktarım öncesi yerel PostgreSQL ve yüklemeler.
- `server/data/backups/cloud-20261008.json`: tüm kaynak tabloların mantıksal yedeği; kimlik doğrulama bilgileri içerir, paylaşılmamalıdır.
- Aynı JSON yolunun `.dry-run.json` ve `.apply.json` raporları: adetler ve içerik özetleri.

API `.env` üzerinden Supabase ile yeniden başlatıldı; `/api/health` PostgreSQL, katalog 20 ürün ve toplam 3 beğeni döndürdü. Ödeme demo olarak kaldı. Gemini anahtarı yapılandırılmış olmakla birlikte bu aktarımda ücretli AI çağrısı yapılmadı. 53 otomatik test, lint ve typecheck geçti; otomatik testler izole PGlite üzerinde, aktarım ve katalog doğrulaması gerçek Supabase üzerinde çalıştı.


## 8 Ekim 2026 — gerçek Gemini uçtan uca doğrulaması

Mevcut Gemini anahtarının `gemini-3.1-flash-lite` ve `gemini-embedding-2` modellerine erişimi doğrulandı. Uygulamanın kendi `assets/icon.png` görseli, açıkça AI testi olarak adlandırılmış demo sticker ürünüyle gerçek kayıt → mağaza → medya yükleme → ürün yayımlama API zincirinden geçirildi. Test ürünü stok 0 yapılarak keşfet dışında bırakıldı, test oturumu kapatıldı. Test hesabı ve ürün teşhis için duruyor; kullanıcı geçmişleri değiştirilmedi.

API worker'ı gerçek Gemini çağrısını tamamladı. Çıktı ürün türünü “Etiket”, stilleri “Minimalist / Grafik”, renkleri “Beyaz / Açık yeşil / Koyu gri” olarak tanımladı. Açıklama, koyu zemin üzerindeki S harfi ve nokta tasarımını anlattı. Doğrulanmış JSON ve 768 boyutlu normalleştirilmiş embedding Supabase pgvector alanına kaydedildi.

Uygulama maliyet hesabı 2.134 mikro USD (0,002134 USD) yazdı; ayrılan 0,60 USD serbest bırakıldı, bekleyen rezervasyon 0 oldu. Bu tutar sağlayıcı faturası değil, kullanım verisi ve ihtiyatlı embedding token üst sınırıyla hesaplanan uygulama kaydıdır. Fiyatlar kontrol edildi: https://ai.google.dev/gemini-api/docs/pricing

Gerçek vektör kontrollü karma ilgi profiliyle sıralayıcıya verildi: aynı ürünün puanı vektörle 0,654993, vektörsüz 0,549993 oldu (+0,105). Böylece anlamsal bileşenin çalıştığı doğrulandı; bu ölçüm gerçek kullanıcı dönüşüm artışı veya geniş katalog öneri kalitesi iddiası değildir. Aynı ürün yeniden kuyruğa alındığında iş adedi 1 kaldı; ek ücretli çağrı oluşmadı.

Ayrıntılı yerel rapor: `server/data/ai-smoke-report.json`. Canlı test yalnızca tek PNG görseli kapsar; gerçek ürün fotoğrafları üzerinde kalite değerlendirmesi ve video analizinin canlı testi ayrıca yapılmalıdır. Lint ve typecheck geçti.
