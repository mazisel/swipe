# Takip, öneri açıklamaları ve medya hazırlama

## Mağaza takibi

Mağaza profilinden ve keşfet seçeneklerinden takip/takipten çıkma; Sen → Takip ettiğin mağazalar listesinden yönetim. `GET /api/following` yalnızca çağrıyı yapan kimliğin listesini verir. `POST /api/following` `{sellerId,following}` ile açık hedef durum yazar; tekrar gönderimler ikinci kayıt oluşturmaz. Sunucu kimliği kendisi çözer, kendini takip ve olmayan mağaza reddedilir.

`004_follows_reasons.sql` mağaza takiplerini ve sayfa açıklamalarını ekler. Misafir takipleri tek seferlik hesap birleştirmesine dahildir. Çıkışta yeni misafir kimliği önceki hesabın takiplerini göremez. Keşfet sıfırlama takipleri kaldırmaz; arayüz bunu belirtir. Gizlenen mağazalar takip edilse de akışta gizli kalır.

`swipe-hybrid-v2`: kişisel aday puanına takip için +0.12 eklenir. Yeni içerik/yükseliş yuvaları, mağaza çeşitliliği ve stok/gizleme kuralları korunur. Mevcut kartlar yer değiştirmez; takip yeni hesaplanan sayfalarda veya yeniden keşifte etkili olur. `FEED_PERSONALIZED=false` takip puanını da kapatır.

## Neden bunu görüyorum?

Açıklama gerçek aday özellikleri ve seçim grubundan üretilir: takip, kategori ilgisi, gerçek vektör benzerliği, yeni/az gösterilen içerik, son gün ilgisi veya genel keşif. Son gün sinyali yokken “yükseliyor” denmez. Özel DM metni kullanılmaz.

Açıklamalar seçki anının kaydıdır ve `feed_pages.reasons` içinde saklanır. Tekrar sayfalama aynı açıklamayı döndürür. Açıklamalar başka kimliğin imleciyle okunamaz; stok/gizleme filtresi açıklamaları da eler. İstemcide katalog güncellemelerinden ayrı tutulur.

## Medya

Sonraki iki ürünün fotoğraf/posteri ve galeride yakın medyalar önceden hazırlanır. Fotoğraf istekleri en fazla dört eşzamanlı istek ve 64 URL'lik kayıt ile sınırlandırılır; başarısız indirmeler kalıcı başarı sayılmaz. Kuyruktaki eski galeri işi ekran değişiminde bırakılır.

Sıradaki ürünün videosu ve mevcut galerinin bir sonraki medyası duraklatılmış olarak hazırlanır. Galeri katmanları URL anahtarıyla korunur; geçişte hazır oynatıcı yeniden kullanılır. Hazırlık katmanları erişilebilirlik ağacından gizlenir ve izlenme olayı göndermez. Video ilk karesini render edene kadar poster veya galeriden fotoğraf gösterilir. Arka planda oynatma ve yeni ön yükleme durur; mevcut medyanın kullanıcı duraklatma tercihi korunur. İnternet kesintisinde kesintisiz oynatma garantisi yoktur.

## Doğrulama — 7 Ekim 2026

49 test başarılı. Takip izolasyonu, tekrar gönderim, misafir birleştirme, çıkış, sıfırlama, kendini takip reddi, takip puanı/çeşitlilik, özellik bayrağı ve açıklama kalıcılığı test edildi. Lint ve TypeScript başarılı; web/iOS/Android paketleri üretildi.

Web ve iPhone 18 Pro simülatöründe menü, gerçek açıklama ve takip düğmesi denendi. Web'de takip listesi/mağaza profili durumu eşleşti. Web video kontrolünde sıradaki video `readyState=4`, `paused=true`, `currentTime=0` iken; geçişte `paused=false`, ilerleyen süre ve tam ekran görüntü gözlendi. Android cihaz ve yavaş ağ cihaz testi yapılmadı.

Araştırma: Lazyweb herkese açık arama sonucu, [Bluesky takip akışı](https://www.lazyweb.com/flow/bluesky/text-following). Expo SDK 57 [video ön yükleme ve ilk kare](https://docs.expo.dev/versions/v57.0.0/sdk/video/), [React Native Image.prefetch](https://reactnative.dev/docs/image#prefetch).
