-- ===========================================================================
-- NyaySetu :: 015_document_versions.sql      (2.1 · document lifecycle)
-- Run after 014_exhibit_seals.sql.
--
-- A generated legal document is not a filed one. Each version of a final
-- report moves through
--
--   DRAFT → VALIDATION_REQUIRED | READY_FOR_REVIEW → APPROVED → EXPORTED → FILED
--
-- VALIDATION_REQUIRED means the readiness checks found a blocking problem.
-- APPROVED needs an authorised officer and no blocking findings; the approved
-- PDF is stored, with its SHA-256, so every export of that version is the same
-- bytes. FILED needs a receipt reference from the court, recorded by a person:
-- downloading a PDF never files anything.
--
-- Versions are never edited after approval. A correction is a new version that
-- names the one it supersedes, so the history of what was approved survives.
--
-- Idempotent.
-- ===========================================================================

create table if not exists public.document_versions (
  id               uuid primary key default gen_random_uuid(),
  case_id          uuid not null references public.cases (id) on delete restrict,
  kind             text not null check (kind in ('final_report')),
  version          integer not null check (version >= 1),
  state            text not null default 'DRAFT'
                   check (state in ('DRAFT', 'VALIDATION_REQUIRED', 'READY_FOR_REVIEW', 'APPROVED', 'EXPORTED', 'FILED')),
  particulars      jsonb not null default '{}'::jsonb,
  readiness        jsonb not null default '[]'::jsonb,
  content_sha256   public.hash32,
  pdf_base64       text,
  generated_at     timestamptz not null default now(),
  supersedes       uuid references public.document_versions (id) on delete set null,
  created_by       uuid references public.users (id) on delete set null,
  approved_by      uuid references public.users (id) on delete set null,
  approved_at      timestamptz,
  exported_at      timestamptz,
  filed_reference  text check (filed_reference is null or char_length(filed_reference) between 3 and 120),
  filed_on         date,
  filed_by         uuid references public.users (id) on delete set null,
  filed_at         timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (case_id, kind, version),
  check (state not in ('APPROVED', 'EXPORTED', 'FILED') or (approved_by is not null and content_sha256 is not null and pdf_base64 is not null)),
  check (state <> 'FILED' or filed_reference is not null)
);
comment on table public.document_versions is '2.1: versions of a generated legal document and their review, approval, export and filing states.';
create index if not exists document_versions_case_idx on public.document_versions (case_id, kind, version desc);

do $$
begin
  alter table public.document_versions enable row level security;
  revoke insert, update, delete on public.document_versions from anon, authenticated;
  drop trigger if exists audit_changes on public.document_versions;
  create trigger audit_changes after insert or update or delete on public.document_versions
    for each row execute function app.audit_trigger();
  drop trigger if exists touch_updated_at on public.document_versions;
  create trigger touch_updated_at before update on public.document_versions
    for each row execute function app.touch_updated_at();
  drop policy if exists document_versions_case_read on public.document_versions;
  create policy document_versions_case_read on public.document_versions for select to authenticated
    using (app.has_role(array['court_admin']) or app.is_assigned(case_id));
end $$;
