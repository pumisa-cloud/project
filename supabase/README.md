# เชื่อมแอปกับ Supabase (โหมดทีม)

แอปใน `app/index.html` รองรับ 2 โหมด:

| โหมด | เงื่อนไข | ข้อมูลเก็บที่ |
|---|---|---|
| **ทีม (แนะนำ)** | ตั้งค่า Supabase แล้ว | Postgres กลาง + realtime ทุกคนเห็นตรงกัน |
| ท้องถิ่น | ยังไม่ได้ตั้งค่า | `localStorage` เฉพาะเบราว์เซอร์ (เหมือน demo) |

ตอนยังไม่ได้ตั้งค่า แอปจะแสดงแถบสีเหลือง **"โหมดท้องถิ่น"** พร้อมปุ่มตั้งค่า

## ติดตั้ง (ทำครั้งเดียว)

1. สมัคร/ล็อกอิน [Supabase](https://supabase.com/dashboard) แล้ว **New project**
   - เลือก region ใกล้ทีม (เช่น Singapore)
   - ตั้งรหัส DB ที่ปลอดภัย

2. เปิด **SQL Editor → New query** แล้ววางเนื้อหาทั้งไฟล์ [`schema.sql`](schema.sql) แล้วกด Run
   - สคริปต์สร้าง 8 ตาราง, realtime publication, index และ policy
   - รันซ้ำได้ (ใช้ `if not exists` / `drop policy if exists`)

3. ไป **Project Settings → API** แล้วคัดลอก
   - `Project URL` → `https://xxxx.supabase.co`
   - `anon public` key → `eyJhbGci...` (**ไม่ใช้** `service_role`)

4. แก้ [`../app/config.js`](../app/config.js):

   ```js
   window.SUPABASE_URL = 'https://xxxx.supabase.co'
   window.SUPABASE_ANON_KEY = 'eyJhbGci...'
   ```

5. `git add . && git commit -m "Connect Supabase" && git push`
   → GitHub Actions จะ deploy ให้ที่ **https://pumisa-cloud.github.io/project/**

> ทางลัดสำหรับทดสอบในเครื่อง: กด **ตั้งค่า Supabase** ในแถบสีเหลืองของแอป แล้วใส่ URL/key
> (ค่านี้เก็บในเบราว์เซอร์นั้นเท่านั้น — ถ้าอยากให้ทั้งทีมได้ ให้แก้ `config.js` แล้ว commit ตามข้อ 4)

## วิธีใช้ร่วมกัน

- ทุกคนเปิด URL เดียวกัน แล้ว **เลือกชื่อตัวเอง** มุมซ้ายล่าง (ไม่มีรหัสผ่าน ตามที่ทีมต้องการ)
- เมื่อมีคนเปลี่ยนสถานะ/มอบหมายงาน/เพิ่ม checklist → ข้อมูลบันทึกกลาง Supabase
  และหน้าของคนอื่น **อัปเดตอัตโนมัติแบบ realtime**
- ปุ่ม **รันสแกนกำหนดเวลา** จำลอง cron 08:00 น. (ใครกดก็ได้ ระบบ dedupe ด้วย `dedupe` key)
- ปุ่ม **รีเซ็ตข้อมูลตัวอย่าง** จะล้างข้อมูลของทั้งทีม (ใช้ด้วยความระวัง)

## ⚠️ หมายเหตุเรื่องสิทธิ์

ตามที่เลือก **"เลือกชื่อผู้ใช้แบบ demo"** ระบบจึง **ไม่มี login** และใช้ anon key
พร้อม policy `using (true) with check (true)` → **ใครมี URL ก็แก้ข้อมูลได้**

เหมาะสำหรับทีมภายในที่เชื่อใจกันและไม่เปิดเผย URL สาธารณะ
ถ้าต้องการสิทธิ์แยกจริง ต้องเพิ่ม Supabase Auth + ปรับ policy ตาม `user_id` (สามารถทำเพิ่มได้ภายหลัง)

## โครงสร้างตาราง

| ตาราง | เก็บ |
|---|---|
| `users` | ชื่อ บทบาท แผนก การตั้งค่าแจ้งเตือน |
| `templates` / `template_steps` | แม่แบบกระบวนการและขั้นตอน |
| `projects` / `project_steps` | โครงการ ขั้นตอน ผู้รับผิดชอบ กำหนดส่ง |
| `checklist_items` | รายการย่อยในแต่ละขั้นตอน |
| `activity` | Audit trail |
| `notifications` | การแจ้งเตือนในแอป + กุญแจกันซ้ำ (dedupe) |
