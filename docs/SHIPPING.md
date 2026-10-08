# Mağaza bazında manuel kargo yönetimi

Admin → Siparişler bölümünde her mağazanın ayrı kargo düğmesi vardır. Durum, firma ve takip numarası yalnızca seçilen mağazanın gönderimine yazılır. Durumlar: Hazırlanıyor, Kargoya verildi, Dağıtımda, Teslim edildi, İade edildi. Hazırlanıyor dışındaki durumlarda firma ve takip numarası zorunludur.

Alıcı Sen → Siparişlerin bölümünde her mağazanın ürünlerini, kargo durumunu ve takip bilgisini ayrı görür. Güncelleme uygulama içi bildirim üretir. Bir siparişte mağaza başına tek gönderim desteklenir; aynı mağazanın birden fazla pakete bölünmesi desteklenmez.

Yönetici hatalı bilgiyi düzeltebilir. Önceki/sonraki değerler ve yönetici kimliği işlem günlüğüne yazılır. Sürüm çakışması 409 döndürür; liste yenilenip form tekrar açılmalıdır. Başka mağazanın gönderimi ve ödeme tutarı değişmez. Bu işlem kargo sağlayıcısına bağlanmaz, gerçek kargo etiketi veya ödeme iadesi oluşturmaz. Takip numarası metin olarak gösterilir.

`009_safety_notifications_shipments.sql` geçmiş siparişleri kayıtlı ürünlerin mağazalarına göre `order_shipments` tablosuna böler. Tek mağazalı eski siparişlerde `order_shipping` bilgisi korunarak yeni gönderime kopyalanır. Çok mağazalı eski siparişin ortak takip numarası rastgele mağazaya atanmaz: eski kayıt korunur ve alıcıya eski ortak bilgi olarak gösterilir; yeni gönderimler Hazırlanıyor ile başlar. Yönetici her mağazanın doğru bilgisini ayrıca girmelidir.

API açılışında migration otomatik çalışır; `supabase/setup.sql` günceldir. Yetki, alıcı gizliliği, doğrulama, sürüm çakışması, tek mağazalı geçmiş kayıt aktarımı, iki mağazanın bağımsız güncellenmesi ve bildirimler test edilmiştir.
