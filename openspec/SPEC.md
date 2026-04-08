# AssistAI — OpenSpec Index

> **Purpose**: Central index for all specification documents in openspec/
> **Last Updated**: 2026-04-08

---

## 📁 Change Directory Structure

```
openspec/
├── SPEC.md                    # This index
└── changes/
    ├── drive-rag-flow/        # Complete Drive → Picker → Indexing → RAG flow
    │   ├── proposal.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── specs/
    │       ├── google-oauth-config/
    │       ├── drive-file-selection/
    │       └── source-connection-state/
    │
    └── structural-autocomplete/  # Structural match fast-path + doc type detection
        ├── proposal.md
        ├── design.md
        ├── tasks.md
        └── specs/
            ├── structural-match-service/
            ├── document-type-detection/
            └── evidence-panel-attribution/
```

---

## 📖 Change Guide

### Drive RAG Flow

| Document | Description | Status |
|----------|-------------|--------|
| [proposal](changes/drive-rag-flow/proposal.md) | Complete Drive → Picker → Indexing → RAG flow | 🔄 Pending implementation |
| [design](changes/drive-rag-flow/design.md) | Technical design with architecture decisions | 🔄 Pending implementation |
| [tasks](changes/drive-rag-flow/tasks.md) | 20 tasks across 4 phases | 🔄 Pending implementation |
| [specs/source-connection-state](changes/drive-rag-flow/specs/source-connection-state/spec.md) | Source detection and post-OAuth handling | 🔄 Pending implementation |
| [specs/drive-file-selection](changes/drive-rag-flow/specs/drive-file-selection/spec.md) | File picker → indexation flow | 🔄 Pending implementation |
| [specs/google-oauth-config](changes/drive-rag-flow/specs/google-oauth-config/spec.md) | OAuth scope `drive.readonly` | 🔄 Pending implementation |

### Structural Autocomplete

| Document | Description | Status |
|----------|-------------|--------|
| [proposal](changes/structural-autocomplete/proposal.md) | Structural match fast-path + doc type detection | ✅ Implemented |
| [design](changes/structural-autocomplete/design.md) | Technical design | ✅ Implemented |
| [tasks](changes/structural-autocomplete/tasks.md) | 42 tasks across 6 phases | ✅ Implemented |
| [specs/structural-match-service](changes/structural-autocomplete/specs/structural-match-service/spec.md) | StructuralMatchService contract | ✅ Implemented |
| [specs/document-type-detection](changes/structural-autocomplete/specs/document-type-detection/spec.md) | detectDocumentType keyword heuristics | ✅ Implemented |
| [specs/evidence-panel-attribution](changes/structural-autocomplete/specs/evidence-panel-attribution/spec.md) | UI attribution for structural vs LLM | ✅ Implemented |

---

## 🚀 How to Use

1. **Active development**: Check the `changes/` directory for current work
2. **Understanding a feature**: Read proposal → design → tasks → specs in order
3. **Implementation**: Follow tasks and verify against specs

---

## 📊 Status Legend

| Status | Meaning |
|--------|---------|
| 🔄 Pending | Not yet implemented |
| 🏗️ In Progress | Currently being implemented |
| ✅ Implemented | Feature complete and verified |
| 🗂️ Archived | Completed and archived |

---

*This index is maintained alongside the openspec artifacts. Update when changes are added.*
