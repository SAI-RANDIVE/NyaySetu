-- ===========================================================================
-- NyaySetu :: seed/reference.sql
-- Reference rows only. Demo users, cases and evidence are created by
--   cd backend && npm run seed
-- because those need bcrypt hashes and Aadhaar tokens the API must compute.
-- ===========================================================================

insert into public.roles (role, label, description, portal_path) values
  ('police',        'Police Officer',
   'Registers FIRs, captures evidence at the scene, hands custody to the forensic lab.',
   '/police'),
  ('forensic_lab',  'Forensic Laboratory',
   'Receives evidence, confirms the hash on arrival, anchors the forensic report.',
   '/forensic'),
  ('prosecutor',    'Public Prosecutor',
   'Takes custody for trial, reviews the evidence chain, requests summons.',
   '/prosecutor'),
  ('judge',         'Judge',
   'Issues summons, grants bail with encoded conditions, monitors compliance.',
   '/judge'),
  ('defence_lawyer','Defence Counsel',
   'Independently verifies evidence integrity. Read-only on prosecution data.',
   '/defence'),
  ('accused',       'Accused',
   'Acknowledges summons and files bail check-ins with Aadhaar OTP and GPS.',
   '/accused'),
  ('court_admin',   'Court Administrator',
   'Manages users, case assignments and the audit trail.',
   '/admin')
on conflict (role) do update
  set label = excluded.label,
      description = excluded.description,
      portal_path = excluded.portal_path;

insert into public.indexer_state (contract, last_block) values
  ('EvidenceChain', 0),
  ('SummonsChain', 0),
  ('BailChain', 0)
on conflict (contract) do nothing;
