# Beğeniler

Kaydet eylemi kullanıcı arayüzünde Beğen olarak değişti. Kalbe dokunmak beğeniyi açar/kapatır; sola kaydırmak yalnızca ekler. Yinelenen sola kaydırma mevcut beğeniyi kaldırmaz. Yeni kaydırma beğenisi 8 saniyelik geri alma ile kaldırılabilir. Profilde Beğendiklerin eski `/saved` adresinden açılır.

## Kalıcılık ve toplamlar

`005_likes.sql`, `product_likes` ve `like_imports` tablolarını ekler. Her aktör/ürün çifti tek satırdır. Herkese açık toplam gerçek satırlardan hesaplanır; örnek sahte sayılar eklenmez. Beğenen kimlikleri dışarı verilmez. Anonim kimlik bir insanın doğrulanmış kimliği değildir; farklı misafir kimlikleri ayrı beğeni oluşturabilir.

`GET /api/likes` yalnızca istek sahibinin ürün kimliklerini ve katalog toplamlarını döndürür. `POST /api/likes` ürün kimliği ve boolean `liked` alır. İşlemler sunucuda kilitlenir; tekrar gönderim toplamı artırmaz. İstemci yalnızca sunucu onayından sonra kalbi ve toplamı günceller. Ön planda 30 saniyede bir ve uygulamaya dönüşte toplamlar yenilenir; bekleyen yazı sırasında okuma yapılmaz, eski yanıtlar güncel durumu ezemez.

Misafir beğenileri girişte hesaba bir kez taşınır. Aynı üründeki hesap/misafir beğenileri birleşir ve çift sayılmaz. Çıkışta kişisel liste temizlenir ve yeni misafir kimliğiyle yüklenir. Keşfet sıfırlama beğeni listesini korur.

## Eski kayıtlar

İlk açılışta cihazdaki `swipe-bag.saved` değerleri kalıcı bir aktarım UUID'siyle `POST /api/likes/import` üzerinden taşınır. UUID sunucuda tekilleştirilir; ağ kesintisi sonrası tekrar veya başka bir kimlikle gönderim eski beğenileri tekrar yaratmaz. Başarılı aktarımdan sonra eski liste temizlenir. Uç nokta en fazla 1.000 kimlik kabul eder; mevcut ilk sürüm kataloğu bu sınırın altındadır. Silinmiş ürünler atlanır, sepet korunur.

## Öneriler ve doğrulama

İç event türü geriye uyumluluk için `save` olarak kalır; mevcut ağırlık 4 korunur. Sunucu yalnızca yeni beğenide sinyal yazar. Beğeni kaldırılınca ilgili sinyal ve önbellek ilgi profili temizlenir; DM metni işlenmez.

52 testlik paket geçti. Beğeni testleri eşzamanlı tekrarları, özel liste erişimini, gerçek toplamları, kaldırmayı, aktarım tekrarını, giriş birleştirmeyi ve çıkış izolasyonunu kapsar. Web'de kalp açma/kapatma ve Beğendiklerin, iOS simülatöründe eski kayıt aktarımı ve kalp/sayı görünümü doğrulandı. Lint, TypeScript ve iOS/Android/web dışa aktarımları geçti. Android cihazda etkileşim testi yapılmadı.
