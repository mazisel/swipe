# Supabase SQL kurulumu

1. Supabase projesinde **SQL Editor → New query** açın.
2. `setup.sql` dosyasının tamamını yapıştırıp proje sahibi/postgres rolüyle çalıştırın.
3. Sonuçta `001_marketplace.sql` ile `006_admin.sql` arasındaki altı migration görünmelidir.

Dosya kullanıcılar, ürünler, siparişler, yorumlar, değerlendirmeler, DM, keşfet olayları, pgvector vektörleri, AI bütçesi, medya kayıtları, takipler ve beğenileri kurar. Uygulamanın migration geçmişini de kaydeder; Express açılışında aynı tablolar tekrar oluşturulmaz. Yeniden çalıştırıldığında uygulanmış migration'lar atlanır. İşlem tek transaction'dır.

`swipe` özel şemadır. Data API exposed schemas listesine eklemeyin. Erişim Express üzerinden mevcut oturum sistemiyle yapılır; bu dosya Supabase Auth'a geçiş yapmaz ve tarayıcı rollerine erişim açmaz.

Ardından sunucunun `.env` dosyasında `.env.example` örneğine göre `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ve `SUPABASE_STORAGE_BUCKET=product-media` ayarlayın. Bu değerleri istemciye koymayın. Storage bucket ilk medya yüklemesinde mevcut sunucu kodu tarafından oluşturulur; SQL dosyası Storage'ın sistem tablolarını değiştirmez.

Bu dosya yalnızca şema kurar. Yerel PostgreSQL'deki güncel kullanıcı ve ürünleri buluta taşımaz; veri aktarımı ayrı yapılmalıdır. Gemini bağlantısı için ayrıca `GEMINI_API_KEY` gerekir.

Migration değişirse dosyayı `node scripts/build-schema.mjs` ile yeniden üretin; üretilen SQL'i elle değiştirmeyin.
