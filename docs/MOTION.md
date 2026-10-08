# Mikro hareketler

Yeni bağımlılık eklenmedi. React Native Animated kullanılır; transform/opacity native driver ile, yalnızca ölçülen açıklama yüksekliği JS driver ile ilerler. Animasyonlar kullanıcı eylemini bekletmez. Yeni hareketler 80–250 ms aralığındadır, sürekli döngü yoktur. Yeniden tetiklemede önceki hareket durdurulur; unmount temizliği vardır.

- Alt menü: seçili zemin 220 ms'de yeni sekmeye kayar; ikon küçük ölçek ve 4 derece dönüşle geri gelir. Menü yüksekliği 54, dokunma alanı 46 olarak korunur.
- Kaydet: ikon doluluğu 160 ms'de belirir, küçük yaylanma ve mevcut haptic yardımcısıyla kısa geri bildirim. Ürün detayındaki kayıt ikonunda da yaylanma vardır.
- Çanta: adet değişiminde ikon ve rozet tepki verir; ilk rozet görünümünde giriş hareketi vardır.
- Takip: sunucu onayından sonra “Takiptesin ✓”, kısa opaklık ve hafif ölçek geçişi. Aynı düğme takipten çıkarır; ağ hatasında başarı durumu üretilmez.
- Fiyat: basılıyken %4 küçülme, okun 3 px çapraz hareketi; onPress mevcut ürün panelini hemen açar.
- Galeri: aktif çizgi vurgusu 180 ms'de değişir.
- Beden: basma tepkisi, seçili zeminin 170 ms'de belirginleşmesi, seçili metnin küçük yaylanması. Etkinleşen çanta düğmesi hafifçe tepki verir. Swipe beden panelinde basma tepkisi vardır; işlem animasyon için geciktirilmez.
- Öneri açıklaması: gerçek metin yüksekliği ölçülerek 210 ms'de açılır/kapanır; kapalı içerik dokunma ve erişilebilirlik ağacından çıkarılır.

`MotionProvider` native AccessibilityInfo ve web prefers-reduced-motion tercihini izler. Tercih okunana kadar hareket kapalıdır. Hareket azaltıldığında yeni efektler doğrudan son duruma geçer; ölçek/konum hareketi çalışmaz. Eski swipe hareketi kendi mevcut azaltılmış hareket desteğini korur.

7 Ekim 2026: lint/typecheck ve web/iOS/Android export başarılı. Dokunma/kaydırma regresyon testleri 9/9 geçti. Web'de fiyat → detay, beden → çanta, galeri ve takip durumları; iPhone simülatöründe menü ve açıklama açılımı denendi. Fiziksel haptic ve Android cihaz doğrulaması yapılmadı. Sistem azaltılmış hareket tercihi bu tur cihazda değiştirilmedi.

Kaynaklar: https://reactnative.dev/docs/animated ve https://reactnative.dev/docs/accessibilityinfo
