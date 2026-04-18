## Context

### Estado actual

La app tiene:
- **Dashboard** (`/dashboard`): pantalla post-login con Drive connection, IndexingStatus y un link al editor. Es la landing de todos los usuarios autenticados.
- **Library** (`/library`): lista de templates con modal de creación manual (nombre + tipo + secciones a mano) y un panel lateral con stats globales del corpus (total docs, total chunks, breakdown por docType).
- **Templates → Documents**: el sistema crea un *documento sintético* por template que indexa el contenido de las secciones. No existe relación entre templates y documentos reales del workspace.
- **ContentSource**: la entidad que representa la conexión a Google Drive. Un workspace puede tener uno. El pipeline de ingest (BullMQ queue `INGESTION_EMBED`) ya funciona para documentos reales.
- **DrivePicker**: componente que lista archivos de Drive (vía `GET /sources/:id/files`) y permite seleccionar fileIds para indexar.

### Problema

1. Dashboard es intermediaria sin valor propio — el usuario hace login y le aparece una pantalla que solo le dice su nombre de workspace y tiene que buscar dónde ir.
2. No hay forma de crear un template a partir de un documento existente (Drive o local).
3. El corpus del RAG es un pool global — no hay forma de controlar qué documentos alimentan cada template. Esto degrada la calidad del retrieval.
4. Las stats del corpus (panel lateral de Library) son globales y no le dicen al usuario nada accionable.

---

## Goals / Non-Goals

**Goals:**
- Post-login aterriza en `/library` directamente
- Library incorpora el flujo de conexión/reconexión de Drive
- El usuario puede crear un template desde un archivo local (upload) o desde Drive
- El usuario puede asociar y desasociar documentos del corpus a cada template
- Las stats del corpus se muestran agrupadas por template
- Un documento puede estar asociado a múltiples templates

**Non-Goals:**
- Auto-detección de secciones (ni ML ni heurísticas — queda para el futuro)
- Cambios al pipeline de embedding o al algoritmo de retrieval
- Soporte para fuentes de ingesta distintas de Google Drive y upload local
- Extracción de secciones del documento uploadado (el usuario las define manualmente)

---

## Decisions

### D-1: `/dashboard` se elimina — no se depreca, se borra

**Decisión:** Borrar `DashboardPage.tsx` del árbol de rutas y del sistema de archivos. Redirigir post-login (LoginPage + VerifyPage) a `/library`. El redirect por defecto `*` también va a `/library`.

**Alternativa descartada:** Mantener `/dashboard` como redirect permanente (301). Agrega ruido sin beneficio — nadie guarda bookmarks en una app de este tipo todavía.

**Impacto:** `App.tsx`, `LoginPage.tsx`, `VerifyPage.tsx`, header logo link.

---

### D-2: Drive connection vive en Library, no en un panel separado

**Decisión:** El estado de la fuente Drive (conectada / no conectada) y el botón de conexión/reconexión se integran dentro de Library como un banner contextual que aparece cuando el usuario quiere agregar un template desde Drive y no tiene Drive conectado.

**Alternativa descartada:** Mover el panel de Drive a un `<aside>` o settings page. Es demasiado pronto para settings. El usuario de MVP necesita flujo lineal: "quiero agregar desde Drive → me dice que conecte → conecto → vuelvo al flujo".

---

### D-3: Tabla de join `template_documents` — relación M:N explícita

**Decisión:** Agregar entidad `TemplateDocument` con `template_id` y `document_id` como PK compuesta. No usar arrays en columnas existentes.

```
template_documents
  template_id   UUID FK → templates.id  ON DELETE CASCADE
  document_id   UUID FK → documents.id  ON DELETE CASCADE
  created_at    TIMESTAMPTZ DEFAULT NOW()
  PRIMARY KEY (template_id, document_id)
```

**Alternativa descartada:** Agregar `template_ids: uuid[]` al Document. Los arrays en Postgres son funcionales pero dificultan queries relacionales y no tienen FK enforcement. La tabla de join es más limpia y escala.

---

### D-4: Creación de template desde archivo — dos paths distintos

