# Gráficas de alimentación

La pantalla **Informes** de la app móvil consulta las gráficas de esta API con el
token de la sesión activa. No se requiere una colección de gráficas adicional:
los datos salen de `historial_alimentacion` y `mascotas`.

## Estimación de raciones

Al registrar una mascota se conserva su raza y se solicita su tamaño
(`Pequeña`, `Mediana` o `Grande`) además del peso. El backend calcula una
ración diaria orientativa según especie, tamaño y peso. Si se registra una
ración diaria indicada por un veterinario, esta sustituye el cálculo general y
se distribuye entre los horarios programados para cada día. En ambos casos,
las porciones se guardan en `horarios_alimentacion`; al registrar una
alimentación, los gramos calculados se guardan en `historial_alimentacion`.
La autoevaluación de condición corporal muestra una advertencia orientativa,
pero no cambia automáticamente los gramos: cualquier ajuste debe confirmarlo
un veterinario.

Como el dispensador atiende a una mascota por vez, no se permiten horarios
activos a menos de 60 minutos entre sí para los mismos días, aunque sean de
mascotas distintas. La validación también considera horarios cercanos que
cruzan la medianoche.

El formulario permite programar opcionalmente desayuno, almuerzo y merienda,
compartiendo los días seleccionados. `POST /feeding/schedules/batch` guarda
todos los horarios juntos y devuelve la hora y los gramos calculados para
cada día de cada comida. La porción se distribuye entre todos los horarios
activos de esa mascota en cada día; los horarios existentes del dispensador
también se revisan para evitar conflictos antes de guardar.
En la pantalla de alimentación se puede abrir el detalle de cada horario y
desactivarlo con `DELETE /feeding/schedules/{schedule_id}`. La desactivación
lo retira de los horarios activos y del dispensador, pero conserva el
documento en la base de datos; las porciones de los horarios restantes se
recalculan.

Los valores por especie/tamaño se pueden ajustar en `backend/feeding.py`. Son
estimaciones generales, no una indicación veterinaria; confirma la cantidad
adecuada con la etiqueta del alimento y un veterinario.

## Evaluación orientativa de condición corporal

La app guarda la autoevaluación de cada mascota con
`PATCH /pets/{pet_id}/body-condition` y una puntuación de 1 a 9. Solo se
aceptan perros y gatos. La puntuación y la fecha se conservan en el perfil; si
cambia la especie, tamaño o peso, la evaluación anterior se elimina para que
se vuelva a realizar. Es una autoevaluación orientativa, no un diagnóstico
veterinario.

## Endpoints

Todos requieren el encabezado `Authorization: Bearer <access_token>` y responden
con una imagen PNG:

```text
GET /api/v1/graficas/usuario/lineas
GET /api/v1/graficas/usuario/barras
GET /api/v1/graficas/usuario/histograma
```

- `lineas`: suma por día de `porcion_entregada`.
- `barras`: cantidad de registros de alimentación por mascota.
- `histograma`: distribución de porciones entregadas.

Cada consulta filtra por el usuario autenticado. La colección
`historial_alimentacion` guarda `usuario_id`, `mascota_id`, `fecha_hora` y
`porcion_entregada`; `mascotas` relaciona el ID de cada mascota con su nombre.
Si el usuario aún no tiene registros, la API responde `404`.

## Exportación de reportes de alimentación

La app solicita el PDF de una mascota autenticada con:

```text
POST /reports/exports
Content-Type: application/json

{
  "mascota_id": "<id-de-la-mascota>",
  "tipo_reporte": "Alimentación - Luna",
  "nombre_archivo": "reporte_Luna.pdf"
}
```

La API solo exporta los registros de esa mascota pertenecientes al usuario de
la sesión. Después de generar correctamente el PDF, guarda un documento en
`reportes_exportados` con `usuario_id`, `usuario_nombre`, `mascota_id`,
`mascota_nombre`, `tipo_reporte`, `nombre_archivo`, `formato`,
`fecha_exportacion`, `cantidad_registros` y `registros_ids` (hasta 50 registros,
los mismos incluidos en el PDF). El archivo se devuelve como PDF para que la
app pueda compartirlo o guardarlo; si no hay registros, la API responde `404`
y no registra una exportación.

## Notificaciones del panel

```text
GET /api/notificaciones/{usuario_id}
```

Requiere el token de sesión en `Authorization: Bearer <token>` y solo permite
consultar el ID asociado a ese token. Devuelve hasta 50 notificaciones,
ordenadas primero por urgencia: vacunas vencidas o próximas a vencer (hasta
15 días), citas próximas (hasta 15 días) y registros de alimentación de las últimas 24 horas. Cada objeto
incluye `id`, `tipo`, `titulo`, `mensaje`, `fecha_hora`, `prioridad` y `fuente`.

