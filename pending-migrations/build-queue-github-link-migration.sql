-- 99Bricks: link build_queue rows to their GitHub issue/PR
-- Run this in the Supabase SQL Editor.
--
-- What it's for: the automated build pipeline (Approve on a feature
-- recommendation -> GitHub issue -> Claude Code Action writes the code
-- and opens a PR -> admin taps "Merge & Go Live") needs somewhere to
-- remember which GitHub issue and pull request belong to which
-- build_queue row, so the admin panel can find the right PR and show a
-- merge button once it's ready.

alter table build_queue
  add column if not exists github_issue_number int,
  add column if not exists github_pr_number int,
  add column if not exists github_pr_url text;

create index if not exists build_queue_github_issue_idx
  on build_queue(github_issue_number);
