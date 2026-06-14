# 🎬 Letterboxd Wrapped - Outbound Desktop Scrape Worker Kurulum Kılavuzu

Bu kılavuz, Render üzerinde çalışan bulut backend sunucusunun (datacenter IP engellemelerinden kaçınmak için) ağır kazıma (scraping) ve TMDB analiz işlemlerini yerel makinenize (evdeki masaüstü bilgisayara) yönlendirmesini sağlayan **Outbound Desktop Scrape Worker** sisteminin kurulumunu ve otomatik başlatılmasını adım adım anlatmaktadır.

---

## 🛠️ Ön Gereksinimler

1. **Python 3.11+** (Windows üzerinde yüklü olmalı ve PATH değişkenine eklenmiş olmalıdır).
2. **Git** (Projeyi clone etmek ve güncellemek için).
3. **Render Backend Hesabı** (Ortam değişkenlerini yapılandırmak için).

---

## 🚀 Adım Adım Kurulum

### Adım 1: Repo Kurulumu ve Güncelleme
Masaüstünüzde PowerShell veya Windows Terminal açıp aşağıdaki komutlarla projeyi çekin ve `desktop_server` branch'ine geçiş yapın:

```powershell
cd $HOME\Desktop
# Eğer repo daha önce klonlanmadıysa:
git clone https://github.com/SemihMutlu07/letterboxd_wrapped.git
cd letterboxd_wrapped
git checkout desktop_server

# Eğer zaten klonlanmış durumdaysa:
git fetch origin
git checkout desktop_server
git pull origin desktop_server
```

---

### Adım 2: Sanal Ortam (venv) ve Bağımlılıkların Kurulumu
`backend/` klasörüne girip Python sanal ortamını oluşturun ve gerekli kütüphaneleri yükleyin:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

### Adım 3: Yerel `.env` Yapılandırması
`backend/` dizini altında `.env` adında bir dosya oluşturun ve içerisine aşağıdaki değişkenleri yerleştirin:

```env
TMDB_API_KEY=BURAYA_TMDB_API_ANAHTARINIZ
WORKER_TOKEN=6Wx94TugetHURiGobm_8VYsmrBpeEJjzAdBcV71aI27o2br9NraubNqv2cWDAfil
WORKER_BACKEND_URL=https://wrapped-backend.onrender.com
```

> [!WARNING]
> `.env` dosyası içerisinde kesinlikle `SCRAPER_API_KEY` değişkenini **tanımlamayın (boş bile bırakmayın)**. Sistem yerel IP adresiniz üzerinden kazıma yapacaktır.

---

### Adım 4: Render Tarafının Yapılandırılması (Çok Önemli)
Masaüstündeki worker'ın backend ile güvenli haberleşebilmesi ve backend'in iş kuyruğu modunu aktif edebilmesi için:

1. **Render Dashboard**'a girin.
2. Backend servisinize (`wrapped-backend` veya ilgili servis) tıklayın.
3. **Environment** sekmesine gidin.
4. Yeni bir environment variable ekleyin:
   * **Key:** `WORKER_TOKEN`
   * **Value:** `6Wx94TugetHURiGobm_8VYsmrBpeEJjzAdBcV71aI27o2br9NraubNqv2cWDAfil` *(Masaüstündeki token ile birebir aynı olmalıdır).*
5. Ayarları kaydedin ve servisinizi **Redeploy** edin.

---

### Adım 5: Manuel Başlatma ve Doğrulama
Hâlâ `backend/` klasöründeyken terminalde şu komutu çalıştırarak worker'ı başlatın:

```powershell
set PYTHONUTF8=1
python -m app.worker.desktop_scrape_worker
```

**Başarılı Çalışma Belirtileri:**
* Terminal loglarında `Desktop scrape worker starting — backend=https://wrapped-backend.onrender.com...` görünmelidir.
* `heartbeat sent` ve `polling jobs` logları gelmelidir.
* Eğer `401` hatası alıyorsanız, Render'daki `WORKER_TOKEN` ile yerel `.env` içindeki değer uyuşmuyor demektir.
* Eğer `404` alıyorsanız, Render backend'inize `desktop_server` branch'indeki kodlar henüz başarıyla deploy edilmemiştir.

---

### Adım 6: Çalıştırma Betiği (BAT) Oluşturma
Çift tıklayarak kolayca başlatabilmek için masaüstünüzde `start_letterboxd_worker.bat` adında bir dosya oluşturup içine şunları yazın:

```bat
@echo off
set PYTHONUTF8=1
cd /d "%USERPROFILE%\Desktop\letterboxd_wrapped\backend"
call .venv\Scripts\activate.bat
python -m app.worker.desktop_scrape_worker
pause
```

---

### Adım 7: Windows Açılışında Otomatik Başlatma (Task Scheduler)
Sistemin kesintisiz çalışması için bilgisayar açıldığında bu betiği otomatik çalışacak şekilde ayarlayın:

1. Başlat menüsüne **Task Scheduler (Görev Zamanlayıcı)** yazıp açın.
2. Sağdaki eylemler menüsünden **Create Basic Task (Temel Görev Oluştur)** seçin.
3. **Name (Ad):** `Letterboxd Desktop Worker`
4. **Trigger (Tetikleyici):** *When I log on* (Oturum açtığımda).
5. **Action (Eylem):** *Start a program*.
6. **Program/Script:** `C:\Users\semih\Desktop\start_letterboxd_worker.bat` (Oluşturduğunuz bat dosyasının tam yolunu seçin).
7. Görev oluştuktan sonra listeden bulup sağ tıklayın ve **Properties (Özellikler)** penceresini açın:
   * **General (Genel) Sekmesi:** *"Run only when user is logged on"* ve *"Run with highest privileges"* kutucuklarını işaretleyin.
   * **Settings (Ayarlar) Sekmesi:** *"If the task fails, restart every: 1 minute"* ve *"Attempt to restart up to: 3 times"* seçeneklerini açın.
8. Kaydedip kapatın. Artık sisteminiz her açıldığında worker arka planda hazır olacaktır!
