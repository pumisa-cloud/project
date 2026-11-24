-- ============================================================
-- Project Checklist — Supabase schema
-- โหมดทีม: ไม่มี login แอปใช้ anon key + policy แบบเปิด (เหมาะทีมภายในที่เชื่อใจกัน)
-- รัน SQL นี้ทั้งไฟล์ใน Supabase SQL Editor ครั้งเดียวได้ (ปลอดภัยต่อการรันซ้ำ)
-- ============================================================

create table if not exists users (
  id integer primary key,
  name text not null,
  role text not null,
  department text,
  inapp boolean not null default true,
  email boolean not null default true
);

create table if not exists templates (
  id integer primary key,
  name text not null,
  category text,
  description text,
  version integer not null default 1
);

create table if not exists template_steps (
  id text primary key,
  template_id integer not null references templates(id) on delete cascade,
  order_index integer not null,
  name text not null,
  days integer not null default 1,
  role text,
  attachment boolean not null default false,
  depends_on_order integer
);

create table if not exists projects (
  id text primary key,
  code text not null,
  name text not null,
  template_id integer,
  manager_id integer,
  start_date date,
  status text not null default 'Active',
  budget numeric
);

create table if not exists project_steps (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  order_index integer not null,
  name text not null,
  description text,
  assignee integer,
  due_date date,
  status text not null default 'Not Started',
  attachment boolean not null default false,
  depends_on_id text,
  completed_at date
);

create table if not exists checklist_items (
  id text primary key,
  step_id text not null references project_steps(id) on delete cascade,
  label text not null,
  is_done boolean not null default false,
  order_index integer not null default 0
);

create table if not exists activity (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  step_id text,
  actor integer,
  action text not null,
  at date not null default current_date
);

create table if not exists notifications (
  id text primary key,
  user_id integer,
  type text,
  title text,
  body text,
  link text,
  is_read boolean not null default false,
  channel text default 'in-app',
  at date not null default current_date,
  dedupe text
);

create index if not exists idx_template_steps_template on template_steps(template_id);
create index if not exists idx_project_steps_project on project_steps(project_id);
create index if not exists idx_checklist_step on checklist_items(step_id);
create index if not exists idx_activity_project on activity(project_id);
create index if not exists idx_notifications_user on notifications(user_id);

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array[
    'users','templates','template_steps','projects',
    'project_steps','checklist_items','activity','notifications'
  ] loop
    begin
      alter publication supabase_realtime add table t;
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- สิทธิ์ (anon = ไม่มี login) ----------
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'users','templates','template_steps','projects',
    'project_steps','checklist_items','activity','notifications'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "team_full_access" on %I', t);
    execute format(
      'create policy "team_full_access" on %I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
