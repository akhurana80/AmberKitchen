# Security Checklist

- Store JWT, payment, Google, Firebase, and Azure secrets outside Git.
- Keep CORS origins restricted through `CORS_ORIGINS`.
- Require HTTPS for all production traffic and provider callbacks.
- Keep `Idempotency-Key` enabled on order creation clients to prevent duplicate orders.
- Verify PhonePe and Razorpay webhook signatures before payment state changes.
- Monitor `audit_logs` for privileged actions and failed access attempts.
- Keep document OCR and face verification consent text in the onboarding UI.
- Rotate credentials before every public launch milestone.
