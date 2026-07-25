# AGENTS.md Metadata

IMPORTANT: THIS FILE IS NOT FOR AGENTIC AI

Metadata used in creation and update of agent role, behavior and directives.

## Creation

### Initial Prompt

Create `AGENTS.md` file text that includes these directives:

- You are an expert developer skilled in TypeScript, Bash, DevOps, Git, GitHub workflows, and GitHub Actions.
- Avoid sycophant behavior in replies and actions.
- Push back when needed and scrutinize requests for correctness and compliance with these guidelines.

Code must follow:

- Style guidance from the Microsoft TypeScript Style Guide and Shellcheck.
- Consistent naming for semantically equivalent classes, interfaces, types, methods, variables, and member fields.
- Consistent documentation for those naming targets.
- Always document exported types.
- Provide additional context for new readers where behavior is not obvious from signatures.

CI/CD must follow best practices:

- Reference: https://github.com/github/awesome-copilot/blob/main/instructions/github-actions-ci-cd-best-practices.instructions.md
- Abstract shared logic across workflows and actions.
- Treat `main` as the official release branch with no known bugs.
- Treat `staging` as the branch for experimental features.

Security and dependency guidance:

- Follow security best practices and the principle of least privilege.
- Use libraries consistently (for example: `semantic-release`, `vitest`).
- Follow recommended usage patterns from maintainers/authors.

Testing patterns must be consistent:

- Naming format: `<method> <conditions> <expected>`
- Focus on behavior under test.
- Keep setup directly tied to conditions/expected behavior.
- Use constants when exact values do not matter, only presence.
- Use parameterized tests or helper functions for repeated patterns.
- Do not use logic in tests.

For every code update:

- Run tests, fix failures, and iterate.
- Avoid infinite loops and explain the reason when stopping.
- Use `scripts/dev/` only for development tooling and CI/CD commands.
- Use `scripts/ops/` for operational automation and maintenance workflows.
- Use `scripts/` root for release/packaging.
- Warn about breaking changes that affect backward compatibility and confirm before proceeding.

### Refinement Prompts

#### Agent Characteristics Optimization

**Prompt**

```
Optimize AGENTS.md for progressive discovery and avoiding context bloat that the models already are capable of. Assume the lowest common denominiter / capability evaluating all the models.
```

**\_Response**

```
I’m going to streamline AGENTS.md into a layered “read-minimum-first” format so lower-capability models can follow it without carrying unnecessary context. I’ll keep core guardrails and remove redundant detail.

Read [](file:///home/awalsh128/cache-apt-pkgs-action/AGENTS.md)

Read [](file:///home/awalsh128/cache-apt-pkgs-action/AGENTS_META.md)

I’m replacing AGENTS.md with a shorter layered version that starts with universal rules and only expands into domain-specific guidance when needed, to reduce token overhead for weaker models.

Generating patch (3 lines) in [](file:///home/awalsh128/cache-apt-pkgs-action/AGENTS.md)

Created [](file:///home/awalsh128/cache-apt-pkgs-action/AGENTS.md)

The new layout is in place with progressive layers and trimmed redundancy. I’m doing a quick read-back to confirm formatting and that the guidance stayed aligned with your original constraints.

Read [](file:///home/awalsh128/cache-apt-pkgs-action/AGENTS.md)

Optimized AGENTS.md for progressive discovery and low-context model compatibility.

What changed:
- Replaced long narrative sections with a layered “read in order” structure.
- Put mandatory, model-agnostic rules in a minimal **Section 0**.
- Moved conditional guidance into scoped sections:
  - coding
  - testing
  - CI/CD
  - script placement
- Reduced redundancy and removed explanatory prose that models typically already infer.
- Kept your critical constraints intact:
  - anti-sycophancy / push-back
  - style and naming consistency
  - test conventions and no logic in tests
  - CI/CD abstraction and branch intent (`main` vs `staging`)
  - security/least privilege
  - ask-first / never-do guardrails
- Preserved quick command references in a compact block.
```

#### Always-on Rules

**Prompt**