La app permite ocultar notificaciones individualmente guardando esa preferencia
solo en el almacenamiento local del dispositivo. Esta acción no modifica ni
elimina registros en la base de datos. Alimentaciones y alertas del dispositivo
de más de 24 horas no se muestran; los recordatorios de vacunas se muestran dos
días antes de la próxima dosis y continúan visibles mientras estén vencidos.
Las citas se notifican un día antes, según la zona horaria guardada con la cita.

## Zona horaria de las citas

`POST /appointments` recibe `fecha` (`AAAA-MM-DD`), `hora` (`HH:MM`) y
`zona_horaria` con una zona IANA del dispositivo, por ejemplo
`America/Guayaquil`. La fecha y hora se conservan como hora local de la cita;
la zona se usa para calcular sus recordatorios sin aplicar el huso horario del
servidor. Las citas guardadas antes de incluir `zona_horaria` no tienen una
zona de origen y sus recordatorios se interpretan con la zona local del
servidor.

## Ejecutar en desarrollo local

Desde la raíz del proyecto, instala las dependencias del backend y arranca
FastAPI:

```powershell
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Configura `MONGODB_URI`, `MONGODB_DATABASE` y `PETCARE_TOKEN_SECRET` en
`backend\.env`. Para verificar que el correo sea entregable antes de crear la
cuenta, configura `ABSTRACT_EMAIL_REPUTATION_API_KEY` con una clave de
**Email Reputation** de Abstract API en `backend\.env`. Por compatibilidad, el
backend también acepta el nombre anterior `ABSTRACT_EMAIL_VALIDATION_API_KEY`
si no está configurado el nuevo. La clave se usa únicamente en el backend; no la
agregues al `.env` del móvil, a `EXPO_PUBLIC_*` ni al repositorio. Si falta la
clave o el proveedor no está disponible, el registro responde con error y no
crea la cuenta.

La recuperación de contraseña solicita el correo y el nombre completo registrados.
Si coinciden, la app permite definir una contraseña nueva. La verificación genera
un token temporal de un solo uso, almacenado como hash, que vence en 10 minutos.
Se limitan a cinco los intentos por combinación de IP y correo durante 15 minutos.

Esta alternativa no prueba que la persona controle el buzón: quien conozca el
correo y el nombre completo puede cambiar la contraseña. Úsala solo temporalmente
y vuelve a la recuperación por correo cuando el servicio SMTP esté disponible.

El móvil debe tener `EXPO_PUBLIC_API_URL` apuntando a la IP local de la
computadora y estar conectado a la misma red Wi-Fi.

Al iniciar la app con `npm start`, `update-ip.js` actualiza automáticamente
`EXPO_PUBLIC_API_URL` en el `.env` de la raíz con la IP Wi-Fi actual. Si la IP
cambia, vuelve a iniciar Expo y carga de nuevo el proyecto en Expo Go. La API
debe seguir ejecutándose en otra terminal. Si el teléfono no conecta, permite
el tráfico entrante de Python/puerto 8000 en el firewall de Windows y comprueba
`http://<IP-WI-FI-DE-LA-PC>:8000/health` desde el teléfono.

## HTTPS en la red local