**Decisión:** Los dos paths (upload local y Drive) son flujos separados en la UI pero convergen en el mismo resultado:

- **Upload local**: `POST /templates/from-upload` (multipart/form-data) con el archivo + metadata (nombre, docType). El backend: guarda el archivo, crea el Document, encola el ingest, crea el Template con secciones vacías, crea la asociación en `template_documents`.
- **Desde Drive**: el usuario selecciona un archivo con DrivePicker. El backend recibe el fileId, crea el Document vía el flujo de ingest existente, crea el Template, crea la asociación.

Ambos paths crean un Template con secciones en blanco que el usuario completa después. No se extraen secciones del documento.

**Alternativa descartada:** Un solo endpoint `POST /templates` con campo `sourceFileId` opcional. Mezcla responsabilidades — el upload multipart y el JSON body no se llevan bien en el mismo endpoint de forma limpia.

---

### D-5: Corpus por template — API REST resource

**Decisión:** Exponer los documentos asociados a un template como un sub-recurso:

```
GET    /templates/:id/documents         → lista documentos asociados
POST   /templates/:id/documents         → asociar documento existente (body: { documentId })
DELETE /templates/:id/documents/:docId  → desasociar
```

El retrieval (query time) NO cambia en este cambio — el filtro por template es backlog. Lo que se construye acá es solo la gestión de la asociación y la UI para visualizarla.

---

### D-6: Stats del corpus en Library — por template, no global

**Decisión:** El panel lateral de Library muestra, para el template seleccionado/expandido, cuántos documentos tiene asociados y su estado de ingest (indexados, pendientes, fallidos). El StatsCard global de chunks/docs se elimina o se mueve a un lugar secundario.

**Alternativa descartada:** Mantener stats globales + agregar stats por template. La pantalla se satura. El usuario de MVP necesita saber "¿este template tiene contexto suficiente?" no "¿cuántos chunks tiene el workspace?".

---

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|-----------|
| El upload local puede ser archivos grandes (100MB+) | Limitar en el endpoint a 20MB en el MVP. Mostrar error claro si supera el límite. |
| El usuario crea el template pero no agrega secciones → el RAG no tiene estructura | Mostrar un estado "incompleto" en el template card si `sections.length === 0`. No es blocking. |
| Eliminar Dashboard puede romper bookmarks o links externos | Aceptable en MVP — no hay usuarios externos todavía. El redirect `*` a `/library` cubre el caso. |
| La asociación template_documents no filtra el retrieval todavía | Documentarlo explícitamente. El corpus crece pero el retrieval sigue siendo global. La asociación es la infraestructura para el filtrado futuro. |
| Drive picker actual llama a `/sources/:id/files` — requiere sourceId | En Library, cuando el usuario elige "desde Drive", obtener el sourceId del workspace antes de abrir el picker. Si no hay source conectada, mostrar el flujo de conexión primero. |

---

## Migration Plan

1. Agregar migración TypeORM para `template_documents` (nueva tabla join)
2. Agregar entidad `TemplateDocument` al package `@assistai/entities`
3. Extender `TemplateModule` con nuevos endpoints
4. Agregar endpoint `POST /templates/from-upload` con multer
5. Eliminar `DashboardPage.tsx` del árbol de rutas
6. Actualizar redirects en `LoginPage`, `VerifyPage`, `App.tsx`
7. Actualizar LibraryPage con nueva UI (Drive connection banner, opciones de creación, panel de corpus por template)
8. No hay rollback complejo — si algo falla, la ruta `/dashboard` simplemente dejó de existir, lo cual es el comportamiento deseado

## Open Questions

- ¿El ingest del archivo local usa el mismo worker BullMQ que el ingest de Drive, o necesita uno separado? (Probablemente el mismo — el worker ya procesa `documentId`, no le importa la fuente.)
- ¿Límite de tamaño para upload local: 20MB o más? Depende del caso de uso real de documentos legales.
- ¿La asociación template_documents debe aparecer en el retrieval context desde el día 1, o es solo para la UI? → Solo UI por ahora, el filtro de retrieval por template es la siguiente vuelta de rosca.
