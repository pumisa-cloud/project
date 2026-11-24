# Project Checklist System

ระบบกำหนดกระบวนการ มอบหมายงาน ติดตามความคืบหน้า และแจ้งเตือน สำหรับงานด้านการพัฒนาบุคลากร (HRD)
ใช้ธีมสีมหาวิทยาลัยขอนแก่น (KKU Maroon `#A73B24`)

## เริ่มต้นใช้งาน

### Demo แบบกดได้ทันที (ไม่ต้องติดตั้งอะไร)

เปิด `demo/index.html` ในเบราว์เซอร์ — ข้อมูลจำลองเก็บใน `localStorage`
ดูวิธีทดสอบได้ที่ [`demo/README.md`](demo/README.md)

### ต้นแบบ API จริง (Express + SQLite + Socket.IO)

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
- [`demo/index.html`](demo/index.html) — Interactive demo
- [`prototype/`](prototype/) — ต้นแบบ Express + SQLite + React
