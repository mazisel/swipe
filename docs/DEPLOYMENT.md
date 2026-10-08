# Docker ve Portainer kurulumu

Dağıtım iki konteynerden oluşur: statik Expo web çıktısını sunan **web (Nginx)** ve **api (Node.js/Express)**. Web, `/api/*` isteklerini iç ağdaki API'ye yönlendirir. PostgreSQL ve ürün medyası mevcut Supabase projesinde kalır. Mobil uygulamanın mağaza paketi bu dağıtımdan ayrıdır.

## 1. GitHub imajları

Projeyi kendi GitHub depona gönder. `.env`, `deploy/stack.env`, yerel veritabanları ve yedekler Git'e ve Docker build bağlamına dahil edilmez. Gerçek anahtarları GitHub kaynak dosyalarına yazma.

`main` veya `master` dalına gönderim, `.github/workflows/docker.yml` iş akışını başlatır. Lint, TypeScript ve testler başarılı olunca Linux amd64/arm64 imajları GHCR'a yayımlanır:

```text
ghcr.io/kullanici/depo-api:sha-TAM_COMMIT_SHA
ghcr.io/kullanici/depo-web:sha-TAM_COMMIT_SHA
```

İmaj adındaki kullanıcı/depo küçük harf olmalıdır. İki imajın da yayımlandığını kontrol et. Portainer'da aynı commit etiketini kullan; `latest` değişebilir. İş akışı elle veya `v*` etiketiyle de çalıştırılabilir. Build sırasında Supabase veya Gemini anahtarı gerekmez; yayın için GitHub'ın otomatik `GITHUB_TOKEN` yetkisi kullanılır.

Paketler private ise Portainer → Registries üzerinden `ghcr.io` ekle; yalnızca imaj okumaya yetkili GitHub kimlik bilgisi (`read:packages`) kullan. Private Git deposunu Portainer'a bağlamak için ayrıca depo okuma yetkisi gerekir.

## 2. Portainer Stack

Bu Compose dosyası **Docker Standalone** ortamı içindir; Swarm stack olarak kullanma.

1. Portainer → Stacks → Add stack → Repository seç.
2. GitHub depo adresini, dalı ve Compose path olarak `compose.yaml` gir. Alternatif olarak dosyanın içeriğini Web editor'a yapıştır.
3. Environment variables bölümüne [stack.env.example](../deploy/stack.env.example) alanlarını ekle.
4. `SWIPE_IMAGE_PREFIX=ghcr.io/kullanici/depo`, `SWIPE_TAG=sha-TAM_COMMIT_SHA` ayarla.
5. `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` alanlarına mevcut Supabase bilgilerini gir. `PUBLIC_ORIGIN` dışarıdan kullanılacak adres olmalı: örneğin `https://swipe.example.com` (sonunda `/` veya yol olmadan).
6. Gemini çalışacaksa `GEMINI_API_KEY` gir. Boşsa keşfet çalışır, yeni AI analizi yapılamaz. Bütçe varsayılan olarak aylık 25 USD'dir.
7. Deploy the stack ile başlat; API ve web sağlık durumlarını kontrol et.

Supabase'in public CA sertifikası imajda bulunur. Farklı sertifika zinciri gerekiyorsa `DATABASE_CA_CERT` alanına PEM içeriğini gir. Başlangıç kodu URL'deki SSL parametrelerini kaldırır ve açık CA doğrulaması kullanır. Veritabanı host'una sunucudan ağ erişimi bulunmalıdır.

API açılırken eksik migration'ları uygular. Mevcut Supabase verilerini yeniden aktarma; `SEED_DEMO=false` sayesinde demo katalog tekrar yazılmaz. Güncellemeden önce Supabase yedeği al. Uygulama imajını geri almak veritabanı migration'ını geri almaz.

Kalıcı veri konteynerde tutulmaz: veritabanı Supabase PostgreSQL, yeni yüklemeler Supabase Storage'dadır. Eski `/uploads/` veya `/demo-media/` adresleri olan başka bir kurulum taşınıyorsa önce medya aktarımı tamamlanmalıdır. API eksik bulut anahtarıyla yerel veritabanına sessizce geçmez.

## 3. Alan adı ve HTTPS