HTTPS requiere un certificado TLS válido para la IP Wi-Fi del equipo. Para
desarrollo se puede usar [mkcert](https://github.com/FiloSottile/mkcert) y
confiar su CA local en el equipo y en el teléfono. No compartas la clave privada
del certificado ni la clave de la CA.

1. Instala mkcert y, desde la raíz del proyecto, crea la CA local:

   ```powershell
   mkcert -install
   ```

2. Consulta la dirección IPv4 de la interfaz Wi-Fi con `ipconfig`. Crea los
   archivos del certificado usando esa dirección en lugar de `192.168.1.20`:

   ```powershell
   New-Item -ItemType Directory -Force backend\certs
   mkcert -cert-file backend\certs\api.pem -key-file backend\certs\api-key.pem 192.168.1.20 localhost 127.0.0.1
   ```

   Los archivos `.pem` están excluidos de Git.

3. Arranca la API con TLS:

   ```powershell
   backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 --ssl-certfile backend\certs\api.pem --ssl-keyfile backend\certs\api-key.pem
   ```

4. Añade `EXPO_PUBLIC_API_SCHEME=https` al `.env` de la raíz del proyecto y
   vuelve a iniciar Expo (`npm start`). El script `update-ip.js` conservará
   `https` al generar `EXPO_PUBLIC_API_URL` para la IP Wi-Fi.

Instala únicamente el certificado raíz público (`rootCA.pem`, cuya ruta se
obtiene con `mkcert -CAROOT`) en el teléfono y márcalo como confiable. Nunca
instales ni copies `rootCA-key.pem`. La app debe ejecutarse en un entorno que
confíe en esa CA; Expo Go puede no confiar en certificados raíz instalados por
el usuario. Si ocurre, usa un development build con confianza de CA configurada
o un certificado emitido por una autoridad ya confiable en el dispositivo.

## ESP32: horarios y dispensaciones

Cada ESP32 se autentica con un token exclusivo para la mascota. El endpoint
`POST /pets/{pet_id}/device-token` genera el token y lo muestra una sola vez;
la aplicación ya no incluye la opción de vinculación en el perfil de mascota.
Configura el token en el dispositivo y no lo incluyas en repositorios ni lo
compartas. Generar otro token revoca el anterior. El dispositivo debe usar
HTTPS fuera de una red de desarrollo confiable.

El ESP32 consulta los horarios activos (hora local programada, días, porciones
por día y datos básicos de la mascota) con:

```text
GET /device/feeding/schedules
X-Device-Token: <token-de-esa-mascota>
```

Después de confirmar que el motor dispensó el alimento, registra el evento:

```text
POST /device/feeding/events
X-Device-Token: <token-de-esa-mascota>
Content-Type: application/json

{
  "evento_id": "id-unico-generado-por-el-esp32",
  "horario_id": "<horario_id-recibido>",
  "porcion_entregada": 35
}
```

`evento_id` debe mantenerse igual al reintentar una transmisión: la API evita
duplicar ese registro. Cada dispensación confirmada se guarda en
`historial_alimentacion` con mascota, usuario, horario, gramos, hora del
servidor y origen `esp32`; la respuesta incluye `push_status`. No informes una
dispensación hasta que el movimiento del motor haya terminado correctamente.
El historial alimenta también las notificaciones dentro de la app.

## Notificaciones push

La app registra el token push de Expo al iniciar una sesión y el backend envía
una notificación cuando recibe una dispensación real del ESP32. El usuario debe
tener habilitadas las notificaciones push y los recordatorios de alimentación.
Los tokens push se guardan por usuario en MongoDB.

Las notificaciones remotas requieren configurar las credenciales de Android
(FCM) y/o iOS (APNs) para el proyecto Expo/EAS y ejecutar un development build o
una compilación de producción. **Expo Go no admite notificaciones push remotas
en Android desde SDK 53**; los avisos locales dentro de la app siguen
funcionando. Si el servidor devuelve `no_registered_token` o `failed`, revisa
los permisos del sistema, el token Expo registrado y las credenciales de la
plataforma. Las respuestas push fallidas se registran en el historial sin
perder el evento de alimentación.

## Documentos de `alertas_dispositivo`

Cuando el ESP32 confirma una dispensación, además del historial se guarda una
alerta asociada al evento. El `evento_id` tiene índice único para evitar
alertas repetidas en reintentos. El documento contiene, por ejemplo:

```json
{
  "_id": "<ObjectId>",
  "usuario_id": "<id-del-usuario>",
  "mascota_id": "<ObjectId-de-la-mascota>",
  "mascota_nombre": "Luna",
  "tipo": "alimentacion",
  "titulo": "Alimentación completada",
  "mensaje": "Luna recibió 35 g de alimento a las 08:00.",
  "prioridad": "normal",
  "fecha_hora": "<fecha-hora-local-con-zona>",
  "leida": 0,
  "origen": "esp32",
  "evento_id": "<id-idempotente-del-evento>",
  "registro_alimentacion_id": "<ObjectId-del-historial>",
  "horario_id": "<ObjectId-del-horario>",
  "porcion_entregada": 35,
  "push_status": "sent"
}
```

`push_status` puede ser `sent`, `failed`, `no_registered_token` o `disabled`.
Se conserva la alerta aunque no haya token push o falle el envío. El endpoint
autenticado `GET /alerts` y la pantalla de notificaciones consultan estas
alertas del usuario; la pantalla las combina con recordatorios de vacunas y
evita duplicar dispensaciones ya registradas como alertas persistentes.

## Perfil y mascotas

Los cambios del perfil y de los datos de cada mascota se guardan en MongoDB.
Eliminar una mascota solicita confirmación y borra también sus horarios,
registros de alimentación, vacunas, historial médico y citas. La app ofrece
Español e Inglés; la selección se guarda en las preferencias del usuario.
