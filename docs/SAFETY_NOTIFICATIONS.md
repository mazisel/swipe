# Şikâyetler, engelleme ve bildirimler

Ürün menüsünden, mağaza profilinden veya sohbet içindeki karşı tarafın mesajından bildirim yapılabilir. Gerekçe zorunludur. Aynı açık şikâyetin tekrar gönderilmesi yeni kayıt oluşturmaz. Mesaj şikâyeti yalnızca sohbet katılımcısınca yapılabilir; incelemeye yalnızca seçilen mesaj ve gerekçe aktarılır, sohbet geçmişi aktarılmaz.

Admin → Şikâyetler listesinden kayıt incelemeye alınabilir, çözülebilir veya reddedilebilir. İnceleme notu ve sürüm kontrolü zorunludur; değişiklik denetim günlüğüne yazılır. Şikâyeti çözmek ürünü veya hesabı otomatik kapatmaz. İlgili kaydı aç bağlantısı mevcut ürün/hesap moderasyonuna götürür.

Sohbette Mesajlarda engelle iki yönde yeni mesajı durdurur. Eski mesajlar korunur. Engel yalnızca koyan kişi tarafından sohbetten veya Sen → Mesajlarda engellediklerin ekranından kaldırılabilir. Bu işlem mağazayı keşfetten gizlemez.

Sen ve web Studio üzerinden erişilen uygulama içi bildirim kutusu yeni mesaj, kargo güncellemesi ve takip edilen mağazanın yeni ürününü gösterir. Mesaj metni bildirimde yer almaz. Açılan bildirim okunur olarak işaretlenir; eski bildirimler 30 kayıtlık sayfalarla yüklenir. Okunmamış rozet odak/ön plan yenilemesini kullanır. Liste ekran açılışında veya Yenile ile yenilenir.

Bunlar işletim sistemi push bildirimi değildir; uygulama kapalıyken telefon bildirimi gönderilmez. Misafirlerin bildirim kutusu yoktur. Geçmiş olaylar için geriye dönük bildirim üretilmez. Aynı olayın yeniden denenmesi çift bildirim oluşturmaz. Liste ve okunma işlemleri oturum sahibine özeldir.

`009_safety_notifications_shipments.sql` API açılışında uygulanır; SQL Editor sürümü `supabase/setup.sql` içindedir. Otomatik testler sahiplik, mesaj mahremiyeti, engelin iki yönü, idempotency, inceleme sürümü, bildirim sayfalaması ve ayrı gönderim güncellemelerini kapsar.
