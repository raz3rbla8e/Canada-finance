# Boreal Production Test Accounts

Production URL: https://boreal.up.railway.app

## Admin Account
- Email: tester@boreal.app
- Password: TestBoreal123
- Role: Admin
- Purpose: Full admin access, can seed demo data, manage users

## Friends Demo Account
- Email: friends@boreal.app
- Password: TryBoreal123
- Role: Regular user (non-admin)
- Purpose: Share with friends to demo the app
- Protected: Cannot change password or delete account (PROTECTED_ACCOUNTS env var on Railway)
- Data: Seeded with 115 sample transactions from 6 CSV files (RBC, Tangerine, TD)

## Recovery
- Endpoint: POST /api/admin-recover
- Requires ADMIN_RECOVER_KEY env var set on Railway (current value: recover-tester-2026)
- Body: {"key": "<key>", "email": "<email>"}
- Use to promote any account to admin if locked out

## Re-seeding Friends Data
1. Log in as tester@boreal.app (admin)
2. Go to admin panel → seed demo for the friends account
   OR use admin-recover to temporarily promote friends, call /admin/api/seed-demo, then demote via admin panel
