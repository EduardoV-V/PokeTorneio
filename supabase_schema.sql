-- ============================================================
-- PokeTorneio — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. PLAYERS — nomes, ícones (base64), wins, losses
create table if not exists players (
  id        integer primary key,
  name      text    not null,
  wins      integer not null default 0,
  losses    integer not null default 0,
  icon      text,                        -- base64 data-url
  updated_at timestamptz default now()
);

-- Seed with default players (only if table is empty)
insert into players (id, name, wins, losses, icon)
select * from (values
  (1, 'Ash',     0, 0, null),
  (2, 'Misty',   0, 0, null),
  (3, 'Brock',   0, 0, null),
  (4, 'Gary',    0, 0, null),
  (5, 'Serena',  0, 0, null),
  (6, 'Dawn',    0, 0, null),
  (7, 'Clemont', 0, 0, null),
  (8, 'Iris',    0, 0, null),
  (9, 'Cilan',   0, 0, null)
) as v(id, name, wins, losses, icon)
where not exists (select 1 from players limit 1);

-- 2. TEAMS — one row per (player, slot); pokemon stored as JSON
create table if not exists teams (
  player_id  integer  not null references players(id) on delete cascade,
  slot_idx   integer  not null check (slot_idx >= 0 and slot_idx < 9),
  pokemon    jsonb,                       -- null = empty slot
  is_mega    boolean  not null default false,
  updated_at timestamptz default now(),
  primary key (player_id, slot_idx)
);

-- Seed empty slots (9 players × 9 slots)
insert into teams (player_id, slot_idx, pokemon, is_mega)
select p.id, s.slot, null, false
from players p
cross join generate_series(0, 8) as s(slot)
on conflict do nothing;

-- 3. BRACKET — single-row table for the active bracket state
create table if not exists bracket (
  id      integer primary key default 1,  -- always row 1
  data    jsonb,                           -- full bracket JSON or null
  updated_at timestamptz default now()
);

insert into bracket (id, data) values (1, null)
on conflict do nothing;

-- ============================================================
-- Enable Realtime for live updates across all connected clients
-- ============================================================
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table bracket;

-- ============================================================
-- Row Level Security — allow anonymous read/write
-- (adjust later if you add auth)
-- ============================================================
alter table players enable row level security;
alter table teams   enable row level security;
alter table bracket enable row level security;

create policy "public read players"  on players for select using (true);
create policy "public write players" on players for all    using (true) with check (true);

create policy "public read teams"  on teams for select using (true);
create policy "public write teams" on teams for all    using (true) with check (true);

create policy "public read bracket"  on bracket for select using (true);
create policy "public write bracket" on bracket for all    using (true) with check (true);
