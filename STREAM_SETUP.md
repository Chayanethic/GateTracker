# ECE / CSE Stream Setup

1. Open the Supabase SQL Editor.
2. Run `gate_tracker_stream_migration.sql`.
3. Deploy this updated project.

## Existing lectures
All lectures that existed before this change are automatically marked `stream = 'ece'`, because the existing curriculum was ECE.

## New candidate login
A candidate without a saved branch is sent to `/branch-selection` after authentication. Their choice is stored in `user_profiles.branch`.

## Admin login
After every admin login, the admin is sent to `/admin/stream`. The selected stream is kept for that admin session only. Resource Management loads and uploads only that stream.

## Moving a lecture
In Admin → Resource Management, each lecture has a move button. It switches the lecture between ECE and CSE and removes it from the current stream view immediately.
