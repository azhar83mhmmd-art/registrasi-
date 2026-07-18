-- Flash Peak Community — Supabase schema
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)

create table if not exists members (
  member_id   text primary key,
  nama        text not null,
  usia        integer not null,
  game_id     text not null unique,
  username    text not null unique,
  alasan      text not null,
  avatar      text not null default 'avatar1.svg',
  posisi      text not null check (posisi in ('ST','CM','WF','CB')),
  status      text not null default 'succeed',
  joined_at   timestamptz not null default now()
);

create index if not exists members_joined_at_idx on members (joined_at asc);

-- Row Level Security: API routes use the service_role key (server-side only,
-- never exposed to the browser), which bypasses RLS automatically. Enabling
-- RLS here just makes sure the anon/public key (if ever used client-side)
-- can't read or write directly.
alter table members enable row level security;
