# AssistAI — OpenSpec Index

> **Purpose**: Central index for all specification documents in openspec/
> **Last Updated**: 2026-04-15

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
    ├── structural-autocomplete/  # Structural match fast-path + doc type detection
    │   ├── proposal.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── specs/
    │       ├── structural-match-service/
    │       ├── document-type-detection/
    │       └── evidence-panel-attribution/
    │
    ├── chunk-metadata-and-smart-retrieval/  # Metadata jsonb + metadata-aware retrieval
    │   ├── proposal.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── specs/
    │       ├── chunk-metadata-schema/
    │       ├── metadata-extraction/
    │       └── metadata-aware-retrieval/
    │
    └── user-defined-structures/  # Templates + Mi Biblioteca + editor selector
        ├── proposal.md
        ├── design.md
        ├── tasks.md
        └── specs/
            ├── template-entity/
            ├── library-ui/
            └── editor-template-selector/
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

### Chunk Metadata & Smart Retrieval

| Document | Description | Status |
|----------|-------------|--------|
| [proposal](changes/chunk-metadata-and-smart-retrieval/proposal.md) | Metadata jsonb en chunks + retrieval filtrado por metadata | 🔄 Pending implementation |
| [design](changes/chunk-metadata-and-smart-retrieval/design.md) | Schema, extractor, SQL dinámico, fallback strategy | 🔄 Pending implementation |
| [tasks](changes/chunk-metadata-and-smart-retrieval/tasks.md) | 46 tasks across 3 phases | 🔄 Pending implementation |
| [specs/chunk-metadata-schema](changes/chunk-metadata-and-smart-retrieval/specs/chunk-metadata-schema/spec.md) | ChunkMetadata, LegalDocType, MetadataFilter — DB column spec | 🔄 Pending implementation |
| [specs/metadata-extraction](changes/chunk-metadata-and-smart-retrieval/specs/metadata-extraction/spec.md) | MetadataExtractor — patterns, section/clauseType detection | 🔄 Pending implementation |
| [specs/metadata-aware-retrieval](changes/chunk-metadata-and-smart-retrieval/specs/metadata-aware-retrieval/spec.md) | findSimilarChunks con filtros, fallback, MetadataAwareRetrievalService | 🔄 Pending implementation |

### User-Defined Structures

> **Prerequisito**: `chunk-metadata-and-smart-retrieval` debe estar implementado primero.

| Document | Description | Status |
|----------|-------------|--------|
| [proposal](changes/user-defined-structures/proposal.md) | Templates + Mi Biblioteca + selector en editor | 🔄 Pending implementation |
| [design](changes/user-defined-structures/design.md) | Entidades, CRUD API, re-rank, Library UI | 🔄 Pending implementation |
| [tasks](changes/user-defined-structures/tasks.md) | 49 tasks across 11 phases | 🔄 Pending implementation |
| [specs/template-entity](changes/user-defined-structures/specs/template-entity/spec.md) | Template + TemplateSection entities, tenant isolation, chunk lifecycle | 🔄 Pending implementation |
| [specs/library-ui](changes/user-defined-structures/specs/library-ui/spec.md) | LibraryPage, TemplateList, TemplateFormModal, LibraryStats | 🔄 Pending implementation |
| [specs/editor-template-selector](changes/user-defined-structures/specs/editor-template-selector/spec.md) | TemplateSelector, useActiveTemplate, completion re-rank | 🔄 Pending implementation |

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
