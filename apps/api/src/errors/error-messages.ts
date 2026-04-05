import { ErrorCode } from './error-codes';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.INFRA_CONNECTION_REFUSED]:
    'El servicio temporalmente no está disponible. Intenta de nuevo en unos minutos.',
  [ErrorCode.INFRA_TIMEOUT]:
    'La conexión tardó demasiado. Verifica tu conexión a internet.',
  [ErrorCode.INFRA_NOT_FOUND]:
    'No se pudo conectar al servidor. Intenta de nuevo.',
  [ErrorCode.INFRA_REDIS_CONFIG]:
    'Error de configuración del servidor. Contacta soporte.',
  [ErrorCode.DB_DUPLICATE_KEY]:
    'Ya existe un registro con esos datos.',
  [ErrorCode.DB_NULL_VALUE]:
    'Falta información requerida. Completa todos los campos.',
  [ErrorCode.DB_ERROR]:
    'Error de base de datos. Intenta más tarde.',
  [ErrorCode.AUTH_INVALID_CREDENTIALS]:
    'Credenciales incorrectas. Verifica tu email y contraseña.',
  [ErrorCode.AUTH_UNAUTHORIZED]:
    'Sesión expirada o inválida. Inicia sesión nuevamente.',
  [ErrorCode.AUTH_FORBIDDEN]:
    'No tienes permiso para realizar esta acción.',
  [ErrorCode.AUTH_PROVIDER_ERROR]:
    'Error de autenticación con el proveedor de IA.',
  [ErrorCode.COMPLETION_TIMEOUT]:
    'La solicitud tardó demasiado. Intentá de nuevo.',
  [ErrorCode.COMPLETION_NO_PROVIDER]:
    'No hay proveedores de IA disponibles en este momento.',
  [ErrorCode.COMPLETION_QUOTA_EXHAUSTED]:
    'Se agotó la cuota gratuita de IA. Probá más tarde.',
  [ErrorCode.COMPLETION_RATE_LIMITED]:
    'Hay muchas solicitudes. Esperá un momento e intentá de nuevo.',
  [ErrorCode.COMPLETION_PROVIDERS_UNAVAILABLE]:
    'Los proveedores de IA no están disponibles temporalmente.',
  [ErrorCode.COMPLETION_ALL_FAILED]:
    'Ningún proveedor de IA pudo completar la solicitud en este momento.',
  [ErrorCode.COMPLETION_BAD_REQUEST]:
    'La solicitud no pudo procesarse (modelo o parámetros inválidos).',
  [ErrorCode.GENERIC_ERROR]:
    'Algo salió mal. Intenta de nuevo.',
};