Varsayılan yayın `127.0.0.1:8080` üzerindedir. Sunucu üzerinde çalışan HTTPS reverse proxy'yi bu adrese yönlendir. İç API portu 3001 internete açılmaz. `/admin`, `/studio`, `/api/*` ve diğer yollar aynı alan adından çalışır; alan adı değişince web imajını yeniden build etmek gerekmez.

Reverse proxy de konteyner içindeyse onun `127.0.0.1` adresi Swipe sunucusu değildir. Bu durumda ortak Docker ağı veya sunucunun erişilebilir özel IP'si kullanılacak şekilde proxy bağlantısı kurulmalıdır. `SWIPE_BIND_IP` alanını gerekirse bu özel IP yap; dış erişimi firewall/proxy üzerinden sınırla. Sadece yerel HTTP denemesi için `PUBLIC_ORIGIN=http://localhost:8080` kullanılabilir.

Nginx gelen `X-Forwarded-For` değerini doğrudan kabul etmez. Önüne ek bir proxy konduğunda istemciler varsayılan olarak proxy IP'siyle sayılır; IP tabanlı istek limiti ortak olur. Gerçek kurulumda Nginx `set_real_ip_from` ile **yalnızca o proxy'nin güvenilir IP/subnet'i** tanımlanıp `real_ip_header X-Forwarded-For` eklenmelidir. Bu alanları sunucu ağ yapısına göre ayarla; herkesi güvenilir proxy olarak tanımlama.

Mobil release için `EXPO_PUBLIC_API_URL=https://swipe.example.com` kullanılır. Bu değişken yalnızca genel API adresini içerir; veritabanı ve Gemini anahtarları sunucuda kalır.

## 4. Kontrol ve güncelleme

E-posta doğrulama ve şifre sıfırlama için `RESEND_API_KEY`, `MAIL_FROM` ve `PUBLIC_ORIGIN` ayarlarını gir: [Hesap güvenliği rehberi](ACCOUNT_SECURITY.md).

```sh
curl --fail https://swipe.example.com/api/ready
curl --fail https://swipe.example.com/api/health
```

`ready` veritabanına sorgu yapar; bağlantı yoksa ayrıntıları sızdırmadan 503 döner. `/healthz` yalnızca Nginx'in ayakta olduğunu gösterir. Ardından `/admin` girişi, `/studio`, ürün akışı ve kendi test ürününle medya yükleme işlemini dene.

API içindeki AI worker nedeniyle başlangıçta **tek API replikası** kullan. Ayrı `ai:worker` konteyneri başlatma. Kapatma için üç dakikalık süre ayrılmıştır. `CHECKOUT_MODE=demo` gerçek ödeme almaz.

Yeni sürümde GitHub Actions tamamlanınca iki imajın etiketini aynı yeni SHA ile değiştirip stack'i yeniden deploy et. Sorunda önceki SHA'ya dön; migration uyumluluğunu ayrıca değerlendir. Loglar konteyner başına 3 × 10 MB ile döndürülür. `FEED_PERSONALIZED=false` kişiselleştirmeyi kapatır.

## Sunucuda veya yerelde build alternatifi

Docker Engine ve Compose plugin kurulu ortamda:

```sh
cp deploy/stack.env.example deploy/stack.env
# Dosyayı gerçek bilgilerle doldur; yerel imaj için SWIPE_IMAGE_PREFIX=swipe yap.
docker compose --env-file deploy/stack.env -f compose.yaml -f compose.build.yaml config --quiet
docker compose --env-file deploy/stack.env -f compose.yaml -f compose.build.yaml up -d --build
```

`deploy/stack.env` gizlidir ve Git'e alınmaz. Portainer'a normal dağıtımda yalnızca `compose.yaml` verilir; build override gerekmez.

## Doğrulama sınırı

Yerel web export, lint, TypeScript ve uygulama testleri doğrulandı. Hazırlığın yapıldığı Mac'te Docker bulunmadığından gerçek Docker build, Nginx başlangıcı ve Portainer uçtan uca dağıtımı henüz çalıştırılmadı. GitHub Actions imaj derlemesini yapacak; alan adı, TLS ve ağ kontrolleri hedef sunucuda tamamlanmalıdır.
