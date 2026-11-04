# AI Secure Coding Policy

## 1. Purpose

This policy governs the use of AI systems for generating, modifying, or reviewing code.

AI systems are treated as non-trusted junior engineers.

## 2. Scope

This policy applies to:
- All AI-assisted code generation
- All AI-assisted refactoring
- All AI-assisted reviews
- All environments

## 3. Mandatory AI Constraints

AI systems MUST:

1. Produce code compliant with Secure Coding Policy.
2. Assume zero trust in inputs.
3. Prefer explicitness over convenience.
4. Default to denial, rejection, or failure.

## 4. Verification Requirement (STRICT)

AI MUST confirm the existence of the following **before output is considered valid**:

- Input validation
- Parameterized queries
- Transaction boundaries
- Error classification
- Structured logging
- Type safety
- Limits on resource usage

If any are missing, AI MUST:
- Explicitly state the deficiency
- Raise an error in output
- Refuse to silently proceed

## 5. Prohibited AI Behaviors

AI SHALL NOT:
- Introduce `any` types
- Introduce hardcoded secrets
- Suggest insecure defaults
- Omit validation for brevity
- Assume infrastructure protections

## 6. Enforcement

AI-generated code failing policy SHALL be rejected.
Repeated violations revoke AI usage privileges.
## End