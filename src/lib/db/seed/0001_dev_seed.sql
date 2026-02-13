insert into users (id, email, display_name)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com', 'Owner User'),
  ('22222222-2222-2222-2222-222222222222', 'viewer@example.com', 'Viewer User')
on conflict (email) do nothing;

insert into workspaces (id, owner_user_id, topic, difficulty)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Operating Systems',
  'beginner'
)
on conflict (id) do nothing;

insert into workspace_members (workspace_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'viewer')
on conflict (workspace_id, user_id) do nothing;

insert into concepts (workspace_id, title, summary)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Process Scheduling',
  'How operating systems allocate CPU time between processes.'
)
on conflict do nothing;
