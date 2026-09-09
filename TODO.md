# TODO

- [x] Diagnose why `POST /api/v1/auth/register` returns 400 (backend Joi validation is strict; response body wasn’t provided, but rules confirm likely password special-character mismatch).
- [x] Ensure frontend password validation matches backend Joi/UserModel password rules (special character requirement).
- [x] Patch `frontend/src/pages/Register.tsx` password strength/validation to require backend special character set.
- [ ] Optionally add better display of backend validation errors on the register page.
- [ ] Run frontend/backend quick test (manual request or existing tests) to confirm 201 on registration.

