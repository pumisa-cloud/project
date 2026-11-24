# ระบบเช็คลิสต์สำหรับการดำเนินโครงการ (Project Checklist System)

## 1. ภาพรวม (Overview)

ระบบช่วยให้ทีมสามารถ:

- สร้าง**แม่แบบกระบวนการ (Process Template)** ที่กำหนดขั้นตอนมาตรฐานของโครงการ
- นำแม่แบบไปใช้กับ**โครงการ (Project)** จริง พร้อมกำหนด**ผู้รับผิดชอบ (Assignee)** และกำหนดส่ง (Due date) ต่อขั้นตอน
- **ติดตามความคืบหน้า** ของแต่ละโครงการและแต่ละขั้นตอน
- **แจ้งเตือน** ผ่านในแอป (in-app) และอีเมล เมื่อถึงกำหนด ส่งงาน หรือเลยกำหนด

---

## 2. บทบาทผู้ใช้ (Roles)

| บทบาท | สิทธิ์ |
|---|---|
| Admin | จัดการผู้ใช้, จัดการแม่แบบกระบวนการ (Process Template), ตั้งค่าการแจ้งเตือนทั้งระบบ |
| Project Manager (PM) | สร้างโครงการจากแม่แบบ, กำหนดผู้รับผิดชอบ, ดูรายงาน, ปิดโครงการ |
| Member | ดูและอัปเดตสถานะขั้นตอนที่ได้รับมอบหมาย, แนบหลักฐาน |
| Viewer | ดูอย่างเดียว (ผู้บริหาร/ผู้ตรวจสอบ) |

---

## 3. โมดูลหลัก (Core Modules)

### 3.1 Process Template (แม่แบบกระบวนการ)
- ชื่อแม่แบบ, คำอธิบาย, ประเภทโครงการ (เช่น HR Development / Onboarding / IT)
- ลำดับขั้นตอน (Steps) แบบเรียงลำดับหรือขนาน
- แต่ละขั้นตอนมี: ชื่อ, คำอธิบาย, ระยะเวลาโดยประมาณ (วัน), บทบาทผู้รับผิดชอบตามค่าเริ่มต้น, รายการเอกสาร/หลักฐานที่ต้องแนบ, ขั้นตอนก่อนหน้า (dependency)
- รองรับเวอร์ชัน (versioning) เพื่อไม่ให้กระทบโครงการที่รันอยู่

### 3.2 Project (โครงการ)
- สร้างจากแม่แบบ → ระบบสร้างขั้นตอนทั้งหมดให้อัตโนมัติ
- ข้อมูล: ชื่อโครงการ, รหัส, PM, วันเริ่ม, วันสิ้นสุดเป้าหมาย, งบประมาณ, สถานะ (Draft/Active/On Hold/Completed/Cancelled)
- กำหนดผู้รับผิดชอบจริงต่อขั้นตอน + กำหนดส่งจริง

### 3.3 Checklist / Step (ขั้นตอน)
- สถานะ: `Not Started` → `In Progress` → `Blocked` → `Done` (มี `Skipped`)
- ต้องมีหลักฐาน (attachment/note) ถ้าขั้นตอนบังคับ
- บันทึกประวัติการเปลี่ยนสถานะ (audit trail): ใคร เปลี่ยนอะไร เมื่อไร
- Checklist ย่อย (sub-tasks) ภายในขั้นตอนได้

### 3.4 Dashboard & Tracking
- **ภาพรวมโครงการ**: % ความคืบหน้า, จำนวนขั้นตอนเลยกำหนด, ขั้นตอนถัดไป
- **มุมมอง Kanban**: ลาก-วางเปลี่ยนสถานะ
- **มุมมอง Gantt**: เห็น timeline และ dependency
- **รายงาน**: สถิติตามผู้รับผิดชอบ, ตามแผนก, อัตราการส่งตรงเวลา

