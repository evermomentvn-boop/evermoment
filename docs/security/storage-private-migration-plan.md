# EverMoment — Storage security migration (staged, DO NOT APPLY YET)

## Confirmed from Supabase screenshots (2026-11-08)
- `storage.buckets`: `memories.public = true`.
- `storage.objects` policies: public SELECT (twice), public INSERT with `bucket_id = 'memories'`, and public DELETE with `bucket_id = 'memories'`.
- `customers` has a `SELECT TO public USING (true)` policy.
- The existing app directly calls `storage.from("memories").list(folder)`, `.upload(path,...)`, `.remove([path])`, and `.getPublicUrl(path)`.
- `src/services/uploadService.js` stores media and thumbnails under `${folderName}/...` and persists public URLs in media metadata.
- `src/App.jsx` reconstructs public URLs when listing media. Switching the bucket to private now would break these URLs.

## Threats
1. Public bucket makes objects accessible to anyone with their public URLs.
2. Public SELECT on storage.objects can permit listing objects through the API (depending on endpoint and object path).
3. Public INSERT/DELETE policies permit operations without verifying ownership, subject to API and role privileges.
4. A UI-only restriction on personal vaults is not an access-control boundary.
5. Existing shared journey SELECT RLS is separate from storage authorization; do not assume it protects public URLs.

## Required migration, in order
1. **Inventory** every storage path, bucket, persisted URL, and auth flow; confirm `folderName` maps to an authenticated `customers` owner. Identify existing `journey_moments.moment_data` URL formats.
2. **Design** owner-only storage access for raw vault objects and thumbnails; validate the object path prefix against a trusted customer-to-auth mapping, not a client-provided folder name alone.
3. **Design** authorized shared-media reads for members of any linked household. Prefer server-side authorization and short-lived signed URLs or an authenticated streaming endpoint; check membership against `household_journeys` and legacy `journeys.household_id` with both `journey_id` and `customer_id`. Do not duplicate media.
4. **Migrate frontend** to use private-object paths and authorized URLs in vault, journey covers, thumbnails, viewer and household journeys. Do not persist expiring signed URLs as permanent media identifiers.
5. **Test** with two accounts: own vault, another account's vault denied, shared household media allowed, unshare/leave revokes future access, uploads/deletes restricted, legacy data and thumbnails work.
6. **Back up** database metadata and storage objects; prepare rollback. Deploy frontend and SQL changes in a coordinated maintenance window.
7. Only after successful verification: remove permissive storage policies, add least-privilege policies, and set `memories` to private. Verify no anonymous list/upload/delete or public URL read remains.

## Current rollout decision
BLOCK production rollout of household sharing and storage policy changes pending the above work. Do not run staged household sharing migrations as a substitute for storage security. The developer branch may contain preparatory code but has not been end-to-end tested.

## Immediate mitigation decision
Because public DELETE/INSERT are serious, prioritize a coordinated emergency policy remediation with owner-verified upload/delete and regression tests. Do not execute an untested blanket policy drop that could interrupt existing users.
