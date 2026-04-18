## 1. Base de datos — migración y entidad

- [ ] 1.1 Crear migración TypeORM para la tabla `template_documents` (template_id UUID FK, document_id UUID FK, created_at TIMESTAMPTZ, PK compuesta, CASCADE en ambas FK)
- [ ] 1.2 Crear entidad `TemplateDocument` en `packages/entities/src/template-document.entity.ts` con relaciones a `Template` y `Document`
- [ ] 1.3 Exportar `TemplateDocument` desde `packages/entities/src/index.ts`

## 2. Backend — endpoints de corpus por template

- [ ] 2.1 Agregar `TemplateDocument` al `TemplateModule` (imports de TypeORM)
- [ ] 2.2 Implementar `GET /templates/:id/documents` en `TemplateController` — retorna lista de documentos asociados (id, title, ingestStatus, createdAt)
- [ ] 2.3 Implementar `POST /templates/:id/documents` — valida que `documentId` pertenezca al workspace, crea fila en `template_documents`, retorna 201
- [ ] 2.4 Implementar `DELETE /templates/:id/documents/:docId` — elimina la fila de `template_documents`, retorna 204
- [ ] 2.5 Agregar guard de workspace en los tres endpoints (403 si template o documento no pertenece al workspace del usuario)

## 3. Backend — endpoint template desde upload local

- [ ] 3.1 Instalar e integrar `@nestjs/platform-express` multer para manejo de multipart (si no está instalado)
- [ ] 3.2 Crear `POST /templates/from-upload` en `TemplateController` con `@UseInterceptors(FileInterceptor('file'))`, límite 20MB, filtro de mimeType (pdf, docx, txt)
- [ ] 3.3 Implementar lógica en `TemplateService.createFromUpload()`: crear Template → crear Document (ingestStatus: queued) → guardar archivo en disco/storage → encolar ingest → crear asociación en `template_documents`
- [ ] 3.4 Retornar 400 si falta el campo `file`, 415 si MIME no soportado, 413 si supera el límite

## 4. Backend — endpoint template desde Drive

- [ ] 4.1 Crear `POST /templates/from-drive` en `TemplateController` con body DTO `{ fileId, sourceId, name, docType, description?, sections? }`
- [ ] 4.2 Validar que `sourceId` pertenezca al workspace del usuario (403 si no)
- [ ] 4.3 Implementar `TemplateService.createFromDrive()`: crear Template → crear Document con `externalDocumentId = fileId` y `sourceId` → encolar ingest → crear asociación en `template_documents`
- [ ] 4.4 Manejar el caso donde el fileId ya existe como Document en el workspace (retornar 409 Conflict o reutilizar el documento existente — decisión: reutilizar y solo crear nueva asociación)

## 5. Frontend — routing y eliminación de Dashboard

- [ ] 5.1 Eliminar `DashboardPage.tsx` de `apps/web/src/pages/`
- [ ] 5.2 Eliminar la ruta `/dashboard` de `App.tsx`
- [ ] 5.3 Agregar redirect `<Route path="/dashboard" element={<Navigate to="/library" replace />} />` en `App.tsx`
- [ ] 5.4 Actualizar el redirect wildcard `*` de `App.tsx` para apuntar a `/library`
- [ ] 5.5 Cambiar `navigate('/dashboard')` por `navigate('/library')` en `LoginPage.tsx` (devLogin y submit handler)
- [ ] 5.6 Verificar `VerifyPage.tsx` — si tiene redirect a `/dashboard`, actualizarlo a `/library`
- [ ] 5.7 Actualizar el `href` del logo en `AppHeader` de `/dashboard` a `/library`
- [ ] 5.8 Eliminar el test `DashboardPage.test.ts` o actualizarlo como test de redirect

## 6. Frontend — hook useTemplateDocuments

- [ ] 6.1 Crear `apps/web/src/hooks/useTemplateDocuments.ts` con funciones: `fetchDocuments(templateId)`, `addDocument(templateId, documentId)`, `removeDocument(templateId, documentId)`
- [ ] 6.2 El hook expone `{ documents, isLoading, error, addDocument, removeDocument, refetch }`

## 7. Frontend — Library UI: Drive connection y opciones de creación

- [ ] 7.1 Mover la lógica de Drive connection (`useSources`, `handleConnectDrive`) de `DashboardPage` a `LibraryPage`
- [ ] 7.2 Mover el manejo del query param `?source=connected` (one-shot refetch + replaceState) a `LibraryPage`
- [ ] 7.3 Reemplazar el botón simple "+ Nuevo Template" por un menú/dropdown con tres opciones: "Definir manualmente", "Subir archivo local", "Importar desde Drive"
- [ ] 7.4 "Definir manualmente" abre el `TemplateModal` existente (sin cambios)
- [ ] 7.5 "Subir archivo local" abre un `<input type="file" accept=".pdf,.docx,.txt">` oculto, al seleccionar archivo abre un mini-modal de confirmación (nombre + tipo + confirmar)
- [ ] 7.6 "Importar desde Drive" — si Drive no está conectado, muestra estado inline con botón de conexión; si está conectado, abre DrivePicker en single-select mode
- [ ] 7.7 Adaptar `DrivePicker` para aceptar una prop `singleSelect?: boolean` que limita la selección a un solo archivo y oculta folders

## 8. Frontend — Library UI: corpus por template

- [ ] 8.1 Reemplazar el `StatsCard` del panel lateral con un componente `TemplateCorpusPanel` que se activa al seleccionar/expandir un template
- [ ] 8.2 En `TemplateCard`, agregar indicador de corpus: "N documentos" o "Sin corpus"
- [ ] 8.3 Al expandir un template (click en la card o en un botón dedicado), mostrar la lista de documentos asociados con nombre, estado de ingest (badge: Indexado / Procesando / Error) y botón "Quitar"
- [ ] 8.4 Agregar botón "Agregar documento" que abre un selector de documentos del workspace (lista de documents ya indexados, filtrando los ya asociados)
- [ ] 8.5 Mostrar `IndexingStatus` en Library (puede ser un componente colapsable en el header de la página o al pie de la lista)

## 9. Frontend — empty state y estados de error

- [ ] 9.1 Cuando no hay templates ni Drive conectado, mostrar empty state con dos CTAs: "+ Nuevo Template" y "Conectar Google Drive"
- [ ] 9.2 Mostrar badge de estado Drive en el header de Library (ícono verde si conectado, nada si no)
- [ ] 9.3 Mostrar mensaje de error si el upload falla (413, 415, 500) con copia clara en español

## 10. Tests

- [ ] 10.1 Test unitario: `TemplateService.createFromUpload()` — verifica que crea Template, Document y asociación en `template_documents`
- [ ] 10.2 Test unitario: `TemplateService.createFromDrive()` — verifica que reutiliza Document si fileId ya existe
- [ ] 10.3 Test de controller: `GET /templates/:id/documents` — verifica 403 en acceso cross-workspace
- [ ] 10.4 Test de controller: `POST /templates/:id/documents` — verifica que `documentId` debe pertenecer al workspace
- [ ] 10.5 Test de controller: `DELETE /templates/:id/documents/:docId` — verifica 204 y que el documento no se elimina
- [ ] 10.6 Test frontend: `useTemplateDocuments` — verifica estados de loading/error/success con fetch mock