### 3.5 Notification (การแจ้งเตือน)
| ประเภท | ทริกเกอร์ | ช่องทาง |
|---|---|---|
| Assigned | มีการมอบหมายขั้นตอนให้ผู้ใช้ | in-app + email |
| Due Soon | ก่อนกำหนดส่ง 3 วัน / 1 วัน | in-app + email |
| Overdue | เลยกำหนดส่ง | in-app + email + แจ้ง PM |
| Status Changed | ผู้รับผิดชอบเปลี่ยนสถานะขั้นตอน | in-app + email ให้ PM |
| Comment / Mention | มีการกล่าวถึงหรือคอมเมนต์ | in-app + email |
| Project Milestone | ถึง milestones สำคัญ | in-app + email |

- ผู้ใช้ตั้งค่าได้ว่าอยากรับช่องทางใด (notification preferences)
- มีศูนย์รวมการแจ้งเตือน (notification center) พร้อมป้าย unread
- อีเมลส่งผ่าน SMTP / SendGrid / Azure Communication Services
- ตัวจัดตาราง (scheduler/cron) ตรวจ due soon/overdue ทุกวัน เช่น 08:00 น.

---

## 4. โครงสร้างข้อมูล (Data Model)

```
User
  id, name, email, role, department, notification_prefs

ProcessTemplate
  id, name, description, category, version, is_active, created_by

TemplateStep
  id, template_id, order_index, name, description,
  default_duration_days, default_role, requires_attachment,
  depends_on_step_id

Project
  id, code, name, template_id, template_version,
  manager_id, start_date, target_end_date, budget, status

ProjectStep  (instance ของ TemplateStep)
  id, project_id, template_step_id, order_index, name, description,
  assignee_id, due_date, status, completed_at, requires_attachment,
  depends_on_step_id, progress_percent

StepChecklistItem
  id, project_step_id, label, is_done, order_index

Attachment
  id, project_step_id, file_name, url, uploaded_by, uploaded_at

Comment
  id, project_step_id, author_id, body, created_at

ActivityLog
  id, project_id, project_step_id, actor_id, action,
  from_value, to_value, created_at

Notification
  id, user_id, type, title, body, link,
  is_read, channel, created_at, sent_at
```

ความสัมพันธ์หลัก:
- `ProcessTemplate 1—N TemplateStep`
- `Project N—1 ProcessTemplate`
- `Project 1—N ProjectStep` (คัดลอกจาก TemplateStep ตอนสร้างโครงการ)
- `ProjectStep 1—N StepChecklistItem / Attachment / Comment`
- `User 1—N Notification`

---

## 5. สถาปัตยกรรม (Architecture)

```
┌────────────────┐      REST/JSON      ┌──────────────────┐
│  React Web App │ ──────────────────▶ │  Node.js API     │
│  (Vite + TS)   │ ◀────────────────── │  (Express)       │
└────────────────┘      WebSocket      └────────┬─────────┘
        ▲               (แจ้งเตือน realtime)     │
        │                                        ▼
        │                               ┌──────────────────┐
        └──── in-app notifications ─────│  Database        │
                                        │  (SQLite dev /   │
                                        │   PostgreSQL)    │
                                        └──────────────────┘
                                                 │
                                        ┌────────▼─────────┐
                                        │ Notification      │
                                        │ Worker (cron)     │
                                        │  - due soon       │
                                        │  - overdue        │
                                        │  - email (SMTP)   │
                                        └──────────────────┘
```

- **Frontend**: React + TypeScript + Vite, React Router, state ด้วย React Query
- **Backend**: Node.js + Express (REST), Prisma ORM
- **Realtime**: Socket.IO สำหรับ in-app notification
- **Scheduler**: node-cron ตรวจ due soon/overdue
- **Email**: nodemailer (SMTP) — ต้นแบบใช้ "dry-run" log แทนการส่งจริง

---