```
- Explicitly include instruction-efficiency rules covering progressive discovery, salience control, and context-bloat reduction when creating/updating AGENTS.md.
- Add always-on rules for:
  - irreversible action confirmation,
  - execution side effects action confirmation,
  - verification-only success claims,
  - minimal/safe diffs,
  - API stability by default,
  - narrow-scope validation,
  - bounded fix loops,
  - secret-safe handling,
  - least-privilege permissions,
  - fail-fast error handling, and
  - explicit assumptions.
```

**Response**

```
I’m going to streamline AGENTS.md into a layered “read-minimum-first” format so lower-capability models can follow it without carrying unnecessary context. I’ll keep core guardrails and remove redundant detail.

Read [](file:///home/awalsh128/cache-apt-pkgs-action/AGENTS.md)

Read [](file:///home/awalsh128/cache-apt-pkgs-action/AGENTS_META.md)

I’m replacing AGENTS.md with a shorter layered version that starts with universal rules and only expands into domain-specific guidance when needed, to reduce token overhead for weaker models.

Generating patch (3 lines) in [](file:///home/awalsh128/cache-apt-pkgs-action/AGENTS.md)

Created [](file:///home/awalsh128/cache-apt-pkgs-action/AGENTS.md)

The new layout is in place with progressive layers and trimmed redundancy. I’m doing a quick read-back to confirm formatting and that the guidance stayed aligned with your original constraints.

Read [](file:///home/awalsh128/cache-apt-pkgs-action/AGENTS.md)

Optimized AGENTS.md for progressive discovery and low-context model compatibility.

What changed:
- Replaced long narrative sections with a layered “read in order” structure.
- Put mandatory, model-agnostic rules in a minimal **Section 0**.
- Moved conditional guidance into scoped sections:
  - coding
  - testing
  - CI/CD
  - script placement
- Reduced redundancy and removed explanatory prose that models typically already infer.
- Kept your critical constraints intact:
  - anti-sycophancy / push-back
  - style and naming consistency
  - test conventions and no logic in tests
  - CI/CD abstraction and branch intent (`main` vs `staging`)
  - security/least privilege
  - ask-first / never-do guardrails
- Preserved quick command references in a compact block.
```

#### Skills &amp; Rules

**Prompt**

```
Consider useful guidelines calling agent features like progressive discovery, salience, context bloat when creating or updating AGENTS.md and if it should be explicitly calling out in the file to speed up responses and reducing token usage
```

**Response**

```
Updated:
- AGENTS.md
- AGENTS_META.md

What was added:
- A dedicated Instruction Efficiency section in AGENTS.md with concrete rules for:
  - progressive discovery layering
  - salience control (limited emphasis, explicit priority keywords)
  - context-bloat reduction (short core, scoped detail, no capability restatement)
  - low-capability model optimization (simple, deterministic wording)
- A matching refinement directive in AGENTS_META.md so future regenerations preserve the same optimization intent.

This is the right approach for faster responses and lower token usage because it improves instruction ordering and reduces redundant prompt mass while keeping hard constraints explicit.
```

## Implementation Notes

### 1. Anti-Sycophancy Directive

The `Role & Behavior` section explicitly instructs the agent to **push back**and **scrutinize**. This prevents the common LLM tendency to agree with incorrect user premises. The agent is programmed to prioritize correctness over compliance with unsafe requests.

### 2. Directory Separation

The configuration enforces a strict separation between `scripts/dev/` (local tooling), `scripts/ops/` (operations), and `scripts/` root (release/packaging). This aligns with your requirement to isolate development commands from production release logic.

### 3. Testing Rigor

The `Testing Strategy` section encodes your specific constraints:

- **Naming:**Enforces the `<method> <conditions> <expected>` pattern.
- **No Logic in Tests:**Explicitly forbids control flow within test bodies, ensuring tests remain simple assertions of state.
- **Iteration Limit:**The instruction to "stop and explain" after two failed fix attempts prevents agents from getting stuck in correction loops.

### 4. CI/CD Abstraction

The file mandates abstracting common logic from GitHub Actions YAML into reusable components, directly addressing your requirement to follow best practices and reduce duplication.
