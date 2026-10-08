# Manuel kargo yönetimi

Admin → Siparişler → Kargo bilgisi üzerinden durum, kargo firması ve takip numarası girilir. Durumlar: Hazırlanıyor, Kargoya verildi, Dağıtımda, Teslim edildi, İade edildi. Hazırlanıyor dışındaki durumlarda firma ve takip numarası zorunludur.

Alıcı Sen → Siparişlerin bölümünde kendi siparişinin durumunu, takip bilgilerini ve son güncelleme zamanını görür. Ekrana tekrar gelince bilgiler yenilenir. Bir sipariş için tek kargo kaydı vardır; mağaza/paket bazında bölünmüş gönderim bu sürümde yoktur.

Yönetici hatalı durumu düzeltebilir. Önceki ve sonraki değerler, yönetici kimliği ve işlem zamanı denetim kaydına yazılır. Eşzamanlı düzenlemede eski sürümle yazma 409 döndürür; yönetici listeyi yenileyip formu tekrar açmalıdır.

Kargo bilgisi ayrı `order_shipping` tablosundadır. Sipariş tutarı ve demo ödeme durumu değiştirilmez. Bu işlem gerçek kargo oluşturmaz, kargo sağlayıcısına bağlanmaz ve bildirim göndermez. Takip numarası metin olarak gösterilir.

`008_shipping.sql` API açılışında otomatik uygulanır. SQL Editor için `supabase/setup.sql` de güncellendi. Yetki, alıcı gizliliği, alan doğrulama, eşzamanlı güncelleme, işlem geçmişi ve ödeme verisinin korunması otomatik testle doğrulandı. Ayrı bellek veritabanındaki test siparişiyle admin kaydetme ve alıcı görüntüleme kontrol edildi.
