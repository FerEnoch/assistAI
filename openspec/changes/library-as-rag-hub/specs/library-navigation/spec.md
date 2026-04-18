## ADDED Requirements

### Requirement: Post-login redirect va a /library
Luego de autenticarse exitosamente (magic link o dev login), el sistema SHALL redirigir al usuario a `/library` en lugar de `/dashboard`.

#### Scenario: Login exitoso redirige a library
- **WHEN** el usuario completa el flujo de login (magic link verificado o dev login)
- **THEN** el sistema redirige a `/library`
- **THEN** la URL final en el browser es `/library`

#### Scenario: Sesión activa y ruta raíz
- **WHEN** un usuario autenticado navega a `/`
- **THEN** el sistema redirige a `/library`

#### Scenario: Ruta desconocida redirige a library
- **WHEN** un usuario autenticado navega a una ruta que no existe
- **THEN** el sistema redirige a `/library`

### Requirement: La ruta /dashboard no existe más
El sistema SHALL responder con redirect a `/library` para cualquier acceso a `/dashboard`.

#### Scenario: Acceso directo a /dashboard
- **WHEN** un usuario navega a `/dashboard` (autenticado o no)
- **THEN** el sistema redirige a `/library`

### Requirement: El logo del header navega a /library
El link del logo "AssistAI" en el header SHALL apuntar a `/library`.

#### Scenario: Click en logo
- **WHEN** el usuario hace click en el logo "AssistAI" del header
- **THEN** el browser navega a `/library`
