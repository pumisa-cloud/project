# Project Checklist System

ระบบกำหนดกระบวนการ มอบหมายงาน ติดตามความคืบหน้า และแจ้งเตือน สำหรับงานด้านการพัฒนาบุคลากร (HRD)
ใช้ธีมสีมหาวิทยาลัยขอนแก่น (KKU Maroon `#A73B24`)

## 🌐 แอปสำหรับทีม (แนะนำ)

เปิดได้ที่ **https://pumisa-cloud.github.io/project/**

- ทุกคนในทีมเปิด URL เดียวกัน แล้วเลือกชื่อตัวเอง (ไม่ต้องล็อกอิน)
- ข้อมูลเก็บกลางที่ **Supabase (Postgres)** และอัปเดตแบบ **realtime** ให้ทุกคนเห็นตรงกัน
- Deploy อัตโนมัติจาก `main` ผ่าน GitHub Actions (`.github/workflows/deploy.yml`)
- หน้าแนะนำโปรเจกต์: **https://pumisa-cloud.github.io/project/landing.html**
- ไฟล์: [`app/index.html`](app/index.html), [`app/landing.html`](app/landing.html)
- ตั้งค่า Supabase: [`supabase/README.md`](supabase/README.md)

> ถ้ายังไม่ได้ใส่ URL/anon key ของ Supabase แอปจะทำงานใน **โหมดท้องถิ่น** (เก็บใน `localStorage`)
> และแสดงแถบตั้งค่าสีเหลือง — ดูวิธีเชื่อมได้ที่ [`supabase/README.md`](supabase/README.md)

## 🧪 Demo แบบกดได้ทันที (ไม่ต้องติดตั้งอะไร)

เปิด [`demo/index.html`](demo/index.html) ในเบราว์เซอร์ — ข้อมูลจำลองเก็บใน `localStorage`
ดูวิธีทดสอบได้ที่ [`demo/README.md`](demo/README.md)

## 🛠 ต้นแบบ API จริง (Express + SQLite + Socket.IO)

```bash
cd prototype
npm install
npm run seed
npm run dev
```

จากนั้นเปิด frontend:

```bash
cd prototype/web
npm install
npm run dev
```

รายละเอียดอยู่ที่ [`prototype/README.md`](prototype/README.md)

## เอกสาร

- [`design-document.md`](design-document.md) — ภาพรวมระบบ บทบาท กติกา Data model และ API
- [`supabase/schema.sql`](supabase/schema.sql) — Schemaฐานข้อมูลสำหรับแอปทีม
- [`app/index.html`](app/index.html) — แอปทีม (Supabase + Realtime)
- [`demo/index.html`](demo/index.html) — Interactive demo แบบ standalone
- [`prototype/`](prototype/) — ต้นแบบ Express + SQLite + React
