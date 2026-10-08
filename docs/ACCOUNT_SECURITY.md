# E-posta doğrulama ve şifre sıfırlama

Alıcı profilinde, Studio girişinde ve admin girişinde **Şifremi unuttum** bulunur. Giriş yapan kullanıcı profilinden veya Studio'dan e-posta doğrulama isteyebilir. Mevcut hesaplar otomatik doğrulanmış sayılmaz; bu sürümde doğrulama girişe veya alışverişe zorunlu tutulmaz.

## Resend kurulumu

Portainer stack ortam değişkenlerine şunları gir:

```dotenv
RESEND_API_KEY=
MAIL_FROM=Swipe <hesap@dogrulanmis-alanin.com>
PUBLIC_ORIGIN=https://oguzart.store
```

`MAIL_FROM` Resend üzerinde doğruladığın alana ait olmalı. API anahtarı yalnızca API konteynerinde kullanılır; `EXPO_PUBLIC_*` alanına yazılmaz. `PUBLIC_ORIGIN` HTTPS olmalı ve yol içermemeli. Yerel geliştirmede localhost HTTP desteklenir. İlgili alanlar `compose.yaml`, `.env.example` ve `deploy/stack.env.example` içine eklendi.

İmajları güncelledikten sonra stack'i yeni ortam değişkenleriyle yeniden oluştur. Başlangıçta `007_account_security.sql` uygulanır; eski hesaplar, roller ve şifreler korunur. Canlı sunucuda aynı Supabase kullanıldığı için migration daha önce uygulanmışsa atlanır.

Alanlar eksik/geçersizse gönderim kapalıdır ve arayüz bunu bildirir. E-posta şablonu düz metin Türkçedir; Resend `/emails` API'si ve gönderime özel idempotency anahtarı kullanılır. Resend alan ayarlarında bu güvenlik e-postaları için tıklama/açılma takibini kapat; bağlantıları değiştiren izleme katmanı kullanma.

## Güvenlik davranışı

- 32 rastgele baytlık bağlantı belirteçleri SHA-256 özeti olarak tutulur. Ham değer yalnızca gönderim sırasında ve kullanıcının e-postasında bulunur; loglanmaz.
- Şifre bağlantısı 30 dakika, doğrulama bağlantısı 24 saat geçerlidir. GET isteği işlem yapmaz; kullanıcı düğmeye basmalıdır. E-posta tarayıcıları bağlantıyı tüketemez.
- Bağlantı belirteci URL fragment'ında taşınır, proxy HTTP erişim loguna gitmez; ekran açılınca URL'den çıkarılır ve bellekte tutulur. Sayfa yenilenirse e-postadaki bağlantı tekrar açılmalıdır.
- Her işlemde kullanıcı kilidi, token türü, e-posta eşleşmesi, süre ve kullanım kontrolü vardır. Başarıda aynı kullanıcının aynı amaçlı diğer bağlantıları da tüketilir.
- Şifre sıfırlama bütün sunucu oturumlarını siler; otomatik giriş yapmaz. Giriş ve şifre değişimi aynı kullanıcı satırını kilitler, eşzamanlı eski şifreyle yeni oturum açılması önlenir.
- Bilinmeyen, askıya alınan, gönderimi başarısız olan veya tekrar istekte bulunan e-postalara aynı genel yanıt verilir. Sağlayıcının 10 saniyelik zaman aşımını kapsayan en az 11 saniyelik yanıt penceresi kullanılır; ağ/veritabanı gecikmeleri yine değişebilir.
- IP başına 15 dakikada 15 işlem; hesap ve işlem türü başına dakikada 1, günde 5 gönderim denemesi sınırı vardır. IP sayımının doğru olması için HTTPS proxy'nin güvenilir IP ayarı gerekir (dağıtım rehberi).
- Token kayıtlarında e-posta ve kullanım tarihi bulunur; Data API üzerinden sunulmaz. Ham sağlayıcı hataları istemciye veya loga aktarılmaz. Süresi dolmuş token kayıtları için uzun vadeli saklama/temizleme politikası ayrıca belirlenmelidir.

## Doğrulama

Testlerde dışarı e-posta gönderilmez; enjekte edilen mailer ile eksik hesap yanıtı, ham token saklanmaması, yanlış amaç, süre sonu, tekrar kullanım, eşzamanlı tüketim, gönderim aralığı ve oturum iptali doğrulanır. Resend isteğinin alanları da sahte fetch ile kontrol edilir. Web ekranları yerelde incelendi; üç platform için export alındı. Gerçek Resend teslimatı ve fiziksel cihazdaki e-posta bağlantısı, yapılandırma sonrası ayrıca denenmelidir.

Kaynaklar: [Resend gönderim API'si](https://resend.com/docs/api-reference/emails/send-email), [OWASP şifre sıfırlama rehberi](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
