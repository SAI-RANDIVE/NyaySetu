-- ===========================================================================
-- NyaySetu :: 014_exhibit_seals.sql               (2.1 · physical exhibits)
-- Run after 013_upload_staging.sql.
--
-- A fingerprint proves a FILE is unchanged. Most exhibits are not files: a
-- blood sample, a weapon, a packet of narcotics. What travels with them is a
-- tamper-evident seal with a printed serial. This migration binds that serial
-- to the exhibit at the moment of sealing, and records every later reading of
-- it, so a substituted packet — which must carry a different seal — is refused
-- at the first hand-over instead of being discovered by luck.
--
--   exhibit_seals  one per exhibit: the serial (off chain) and the salted
--                  digest anchored on chain when it was sealed
--   seal_checks    every reading of the serial by a receiving party, matched
--                  or not; a mismatch is anchored too
--
-- The serial itself never goes on chain. The chain holds
-- sha256('nyaysetu-seal|' || evidence_id || '|' || serial), which is useless
-- without the internal evidence id.
--
-- Idempotent.
-- ===========================================================================

create table if not exists public.exhibit_seals (
  id            uuid primary key default gen_random_uuid(),
  evidence_id   uuid not null unique references public.evidence_items (id) on delete restrict,
  case_id       uuid not null references public.cases (id) on delete restrict,
  serial        text not null check (char_length(serial) between 3 and 64),
  seal_digest   public.hash32 not null,
  anchor_id     uuid references public.anchors (id) on delete set null,
  description   text,
  sealed_by     uuid references public.users (id) on delete set null,
  sealed_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
comment on table public.exhibit_seals is '2.1: the tamper-evident seal serial bound to a physical exhibit, anchored on chain as a salted digest.';
create index if not exists exhibit_seals_case_idx on public.exhibit_seals (case_id);

create table if not exists public.seal_checks (
  id               uuid primary key default gen_random_uuid(),
  evidence_id      uuid not null references public.evidence_items (id) on delete restrict,
  case_id          uuid not null references public.cases (id) on delete restrict,
  context          text not null check (context in ('lab_intake', 'custody_transfer', 'court_production', 'malkhana')),
  observed_serial  text not null,
  observed_digest  public.hash32 not null,
  matched          boolean not null,
  anchor_id        uuid references public.anchors (id) on delete set null,
  checked_by       uuid references public.users (id) on delete set null,
  checked_by_role  text,
  checked_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
comment on table public.seal_checks is '2.1: each reading of an exhibit seal by a receiving party; mismatches are anchored on chain.';
create index if not exists seal_checks_evidence_idx on public.seal_checks (evidence_id, checked_at);

-- A seal that does not match is its own kind of alert.
alter table public.discrepancy_alerts drop constraint if exists discrepancy_alerts_kind_check;
alter table public.discrepancy_alerts add constraint discrepancy_alerts_kind_check check (kind in (
  'MISSING_CONFIRMATION', 'DELAYED_TX', 'HASH_MISMATCH', 'INDEXER_LAG', 'SYNC_FAILED',
  'SEAL_BROKEN', 'SEAL_MISMATCH', 'CUSTODY_GAP', 'RECORD_CHAIN_DISAGREE', 'SIGNATURE_INVALID', 'CLOCK_SKEW'));

do $$
declare t text;
begin
  foreach t in array array['exhibit_seals', 'seal_checks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    execute format('drop trigger if exists audit_changes on public.%I', t);
    execute format('create trigger audit_changes after insert or update or delete on public.%I
                    for each row execute function app.audit_trigger()', t);
    execute format('drop policy if exists %I on public.%I', t || '_case_read', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (app.has_role(array[''court_admin'']) or app.is_assigned(case_id))', t || '_case_read', t);
  end loop;
end $$;
