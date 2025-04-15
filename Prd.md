Teknolojiler:

- React
- Next.js
- Tailwind CSS
- Shadcn UI
- TypeScript
- Mangodb
- Node.js
- Express
- JWT

Web Uygulaması PSD Tasarım Planı

1. Admin Paneli Sayfaları

1.1. Giriş Sayfası (Login Page)

Kullanıcı Adı (Email) Input

Şifre Input

Giriş Yap Butonu

Şifremi Unuttum Linki

1.2. Öğretmen Oluşturma Sayfası

Adı (Input)

Soyadı (Input)

İxtisasi (Input)

Elmi Derecesi (Input)

Email (Input)

Şifre (Input)

Kaydet Butonu

Öğretmen Listesi (Tablo Şeklinde, Sil & Düzenle Butonları ile)

1.3. Ders Yeri Oluşturma Sayfası

Ders Yeri (Input)

Açıklama (Textarea)

Kaydet Butonu

Ders Yeri Listesi (Tablo Şeklinde, Sil & Düzenle Butonları ile)

1.4. Ders Oluşturma Sayfası

Ders İsmi (Input)

Açıklama (Textarea)

Kaydet Butonu

Ders Listesi (Tablo Şeklinde, Sil & Düzenle Butonları ile)

1.5. Ders Tipi Oluşturma Sayfası

Ders Tipi (Input)

Açıklama (Textarea)

Kaydet Butonu

Ders Tipi Listesi (Tablo Şeklinde, Sil & Düzenle Butonları ile)

1.6. Ders Planlama Sayfası

Öğretmen Seç (Select Dropdown)

Ders Yeri Seç (Select Dropdown)

Ders Seç (Select Dropdown)

Konu (Input)

Başlangıç Tarihi (Date-Time Picker: Yıl, Ay, Gün, Saat, Dakika)

Bitiş Tarihi (Date-Time Picker: Yıl, Ay, Gün, Saat, Dakika)

Kaydet Butonu

Çakışma Kontrolü (Eğer öğretmenin aynı gün/saatte dersi varsa uyarı mesajı)

Ders Listesi (Tablo Şeklinde, Sil & Düzenle Butonları ile)

2. Öğretmen Paneli Sayfaları

2.1. Öğretmen Giriş Sayfası

Kullanıcı Adı (Email) Input

Şifre Input

Giriş Yap Butonu

JWT Token ile Kimlik Doğrulama

2.2. Öğretmen Bilgi Sayfası

Profil Resmi (Varsa)

Adı Soyadı

İxtisasi

Elmi Derecesi

Email

Ders Programına Git Butonu

2.3. Ders Programı (Haftalık Takvim - Grafik Gösterimi)

Günlük Dersler (Pazartesi - Pazar)

Saat Dilimleri (Her saat dilimi ayrı kutucukta gösterilecek)

Dersler Saat Dilimine Göre Renk Kodları ile Gösterilecek:

Yeşil: Normal Ders

Sarı: Pratik Ders

Kırmızı: Sınav

Geçmiş & Gelecek Haftalara Git Butonları (Önceki & Sonraki Hafta)

Üzerine Tıklanınca Ders Detaylarının Açıldığı Modal Penceresi:

Ders Adı

Öğretmen Adı

Ders Yeri

Başlangıç ve Bitiş Saati

Açıklama

Ders Tipi

3. Genel UI/UX Tasarım Önerileri

Ana Renk: Mavi (#007BFF)

Arka Plan: Açık Gri (#F8F9FA)

Başlık Fontu: Roboto Bold

Metin Fontu: Roboto Regular

Butonlar: Yuvarlatılmış Kenar, Hover Etkisi

Tablolar: Alternatif Satır Renklendirmesi

Modal: Gölgelendirme Efekti ve Kapat Butonu