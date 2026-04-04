# ADR-004: No Account Lockout After Failed Login Attempts

## Status

Accepted

## Date

2026-04-04

## Context

The security audit flagged (S-H2) that there is no account lockout mechanism after repeated failed login attempts. An attacker could theoretically attempt unlimited passwords against a known email address.

We evaluated whether adding account lockout would meaningfully improve security given the existing defenses.

## Decision

Do not implement account lockout. Rely on the existing per-IP rate limiting as the primary brute-force defense.

### Existing Defenses

1. **`authLimiter`** — 20 requests per 15 minutes per IP address (in `server.js`)
2. **`emailActionLimiter`** — 3 per hour per IP for email-related actions
3. **`emailAccountLimiter`** — 3 per hour per account for email actions
4. **Password hashing** — bcrypt with salt rounds, making each attempt computationally expensive
5. **Audit logging** — Failed login attempts are logged with IP address for monitoring

### Why Not Lockout

1. **User-targeted DoS** — An attacker can intentionally lock out legitimate users by spamming wrong passwords against their email. For a small-user-base app, this is a higher-probability attack than distributed brute-force.

2. **Small attack surface** — This is a self-hosted IPTV platform, not a public-facing service with millions of accounts. The likelihood of a distributed brute-force campaign (many IPs, one account) is negligible.

3. **Rate limiting is sufficient** — At 20 attempts per 15 minutes per IP, an attacker gets ~1,920 guesses per day from a single IP. Against a reasonably strong password, this is not a practical attack vector.

4. **Complexity cost** — Lockout requires new User model fields (`failedAttempts`, `lockedUntil`), atomic increment logic, unlock flows (email or time-based), and UI messaging. The maintenance burden exceeds the security benefit for this threat model.

## Alternatives Considered

### Soft lockout (increasing delays)

5 fails → 30s delay, 10 fails → 5min delay. Slows attacks without fully locking users. Rejected: still requires DB schema changes and adds auth flow complexity for minimal gain over rate limiting.

### Hard lockout (N fails → lock for 30min)

Strongest brute-force protection. Rejected: creates a DoS vector against legitimate users. Unlock-via-email adds another attack surface.

### CAPTCHA after N failures

Show CAPTCHA after 3 failed attempts. Rejected: poor UX for a TV-oriented platform, adds a third-party dependency (reCAPTCHA/hCaptcha), and the existing rate limiter already throttles automated attempts.

## Consequences

**Positive:**

- No risk of legitimate users being locked out by attackers
- Simpler auth flow with fewer edge cases
- No new DB fields or migration needed

**Negative:**

- Distributed brute-force (many IPs targeting one account) is not explicitly mitigated — accepted risk given the app's scale and audience
- Security audit tools will continue to flag this as a finding — this ADR serves as the documented exception
