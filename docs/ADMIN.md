# Swipe yönetici paneli

Web adresi `/admin`. Mağaza paneli `/studio` ayrı kalır. Mobilde `/admin` keşfete yönlenir. Yerel web sunucusu şu anda 8082 portundadır.

Genel bakış gerçek kullanıcı, mağaza, ürün, demo sipariş ve beğeni sayılarını gösterir. Aylık UTC AI harcaması ve devam eden işler için ayrılan bütçe ayrı gösterilir. Kullanıcılar, mağazalar, ürünler, siparişler, AI işleri ve işlem geçmişi 30 kayıtlık sayfalama ve sunucu taraflı arama kullanır. Siparişler yalnızca liste görünümündedir; gerçek ödeme, kargo/iade yönetimi bu sürümde yoktur. Kullanıcı şikâyet toplama ve şikâyet kuyruğu henüz eklenmedi.

## Yetkilendirme

`006_admin.sql` yönetici rolleri, hesap/ürün moderasyonu ve işlem günlüğünü özel `swipe` şemasına ekler. Her admin isteği mevcut Bearer oturumu ve veritabanındaki `admin_roles` kaydıyla doğrulanır. İstemci rol atayamaz. Şifre hash'leri, oturum anahtarları ve özel DM metinleri panel uçlarına dahil edilmez. Hassas yanıtlar `no-store` kullanır.

Yalnızca önceden oluşturulmuş bir hesaba güvenilir sunucu terminalinden rol verilir:

```sh
node --env-file=.env scripts/grant-admin.mjs HESAP_EPOSTASI
```

Henüz kayıt olmamış e-postalar için otomatik yetki tanımı saklanmaz. Rol kaldırmak için güvenilir DB yöneticisi `admin_roles` kaydını kaldırmalıdır. Sonraki istekte yetki kesilir. Yönetici hesapları bu panelden askıya alınamaz.

## İşlemler

Ürün gizleme stok miktarını korur; katalog/mağaza/keşfet sonuçlarından çıkarır ve yeni checkout'u engeller. Hesap askıya alma mevcut oturumları iptal eder, yeni girişi engeller; mağazanın ürünlerini katalogdan çıkarır. Geri açma yeni girişe ve mevcut stok kuralları içinde görünürlüğe izin verir. Her değişiklik ve 3–500 karakterlik gerekçesi tek transaction içinde işlem günlüğüne yazılır. Gizleme medya dosyasını Storage'dan silmez; önceden alınan medya bağlantısı erişilebilir kalabilir.

## Doğrulama

Yetkisiz 401/403, parametre doğrulama, ürün gizleme/geri açma, gizli üründe checkout reddi, hesap oturum iptali, satıcı ürünlerinin filtrelenmesi, yönetici hesabını askıya alma engeli ve audit kayıtları otomatik test edildi. Mevcut öneri testi iki ayrı zaman ölçümü nedeniyle nadiren farklı puan üretiyordu; karşılaştırma aynı `now` değeriyle sabitlendi.

8 Ekim 2026'da kullanıcı tarafından belirtilen mevcut hesaba yönetici rolü atandı. Supabase'e 006 migration uygulandı. Panel gerçek oturumla tarayıcıda doğrulandı.

Tasarım araştırması: Lazyweb'in herkese açık [dashboard kataloğu](https://www.lazyweb.com/inspiration/home-dashboard). Bağlı Lazyweb MCP bulunmadığından özel Agentic Search oluşturulmadı.


## Siyah-beyaz tasarım

Panelin tüm bölümleri, giriş ekranı, tablolar ve moderasyon pencereleri siyah/beyaz ve nötr gri tonlarına geçirildi. Daha küçük başlıklar, çizgi ikonları, tıklanabilir özet sayıları ve tüm alanlara hızlı erişim eklendi. AI durumları Türkçeleştirildi. Yetki ve moderasyon davranışları değişmedi. Araştırma: https://www.lazyweb.com/company/linear

AI analizlerinde “Etiketler ve açıklama” alanı açılarak ürün türü, stil, renk, kullanım bağlamı ve görsel açıklama görülebilir. Arama analiz etiketlerini de kapsar. Çıktılar ilgili tamamlanmış işin önbellek kaydından okunur; eski işte yeni ürün analizinin gösterilmesi engellenir. Bekleyen/başarısız işler için durum açıklanır; bu ekran AI çağrısı başlatmaz.

Siparişler bölümünden [kargo bilgisi](SHIPPING.md) düzenlenebilir; durum, firma ve takip numarası alıcının siparişlerinde görünür.
