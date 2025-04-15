# Tedris Journal Application

Bu proje, öğretmen ders programı yönetim sistemi için geliştirilmiştir.

## Teknolojiler

### Backend
- Node.js
- Express
- MongoDB
- JWT Authentication
- Mongoose

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI
- Redux Toolkit
- React Hook Form
- Axios

## Kurulum

### Backend Kurulumu

1. Backend klasörüne girin:
```bash
cd backend
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. `.env` dosyasını yapılandırın (örnek dosya mevcuttur)

4. Sunucuyu geliştirme modunda başlatın:
```bash
npm run dev
```

### Frontend Kurulumu

1. Frontend klasörüne girin:
```bash
cd web
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. `.env.local` dosyasını yapılandırın (örnek dosya mevcuttur)

4. Uygulamayı geliştirme modunda başlatın:
```bash
npm run dev
```

5. Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## Özellikler

- Admin ve öğretmen kullanıcı rolleri
- Öğretmen yönetimi
- Ders planlaması
- Ders yeri yönetimi
- Ders tipi yönetimi
- Haftalık takvim görünümü
- JWT ile kimlik doğrulama

## Mimari

- Backend: MVC mimarisi
- Frontend: Komponent tabanlı mimari
- State Yönetimi: Redux Toolkit
- API İletişimi: Axios 