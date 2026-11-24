# Project Checklist System

ระบบกำหนดกระบวนการ มอบหมายงาน ติดตามความคืบหน้า และแจ้งเตือน สำหรับงานด้านการพัฒนาบุคลากร (HRD)
ใช้ธีมสีมหาวิทยาลัยขอนแก่น (KKU Maroon `#A73B24`)

> **สถานะปัจจุบัน:** ยกเลิกการเชื่อม Supabase แล้ว และปรับเป็น **Demo แบบ standalone**
> เพื่อใช้สาธิตและเตรียมนำไปเชื่อมกับ **ฐานข้อมูลของมหาวิทยาลัย** ในขั้นต่อไป

## 🌐 Web Demo (GitHub Pages)

เปิดได้ที่ **https://pumisa-cloud.github.io/project/**

- หน้าแนะนำโปรเจกต์: **https://pumisa-cloud.github.io/project/landing.html**
- Demo แบบกดได้ทันที: **https://pumisa-cloud.github.io/project/demo/index.html**
- ทุกคนเปิด URL เดียวกันได้ แต่ **ยังไม่แชร์ข้อมูลกัน** — ข้อมูลเก็บใน `localStorage` ของแต่ละเบราว์เซอร์
- เลือกชื่อผู้ใช้แบบจำลองได้มุมซ้ายล่าง (ไม่มีรหัสผ่าน)
- Deploy อัตโนมัติจาก `main` ผ่าน GitHub Actions (`.github/workflows/deploy.yml`)
- ไฟล์: [`app/index.html`](app/index.html), [`app/landing.html`](app/landing.html)

## 🎯 แผนเชื่อมกับฐานข้อมูลของมหาวิทยาลัย

Demo นี้ใช้โครงสร้างข้อมูลที่ออกแบบไว้แล้ว จึงนำไปปรับต่อได้โดยตรง:

| ส่วน | ไฟล์ | นำไปใช้ยังไง |
|---|---|---|
| ภาพรวมระบบ / กติกา / API | [`design-document.md`](design-document.md) | ใช้เป็นข้อกำหนดตอนจับคู่กับระบบของมหาวิทยาลัย |
| Schema ตัวอย่าง | [`prototype/src/db.js`](prototype/src/db.js) | ตาราง `users`, `templates`, `projects`, `project_steps`, `notifications` ฯลฯ |
| ข้อมูลตัวอย่าง | [`prototype/src/seed.js`](prototype/src/seed.js) | ใช้เป็นข้อมูลทดสอบก่อนเชื่อม DB จริง |
| Express API + Socket.IO | [`prototype/src/server.js`](prototype/src/server.js) | จุดเริ่มต้นสำหรับแทนที่ `localStorage` ด้วย API ฝั่งมหาวิทยาลัย |
| Frontend ตัวอย่าง | [`prototype/web/src/App.jsx`](prototype/web/src/App.jsx) | ถ้าต้องการใช้ React แทนไฟล์ HTML เดี่ยว |

ขั้นตอนที่แนะนำ:

1. ลอง Demo ใน `app/index.html` ให้เข้าใจกติกาการทำงานก่อน
2. เปรียบเทียบตารางใน `prototype/src/db.js` กับ schema ของมหาวิทยาลัย
3. ปรับชื่อตาราง/ฟิลด์ บทบาท และสิทธิ์ให้ตรงกับระเบียบหน่วยงาน
4. แทนที่ `save()` / `loadLocal()` ใน `app/index.html` ด้วยการเรียก API ของมหาวิทยาลัย
5. เพิ่มการล็อกอินด้วยบัญชีมหาวิทยาลัย (ถ้าต้องการ) แทนการเลือกชื่อแบบจำลอง

## 🧪 Demo แบบ standalone อีกชุด

เปิด [`demo/index.html`](demo/index.html) ในเบราว์เซอร์ — เป็นต้นฉบับที่ใช้พัฒนาแอปใน `app/`
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
- [`prototype/src/db.js`](prototype/src/db.js) — โครงสร้างตารางที่ใช้เป็นแม่แบบสำหรับ DB มหาวิทยาลัย
- [`app/index.html`](app/index.html) — Web Demo (localStorage)
- [`app/landing.html`](app/landing.html) — หน้าแนะนำโปรเจกต์
- [`demo/index.html`](demo/index.html) — Interactive demo แบบ standalone
- [`prototype/`](prototype/) — ต้นแบบ Express + SQLite + React