## 6. API หลัก (Endpoints)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/templates` | รายการแม่แบบกระบวนการ |
| POST | `/api/templates` | สร้างแม่แบบ |
| GET | `/api/templates/:id` | รายละเอียดแม่แบบพร้อมขั้นตอน |
| GET | `/api/projects` | รายการโครงการ (มี % ความคืบหน้า) |
| POST | `/api/projects` | สร้างโครงการจากแม่แบบ (สร้าง steps อัตโนมัติ) |
| GET | `/api/projects/:id` | รายละเอียดโครงการ + steps |
| PATCH | `/api/projects/:id` | อัปเดตข้อมูลโครงการ |
| PATCH | `/api/steps/:id` | อัปเดตสถานะ/ผู้รับผิดชอบ/กำหนดส่ง |
| POST | `/api/steps/:id/comments` | คอมเมนต์ |
| GET | `/api/notifications` | การแจ้งเตือนของผู้ใช้ |
| POST | `/api/notifications/:id/read` | ทำเครื่องหมายอ่านแล้ว |
| GET | `/api/dashboard` | สรุปภาพรวม |

การเปลี่ยนสถานะ step จะทริกเกอร์: บันทึก ActivityLog → อัปเดต progress โครงการ → สร้าง Notification ให้ PM

---

## 7. ผังหน้าจอ (Screens)

1. **Dashboard** — การ์ดสรุป (โครงการที่รันอยู่, เลยกำหนด, งานของฉัน), รายการงานใกล้ถึงกำหนด
2. **Projects list** — ตารางโครงการ + ความคืบหน้า + สถานะ
3. **Project detail** — (ก) Checklist view เรียงขั้นตอน (ข) Kanban (ค) Gantt, แถบความคืบหน้า, ผู้รับผิดชอบต่อขั้นตอน
4. **Process Template detail** — จัดลำดับ/แก้ไขขั้นตอน
5. **My Tasks** — รวมงานที่มอบหมายให้ฉันทุกโครงการ
6. **Notification center** — รายการแจ้งเตือน + ตั้งค่า preferences

**Theme:** ใช้สีประจำมหาวิทยาลัยขอนแก่น (KKU Maroon `#A73B24` / `rgb(167, 59, 36)`) เป็นสีหลัก
พร้อมสีเสริมทอง `#D9A441` สำหรับแถบแจ้งเตือนและสถานะยังไม่บันทึก ปรับผังหน้าจอให้รองรับมือถือ (responsive)

---

## 8. กติกาการทำงาน (Business Rules)

1. ขั้นตอนที่ `depends_on_step_id` ยังไม่ Done → ไม่ให้เริ่มขั้นตอนถัดไป (แสดงเป็น "Blocked by dependency")
2. ขั้นตอนที่ `requires_attachment` ต้องมีไฟล์/โน้ตก่อนตั้งเป็น Done
3. เลย `due_date` แล้วยังไม่ Done → ระบบตั้งสถานะเป็น Overdue อัตโนมัติ และแจ้งเตือน
4. เมื่อทุกขั้นตอน Done → โครงการเปลี่ยนเป็น Completed อัตโนมัติ
5. Progress % ของโครงการ = ขั้นตอน Done ÷ ขั้นตอนทั้งหมด (ถ่วงน้ำหนักได้)

---

## 9. แผนการพัฒนา (Roadmap)

| เฟส | ขอบเขต |
|---|---|
| MVP | แม่แบบ, โครงการ, checklist, สถานะ, dashboard, แจ้งเตือน in-app + อีเมล (dry-run) |
| เฟส 2 | Kanban/Gantt, แนบไฟล์, คอมเมนต์/@mention, realtime socket |
| เฟส 3 | สิทธิ์ละเอียด, รายงานเชิงวิเคราะห์, เชื่อม Teams/LINE, มือถือ |

---

ดูคู่มือการรันต้นแบบได้ที่ `prototype/README.md`
ดู **demo ที่กดได้ทันทีโดยไม่ต้องติดตั้ง Node.js** ได้ที่ `demo/index.html` (คู่มือ: `demo/README.md`)
