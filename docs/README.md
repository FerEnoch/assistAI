# AssistAI Documentation Index

> **Purpose**: Central index for all project documentation  
> **Last Updated**: 2026-04-03

---

## 📁 Document Structure

```
docs/
├── prd/                    # Product Requirements Documents
│   └── PRD-2026-001-mvp.md
│
├── rfc/                    # Request for Comments (Technical Design)
│   └── RFC-2026-001-mvp.md
│
├── backlog/                # Product Backlog
│   └── BACKLOG-2026-001-mvp.md
│
└── architecture/           # Architecture & State Docs
    └── CURRENT-STATE.md
```

---

## 📖 Document Guide

### PRD — Product Requirements

| Document | Description | Status |
|----------|-------------|--------|
| [PRD-2026-001-mvp](prd/PRD-2026-001-mvp.md) | MVP product requirements, target audience, scope, success criteria | ✅ Approved |

**What you'll find:**
- Executive summary
- Target audience (personas)
- MVP scope (P0, P1, out of scope)
- User flows
- Beta readiness criteria

---

### RFC — Technical Design

| Document | Description | Status |
|----------|-------------|--------|
| [RFC-2026-001-mvp](rfc/RFC-2026-001-mvp.md) | MVP technical architecture, data model, security design | ✅ Approved |

**What you'll find:**
- Architecture diagrams
- Tech stack breakdown
- Backend module structure
- Data model entities
- Security implementation (auth, CSRF, encryption)
- Completion & indexing pipelines
- Development environment setup

---

### Backlog — Execution Plan

| Document | Description | Status |
|----------|-------------|--------|
| [BACKLOG-2026-001-mvp](backlog/BACKLOG-2026-001-mvp.md) | Full product backlog with sprints, tasks, dependencies | ✅ Active |

**What you'll find:**
- Priority levels (P0, P1, P2)
- Technical decisions registry (locked packages & parameters)
- Epic overview
- Sprint-by-sprint task allocation
- Cut list (what to drop if schedule slips)
- Implementation notes

---

### Architecture — State & Decisions

| Document | Description | Status |
|----------|-------------|--------|
| [CURRENT-STATE](architecture/CURRENT-STATE.md) | Current implementation state, known issues, fixes applied | 🔄 Updated |

**What you'll find:**
- Strengths & weaknesses assessment
- Application structure
- Key configuration
- Security implementation details
- Known issues & fixes applied
- Testing coverage
- Roadmap

---

## 🔗 Quick Links

- **Backlog**: [docs/backlog/BACKLOG-2026-001-mvp.md](backlog/BACKLOG-2026-001-mvp.md)
- **Technical Design**: [docs/rfc/RFC-2026-001-mvp.md](rfc/RFC-2026-001-mvp.md)
- **Current State**: [docs/architecture/CURRENT-STATE.md](architecture/CURRENT-STATE.md)

---

## 📝 Historical Proposals (Legacy)

The following files are in `proposals/` and kept for historical reference only. They are NOT the source of truth.

| File | Description |
|------|-------------|
| `proposals/initial-overview.md` | Initial architecture overview |
| `proposals/assistai-plan.md` | MVP plan |
| `proposals/mvp-implementation-proposal.md` | PROP-2026-001 |
| `proposals/assistai-backlog.md` | Original MVP backlog |
| `proposals/next-level-v1.md` | PROP-2026-002 (Next Level) |
| `proposals/next-level-backlog.md` | Next Level backlog |

> ⚠️ **Do NOT use legacy proposals for implementation**. Use `docs/backlog/` instead.

---

## 🚀 How to Use

1. **For implementation**: Start with [BACKLOG-2026-001-mvp](backlog/BACKLOG-2026-001-mvp.md)
2. **For technical questions**: Check [RFC-2026-001-mvp](rfc/RFC-2026-001-mvp.md)
3. **For product context**: Review [PRD-2026-001-mvp](prd/PRD-2026-001-mvp.md)
4. **For current state**: See [CURRENT-STATE](architecture/CURRENT-STATE.md)

---

*This index is maintained by the engineering team. Update when new documents are added.*
