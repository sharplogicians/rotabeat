# Security-First Principles & Guidelines for RotaFlow

Security is the highest priority and a core requirement of this project.

Everything developed, added, modified, or integrated into the project must be designed with security, reliability, privacy, scalability, and overall quality in mind from the beginning.

## Core Principles

1. **Security First**: No feature or implementation should compromise the security of the system.
2. **Privacy by Design**: User data, pay rates, employee PII, and attendance logs must be protected throughout their lifecycle.
3. **Secure by Default**: Components and configurations must use the safest reasonable defaults.
4. **Least Privilege**: Users, services, APIs, and Kiosk devices should have only the minimum permissions required (RBAC: Head Office, Site Manager, Kiosk Terminal).
5. **Strong Authentication & Authorization**: Access must be properly authenticated and strictly authorized. Employee/Kiosk PINs must be securely hashed (using bcrypt/Argon2) before storage.
6. **Input Validation**: All user-controlled input and API request payloads must be strictly validated and sanitized (e.g., using Zod schemas).
7. **Data Protection**: Sensitive data must be protected both in transit (TLS/HTTPS) and at rest.
8. **Secure Dependencies**: Keep third-party npm packages updated and audited against vulnerabilities (`npm audit`).
9. **Secrets Management**: DB credentials, JWT secrets, and API keys must never be hard-coded or committed to source control; use `.env` / environment variables.
10. **Secure APIs**: APIs must implement authentication, authorization checks, rate limiting, and safe error handling.
11. **Database Security**: Parameterized queries via Prisma ORM to eliminate SQL injection risks.
12. **Safe Error Handling**: Errors must never leak internal stack traces, DB query details, or system architecture to the client.
13. **Logging & Monitoring**: Log security events and audit actions without exposing passwords, tokens, or PINs.
14. **Never Sacrifice Security for Convenience**: Security and quality must be evaluated before implementing any feature or architecture change.
