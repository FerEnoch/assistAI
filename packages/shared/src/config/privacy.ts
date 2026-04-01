/**
 * Privacy disclosures and legal copy in Spanish (A-096).
 *
 * All user-facing privacy text for the beta. Includes:
 * - Data collection notice
 * - Document processing disclosure
 * - AI usage disclosure
 * - Cookie/session notice
 * - Deletion rights
 * - Beta terms
 *
 * Language: es-AR (Rioplatense Spanish per project convention).
 */

export const PRIVACY_DISCLOSURES = {
  /** Shown during onboarding / first login */
  dataCollection: {
    title: 'Cómo usamos tus datos',
    body: `AssistAI procesa tus documentos exclusivamente para brindarte sugerencias de escritura personalizadas.

**Qué recopilamos:**
• Tu dirección de email para autenticación
• Los documentos que conectás desde Google Drive
• Tus sesiones de edición y el texto que escribís en el editor

**Qué NO hacemos:**
• No compartimos tus documentos con terceros
• No usamos tus datos para entrenar modelos de inteligencia artificial
• No accedemos a archivos de Drive que no hayas seleccionado explícitamente

Tus documentos se encriptan en reposo con cifrado AES-256 por workspace.`,
  },

  /** Shown when connecting Google Drive */
  driveConnection: {
    title: 'Conexión con Google Drive',
    body: `Al conectar Google Drive, AssistAI:

• Solicita acceso **solo** a los archivos que selecciones (scope: drive.file)
• Almacena tu token de actualización de forma encriptada
• Extrae texto de documentos PDF, DOCX, TXT y Markdown
• Genera representaciones vectoriales (embeddings) para búsqueda semántica

Podés desconectar Google Drive en cualquier momento desde la configuración.
Al desconectar, revocamos el token de acceso y eliminamos la conexión.`,
  },

  /** Shown when AI completions are used */
  aiUsage: {
    title: 'Uso de inteligencia artificial',
    body: `AssistAI utiliza modelos de lenguaje para generar sugerencias de texto.

**Cómo funciona:**
• El texto que escribís se envía a un proveedor de IA para generar continuaciones
• Si hay documentos relevantes indexados, se incluyen como contexto
• Las sugerencias se basan en tu contenido y estilo de escritura

**Proveedores de IA:**
• Por defecto, se usa OpenRouter (GPT-4o mini)
• Podés configurar tu propio endpoint de IA (BYO — Bring Your Own)
• Tus claves API se almacenan encriptadas

**Importante:** Las sugerencias de IA pueden contener errores. Siempre revisá el contenido generado antes de usarlo en documentos legales.`,
  },

  /** Cookie/session notice */
  cookies: {
    title: 'Cookies y sesiones',
    body: `AssistAI usa cookies estrictamente necesarias para:

• **Sesión:** Cookie de sesión segura (__Host-assistai_sid) con duración de 8 horas
• **CSRF:** Cookie de protección contra ataques CSRF (__Host-assistai_csrf)

No usamos cookies de tracking, publicidad ni analítica de terceros.
Todas las cookies usan los flags HttpOnly, Secure y SameSite=Lax.`,
  },

  /** Deletion/erasure rights */
  deletion: {
    title: 'Tus derechos sobre tus datos',
    body: `Tenés derecho a:

• **Desconectar fuentes:** Revocá el acceso a Google Drive en cualquier momento
• **Eliminar documentos:** Borrá documentos individuales o todos los de un workspace
• **Eliminar tu cuenta:** Solicitá la eliminación completa de tu cuenta y todos tus datos
• **Exportar datos:** Pedinos una copia de tus datos en formato estructurado

Para ejercer estos derechos, contactanos a [soporte@assistai.app] o usá las opciones en Configuración.

La eliminación es permanente e irreversible. Todos los datos se borran en un plazo de 72 horas.`,
  },

  /** Beta program terms */
  betaTerms: {
    title: 'Términos del programa Beta',
    body: `Al participar en el programa beta de AssistAI, aceptás que:

• El servicio se encuentra en fase de prueba y puede contener errores
• Las funcionalidades pueden cambiar sin previo aviso
• No hay garantía de disponibilidad ni de nivel de servicio (SLA)
• Podemos recopilar métricas de uso anónimas para mejorar el producto
• Tus comentarios y sugerencias nos ayudan a construir un mejor producto

El programa beta es gratuito. Nos reservamos el derecho de modificar las condiciones de acceso.

**Fecha de vigencia:** Válido durante el período beta (hasta notificación en contrario).`,
  },

  /** Consent text for onboarding checkbox */
  consentCheckbox:
    'Acepto los términos del programa beta y la política de privacidad de AssistAI. ' +
    'Entiendo que mis documentos serán procesados para generar sugerencias de escritura.',

  /** Short privacy summary for footer/settings */
  shortSummary:
    'AssistAI encripta tus documentos, no los comparte con terceros y no los usa para entrenar modelos de IA. ' +
    'Podés eliminar tus datos en cualquier momento.',
} as const;
