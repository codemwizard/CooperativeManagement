# WP1.5 + WP2.2 integration record

Integration branch: codex/wp1.5-reestablished
Candidate merge commit: 62443bf2811e8acfcd16e214514c6f95b7d024c6
First parent (WP1.5 spine): f2ccf236a3150767c1549914ad39b29a5e9850f5
Second parent (WP2.2 exact branch): b8622228ab4018ed65cfa49100da54205772eeaa

The WP2.2 exact branch was merged with a non-fast-forward merge. Git reported no conflicts. The merged candidate contains migration 0016, the persisted workspace-context contract/repository/API route, WP2.2 integration evidence and the WP1.5 tenant policy/RLS baseline. The separate dirty codex/wp1.5-closeout worktree was not used or modified.

WP1.5 is a passing predecessor on this history: its gate record is pinned to 6f145875761a2c356bab790324c8a5615ec03652, an ancestor of this candidate. WP2.1, WP1.1 and WP1.2 predecessor records are also retained on the branch.

WP2.2 task evidence is rebound to this merge candidate but gate_verified remains pending. Existing WP2.2 test logs were generated on predecessor source candidate 9e9d8ddb529f41258b043c0df217c4beaa58a7f8. The exact-candidate preflight and any required reruns must pass before setting the WP2.2 gate to passed.

The merge is local to codex/wp1.5-reestablished. It does not merge to main or alter codex/rem-wp2.2-exact.
