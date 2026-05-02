# Production Auth Email Setup

Retro Vault Elite now supports production password reset emails through Resend.

## What is already built

- Email/password sign-up
- Email/password sign-in
- Sign out
- Persistent sessions
- Password reset request
- Password reset confirmation
- Password change
- Display name updates
- Delete account
- Per-user synced collection data
- Hashed password-reset tokens
- Expiring sessions and reset links
- Basic rate limits on sign-up, sign-in, and reset requests

## Recommended provider

Use Resend for password reset email.

Official docs:

- Resend API keys: https://resend.com/docs/dashboard/api-keys/introduction
- Resend domains: https://resend.com/docs/dashboard/domains/introduction
- Resend send email API: https://resend.com/docs/api-reference/emails/send-email
- Render environment variables: https://render.com/docs/configure-environment-variables

## Render backend environment variables

Add these on the `retro-vault-backend` service:

```text
RESEND_API_KEY=re_your_key_here
RESET_FROM_EMAIL=Retro Vault Elite <retrovaultelite@gmail.com>
SESSION_TTL_DAYS=30
PASSWORD_RESET_TTL_MINUTES=30
```

Keep existing values:

```text
DATA_DIR=server/data
PORT=8787
CORS_ORIGIN=https://www.retrovaultelite.com,https://retrovaultelite.com,https://retro-vault-web.onrender.com
```

## Domain email setup

In Resend:

1. Add `retrovaultelite.com` as a sending domain.
2. Resend will show DNS records.
3. Add those DNS records in Namecheap Advanced DNS.
4. Wait for Resend to verify the domain.
5. Use `retrovaultelite@gmail.com` as the sender after verification.

## If email is not configured yet

Password reset still works technically, but the backend writes the reset link to server logs instead of emailing it.

That is useful for testing, but not enough for a public product.

## Post-setup test

1. Create a test account.
2. Sign out.
3. Click forgot password.
4. Enter the test account email.
5. Confirm the reset email arrives.
6. Open the reset link.
7. Set a new password.
8. Sign in with the new password.
