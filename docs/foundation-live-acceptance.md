# Foundation live acceptance — separate from fixture tests

Perform after architecture approval, approved staging DB migrations and verified
backup/recovery. Do not run destructive RLS tests against production. Use consented
test accounts A/B/C/D; no production seed users were created by this packet.

- [ ] Confirm deployment hash, actual grants, migration ledger and public config.
- [ ] New email signup: privacy-safe notice, received confirmation, confirm, login.
- [ ] Existing confirmed email signup: identical safe notice, sign-in/reset/browse
      available, no second account identity claimed. Test SDK duplicate-error path.
- [ ] Password reset email received; link enters recovery form; user changes password
      themselves; new login works; invalid/expired link cannot reset.
- [ ] Login and browser refresh preserve real session. Temporary validation network
      failure warns without logout. Retry recovers; expiry/invalid token gives guest.
- [ ] Profile DB/RLS failure preserves session with visible error; no row inserted.
- [ ] Logout and cross-tab sign-out remove private UI.
- [ ] Public /u/slug works without plan/DOB/internal flags/contact disclosure;
      own safe profile edits and profile hydration still work via PostgREST.
- [ ] A cannot read B internal permissions or entitlements, self-grant PRO or
      publication rights, mutate profile plan/timestamps, or create NULL-owner Pulse.
- [ ] Existing founder/admin discussion permission remains effective; legacy PRO
      alone does not confer permission or paid entitlement.
- [ ] Two separate browsers/accounts: A opens B profile -> existing/new direct room;
      A sends -> B receives over real websocket; B reads -> unread clears.
- [ ] Starting B again returns same room. Group A/B/C sends/reads; D cannot
      read/join/send/rename/manage/mark-read. Verify connection loss/reconnect.
- [ ] Inspect active frontend messaging implementation: publication metadata alone
      does not remove any remaining polling or prove end-to-end Realtime behavior.
- [ ] Desktop/mobile production dialogs: X/Esc/overlay, inner scroll, background
      lock, focus restoration and long CreateDialog. No accidental submission.

Automated fixture command: npm run test:browser. Linux CI installs Chromium.
Fixture tests do not certify emails, hosted Auth configuration, payments,
PostgREST privilege caching or real Supabase Realtime delivery.
