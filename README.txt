Phase 6 MFA Enrollment Patch

Why:
The original Phase 6 AuthGate code verified already-enrolled MFA factors but did not provide first-time TOTP enrollment. With REQUIRE_PRIVILEGED_AAL2=true, an admin with no factor could otherwise be blocked from completing setup.

Apply:
Copy the contents of this patch into the repository root and replace the matching files.

Changed:
- apps/admin/src/AuthGate.tsx
- apps/studio/src/AuthGate.tsx
- tests/source-integration.test.mjs

Then run:
- npm run typecheck
- npm test
- npm run test:static

No database migration is added by this patch.
