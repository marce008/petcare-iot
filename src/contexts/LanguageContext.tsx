import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert as NativeAlert, Text, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage = 'Español' | 'Inglés';

const LANGUAGE_STORAGE_KEY = '@petcare/language';

const EN_TRANSLATIONS: Record<string, string> = {
  '+ Agregar': '+ Add',
  'Acciones rápidas': 'Quick actions',
  'Aceptar términos': 'Accept terms',
  'Acepto los': 'I accept the',
  'Activa la interfaz en colores oscuros.': 'Use a dark color scheme.',
  'Actualiza tus datos': 'Update your information',
  'Actualiza tus datos en segundo plano.': 'Sync your data in the background.',
  Agregar: 'Add',
  'Agregar nueva mascota': 'Add a new pet',
  'Alimentación semanal (gramos)': 'Weekly feeding (grams)',
  'Alimentación registrada': 'Feeding recorded',
  'Horario eliminado': 'Schedule removed',
  'El horario se desactivó y ya no se enviará al dispensador.':
    'The schedule was deactivated and will no longer be sent to the dispenser.',
  'No se pudo eliminar el horario': 'Could not remove the schedule',
  'Detalle del horario': 'Schedule details',
  'Eliminar horario': 'Remove schedule',
  'Ver detalle del horario': 'View schedule details',
  'Porción por día': 'Portion per day',
  'por horario': 'per schedule',
  'Mascota': 'Pet',
  'Días': 'Days',
  Desayuno: 'Breakfast',
  Almuerzo: 'Lunch',
  Merienda: 'Snack',
  'Horarios de comida': 'Meal times',
  'Puedes programar desayuno, almuerzo, merienda o solo las comidas que necesites. Todas usarán los mismos días seleccionados.':
    'Schedule breakfast, lunch, snack, or only the meals you need. All selected meals will use the same days.',
  Opcional: 'Optional',
  'Seleccionar hora': 'Select time',
  'Porción estimada para esta comida: ≈ ': 'Estimated portion for this meal: ≈ ',
  ' g.': ' g.',
  'Porción estimada según los horarios activos de esta mascota: ':
    'Estimated portion based on this pet’s active schedules: ',
  'Quitar horario': 'Remove time',
  'Las comidas seleccionadas se programarán ': 'Selected meals will be scheduled on ',
  'Debe haber al menos ': 'There must be at least ',
  ' minutos entre alimentaciones. Hay un horario en conflicto con ':
    ' minutes between feedings. A schedule conflicts with ',
  'El horario de ': 'The ',
  ' debe estar separado al menos ': ' schedule must be at least ',
  ' minutos de los otros horarios que seleccionaste.':
    ' minutes apart from the other schedules you selected.',
  ' y,': ' and,',
  'Comida': 'Meal',
  ' por comida.': ' per meal.',
  'La alimentación de': 'The feeding for',
  'quedó programada los días': 'was scheduled for the following days',
  'Ver horarios de alimentación': 'View feeding schedules',
  '¡Horario programado!': 'Feeding schedule created!',
  'Horario guardado': 'Schedule saved',
  'Sin horarios programados': 'No schedules programmed',
  'No se recibieron los detalles del horario. Consulta los horarios programados para confirmar la mascota, la hora y la porción.':
    'Schedule details were not received. Check the programmed schedules to confirm the pet, time, and portion.',
  'Condición corporal orientativa fuera del rango ideal; revisa la ración con el veterinario.':
    'Guided body condition is outside the ideal range; review the portion with your veterinarian.',
  'Porción calculada con la ración diaria indicada por el veterinario.':
    'Portion calculated from the daily amount prescribed by the veterinarian.',
  'Ración diaria indicada por veterinario (g/día)':
    'Daily amount prescribed by veterinarian (g/day)',
  'Ración indicada por el veterinario para ':
    'Amount prescribed by the veterinarian for ',
  'Ración diaria estimada para ': 'Estimated daily amount for ',
  'El sistema la divide entre los horarios activos de cada día.':
    'The app divides it across the active schedules for each day.',
  'El sistema la divide entre los horarios activos de cada día. Es una estimación; confirma la ración con la etiqueta del alimento o con el veterinario.':
    'The app divides it across the active schedules for each day. This is an estimate; confirm the amount using the food label or with your veterinarian.',
  'La evaluación corporal orientativa está fuera del rango ideal. Consulta al veterinario antes de cambiar la ración.':
    'The guided body condition assessment is outside the ideal range. Consult your veterinarian before changing the amount.',
  'Ración diaria estimada: ': 'Estimated daily amount: ',
  'Ración diaria veterinaria: ': 'Veterinarian-prescribed daily amount: ',
  'Ración diaria no válida': 'Invalid daily amount',
  'Ingresa una cantidad mayor que cero indicada por el veterinario, o deja el campo vacío.':
    'Enter an amount greater than zero prescribed by your veterinarian, or leave this field empty.',
  'Opcional. Si la ingresas, la app distribuirá este total entre los horarios. Si la dejas vacía, usará una estimación general.':
    'Optional. If entered, the app will split this total across schedules. If left blank, it will use a general estimate.',
  'Para usar una ración ajustada por tu veterinario, ingrésala en «Editar datos».':
    'To use an amount adjusted by your veterinarian, enter it under “Edit details”.',
  'Revisa la ración con un veterinario. La evaluación corporal no modifica automáticamente los gramos.':
    'Review the amount with a veterinarian. The body assessment does not automatically change the grams.',
  'Ración diaria indicada por un veterinario':
    'Daily amount prescribed by a veterinarian',
  Alimentar: 'Feed',
  'Aquí verás las alertas de vacunación, alimentación y recordatorios.':
    'Vaccination, feeding, and reminder alerts will appear here.',
  'Aún no hay registros de alimentación para esta mascota.':
    'There are no feeding records for this pet yet.',
  Biografía: 'Bio',
  'Calendario de vacunación': 'Vaccination calendar',
  Cancelar: 'Cancel',
  'Cargando datos de la mascota...': 'Loading pet information...',
  Cerrar: 'Close',
  'Cerrar sesión': 'Sign out',
  Citas: 'Appointments',
  Ciudad: 'City',
  'Clínica / Hospital': 'Clinic / Hospital',
  'Color / Pelaje': 'Color / Coat',
  'Comprueba tu conexión e inténtalo de nuevo al volver a esta pantalla.':
    'Check your connection and try again when you return to this screen.',
  Configuración: 'Settings',
  'Confirmar cita': 'Confirm appointment',
  'Fecha y hora no válidas': 'Invalid date and time',
  'Selecciona una fecha y hora futuras para la cita.':
    'Select a future date and time for the appointment.',
  'Confirmar contraseña': 'Confirm password',
  'Consumo (g)': 'Consumed (g)',
  Contraseña: 'Password',
  'Controla los horarios y porciones de tus mascotas': 'Manage your pets’ schedules and portions',
  'Correo electrónico': 'Email',
  'Crear cuenta': 'Create account',
  Cuenta: 'Account',
  'Cuidado inteligente para tus mascotas': 'Smart care for your pets',
  Edad: 'Age',
  'Editar datos': 'Edit details',
  'Editar perfil': 'Edit profile',
  'Eliminar mascota': 'Delete pet',
  'Eliminar foto': 'Remove photo',
  'Enviar instrucciones': 'Send instructions',
  'Verificar tu cuenta': 'Verify your account',
  'Crear contraseña nueva': 'Create a new password',
  'Ingresa el correo y el nombre completo que registraste en tu cuenta.':
    'Enter the email and full name registered to your account.',
  'Elige una contraseña de al menos 8 caracteres. El código temporal vence en 10 minutos.':
    'Choose a password with at least 8 characters. The temporary code expires in 10 minutes.',
  'Nombre completo registrado': 'Registered full name',
  'Nombre y apellidos': 'First and last name',
  'Mínimo 8 caracteres': 'At least 8 characters',
  'Repite la contraseña': 'Confirm the password',
  'Verificar datos': 'Verify details',
  'Guardar contraseña': 'Save password',
  'Procesando...': 'Processing...',
  'Contraseña actualizada': 'Password updated',
  'Tu contraseña se cambió correctamente. Inicia sesión con tu nueva contraseña.':
    'Your password was changed successfully. Sign in with your new password.',
  'Ingresa un correo electrónico válido.': 'Enter a valid email address.',
  'Ingresa el nombre completo registrado en la cuenta.':
    'Enter the full name registered to the account.',
  'La contraseña debe tener al menos 8 caracteres.':
    'The password must have at least 8 characters.',
  'No se pudieron verificar los datos.': 'Could not verify the details.',
  'No se pudo cambiar la contraseña.': 'Could not change the password.',
  'Especifica la especie': 'Specify the species',
  'Esta semana': 'This week',
  'Este mes': 'This month',
  Fecha: 'Date',
  'Fecha de aplicación': 'Date administered',
  'Fecha de nacimiento': 'Date of birth',
  'Edad actual': 'Current age',
  'Edad equivalente humana (aprox.)': 'Human-equivalent age (approx.)',
  Tamaño: 'Size',
  'Menos de 1 mes': 'Under 1 month',
  'Sin fecha': 'No birth date',
  'Sin indicar': 'Not specified',
  'No hay vacunas registradas para esta mascota.':
    'No vaccines have been recorded for this pet.',
  'Seleccionar país': 'Select country',
  'Buscar país o código': 'Search country or calling code',
  'Número de teléfono': 'Phone number',
  'Revisa el número según el país seleccionado.': 'Check the number for the selected country.',
  'No se encontraron países.': 'No countries found.',
  'Revisa el número': 'Check the number',
  'Ingresa un número válido para el país seleccionado.': 'Enter a valid number for the selected country.',
  'Selecciona el país y código telefónico': 'Select country and calling code',
  'Gráficas de alimentación': 'Feeding charts',
  'Guardar horario': 'Save schedule',
  'Guardar registro': 'Save record',
  'Guárdalo y configúralo en el ESP32. Solo se muestra ahora; al generar otro token, el anterior dejará de funcionar.':
    'Save it and configure it on the ESP32. It is shown only once; generating another token will invalidate this one.',
  'Historial reciente': 'Recent history',
  Hora: 'Time',
  'Hora de alimentación': 'Feeding time',
  'Horario de hoy': 'Today’s schedule',
  'ID de microchip': 'Microchip ID',
  'Info de la app': 'App information',
  'Informe de alimentación': 'Feeding report',
  'Ingresa tu correo para iniciar una recuperación segura de contraseña.':
    'Enter your email to securely reset your password.',
  'Inicia sesión con huella o rostro.': 'Sign in with your fingerprint or face.',
  'Inicia sesión para continuar': 'Sign in to continue',
  'Intentar de nuevo': 'Try again',
  'Ir a iniciar sesión': 'Go to sign in',
  'La vacunación ha sido registrada exitosamente.': 'The vaccination was recorded successfully.',
  'La fecha de aplicación no puede ser futura.': 'The application date cannot be in the future.',
  'La próxima fecha no puede ser anterior a la fecha de aplicación.':
    'The next date cannot be earlier than the application date.',
  Listo: 'Done',
  Mascotas: 'Pets',
  'Mis mascotas': 'My pets',
  'Motivo / Notas': 'Reason / Notes',
  'No hay citas para este día': 'No appointments for this day',
  'No hay horarios activos para esta mascota.': 'There are no active schedules for this pet.',
  'No hay horarios programados para hoy.': 'There are no schedules for today.',
  'No hay notificaciones': 'No notifications',
  'No hay notificaciones nuevas para tu cuenta.': 'There are no new notifications for your account.',
  'No hay próximas citas': 'No upcoming appointments',
  'No hay vacunas registradas': 'No vaccines have been recorded',
  'No olvides las próximas vacunas.': 'Stay up to date on upcoming vaccines.',
  'No se pudieron cargar': 'Could not load',
  'No se pudieron cargar las notificaciones. Inténtalo de nuevo más tarde.':
    'Could not load notifications. Try again later.',
  'No se envió ningún correo. El servidor todavía no tiene configurado el envío de enlaces de recuperación o códigos de verificación.':
    'No email was sent. The server has not configured password reset links or verification codes yet.',
  'Añade una mascota y registra al menos una alimentación para ver el informe por mascota.':
    'Add a pet and record at least one feeding to see its report.',
  'No pudimos cargar tus totales. Comprueba tu conexión a internet e inténtalo de nuevo.':
    'We could not load your totals. Check your internet connection and try again.',
  'No se puede calcular la ración: verifica el peso y el tamaño de esta mascota.':
    'The portion cannot be calculated. Check this pet’s weight and size.',
  'No tienes horarios programados. Crea uno para tus mascotas.':
    'You have no feeding schedules. Create one for your pets.',
  'Nombre completo': 'Full name',
  'Nombre de la mascota': 'Pet name',
  Notas: 'Notes',
  Notificaciones: 'Notifications',
  'Nueva cita': 'New appointment',
  'Número de lote': 'Lot number',
  'Olvidé mi contraseña': 'Forgot password',
  Peso: 'Weight',
  'Peso (kg)': 'Weight (kg)',
  'Política de privacidad': 'Privacy policy',
  'Cita próxima': 'Upcoming appointment',
  'Políticas de seguridad': 'Security policies',
  'Seguridad y privacidad': 'Security and privacy',
  'Usa una contraseña única y no la compartas. Mantén tu app y dispositivo actualizados. Nunca compartas códigos SMS ni el token del ESP32. Cierra sesión en equipos compartidos y vincula solo dispositivos de confianza. Si sospechas de un acceso no autorizado, cambia tu contraseña y contacta al administrador. Evita incluir datos sensibles en las notas de tus mascotas.':
    'Use a unique password and do not share it. Keep your app and device updated. Never share SMS codes or your ESP32 token. Sign out on shared devices and connect only trusted devices. If you suspect unauthorized access, change your password and contact the administrator. Avoid putting sensitive information in pet notes.',
  'PETCARE IoT usa los datos de tu cuenta y de tus mascotas para ofrecer seguimiento de alimentación y salud. La información se almacena en el servidor de la aplicación y se utiliza para mostrar tus registros, recordatorios y reportes. La eliminación de una notificación en la app solo la oculta en este dispositivo y no borra el registro original. Si solicitas verificar tu teléfono, el número se envía al proveedor de SMS para entregar el código. Para solicitar la eliminación de tu cuenta o consultar tus datos, contacta al administrador del servicio.':
    'PETCARE IoT uses your account and pet data to provide feeding and health tracking. The information is stored on the application server and used to show your records, reminders, and reports. Removing a notification in the app only hides it on this device and does not erase the original record. If you request phone verification, your number is sent to the SMS provider to deliver the code. To request account deletion or access your data, contact the service administrator.',
  'Por mascota': 'By pet',
  'Programa una cita para organizar tu agenda.': 'Schedule an appointment to organize your calendar.',
  'Programa una cita y la verás en esta sección.': 'Schedule an appointment to see it here.',
  Programar: 'Schedule',
  'Programar alimentación': 'Schedule feeding',
  Promedio: 'Average',
  Próxima: 'Next',
  'Próxima alimentación': 'Next feeding',
  'Próxima fecha': 'Next date',
  'Fecha programada': 'Scheduled date',
  'Fecha de próxima dosis': 'Next dose date',
  'Programar próxima vacuna': 'Schedule next vaccine',
  'Registrar vacuna aplicada': 'Record an administered vaccine',
  'Guarda la fecha de una vacuna que ya recibió tu mascota.':
    'Save the date of a vaccine your pet has already received.',
  'Registra una vacuna futura y su fecha programada.':
    'Record a future vaccine and its scheduled date.',
  'Vacunas realizadas': 'Administered vaccines',
  'Vacunas futuras': 'Future vaccines',
  'Selecciona la fecha en que se aplicó la vacuna.':
    'Select the date the vaccine was administered.',
  'Selecciona la fecha programada de la vacuna.':
    'Select the scheduled date for the vaccine.',
  'La fecha programada debe ser hoy o una fecha futura.':
    'The scheduled date must be today or a future date.',
  Próximas: 'Upcoming',
  'Próximos horarios': 'Upcoming schedules',
  'Recibe alertas directas en tu dispositivo.': 'Receive alerts directly on your device.',
  'Recibe alertas por correo.': 'Receive alerts by email.',
  'Recibe avisos de horarios y entregas.': 'Receive schedule and delivery alerts.',
  'Recibe avisos de tus citas veterinarias.': 'Receive veterinary appointment reminders.',
  'Revisa tu correo': 'Check your email',
  'Si el correo está asociado a una cuenta, recibirás un enlace para crear una contraseña nueva. Revisa también la carpeta de correo no deseado.':
    'If this email is associated with an account, you will receive a link to create a new password. Also check your spam folder.',
  '¿No te llegó? ': 'Didn’t receive it? ',
  'Solicitar otro enlace': 'Request another link',
  'Enviando...': 'Sending...',
  'Registra una nueva vacuna para comenzar tu calendario.':
    'Record a vaccine to start your calendar.',
  'Registrar vacuna': 'Record vaccine',
  Regresar: 'Back',
  'Repetir cada semana': 'Repeat every week',
  'Restablecer contraseña': 'Reset password',
  Saludable: 'Healthy',
  Teléfono: 'Phone',
  'Tipo de vacuna': 'Vaccine type',
  'Todo está al día': 'Everything is up to date',
  Vencida: 'Overdue',
  'Prioridad alta': 'High priority',
  'Token del ESP32': 'ESP32 token',
  'Tu cita ha sido confirmada. Revisa las notificaciones para recordatorios.':
    'Your appointment is confirmed. Check notifications for reminders.',
  'Tu información de perfil ha sido guardada.': 'Your profile information has been saved.',
  'Tu mascota ha sido registrada exitosamente.': 'Your pet was registered successfully.',
  'Términos de servicio': 'Terms of service',
  'Términos y Condiciones': 'Terms and Conditions',
  Vacunas: 'Vaccines',
  'Ver todo': 'See all',
  Versión: 'Version',
  Veterinario: 'Veterinarian',
  'Vincular ESP32': 'Pair ESP32',
  'Volver al inicio': 'Back to home',
  'Volver al inicio de sesión': 'Back to sign in',
  'Ya eres parte de PETCARE IoT. Inicia sesión con tu correo y contraseña para continuar.':
    'You are already part of PETCARE IoT. Sign in with your email and password to continue.',
  'quedó programada a las': 'was scheduled for',
  'los días': 'on',
  'Porción programada:': 'Scheduled portion:',
  'por comida': 'per meal',
  '¡Bienvenido de nuevo!': 'Welcome back!',
  '¡Cita programada!': 'Appointment scheduled!',
  '¡Cuenta creada!': 'Account created!',
  '¡Mascota agregada!': 'Pet added!',
  '¡Perfil actualizado!': 'Profile updated!',
  '¡Vacuna registrada!': 'Vaccine recorded!',
  '¿No lo recibiste?': 'Didn’t receive it?',
  '¿No tienes una cuenta?': 'Don’t have an account?',
  '¿Olvidaste tu contraseña?': 'Forgot your password?',
  'Últimas alertas de tu cuenta': 'Latest account alerts',
  'Únete a PETCARE IoT y comienza a gestionar la salud de tu mascota':
    'Join PETCARE IoT and start managing your pet’s health.',
  '¡Buenos días,': 'Good morning,',
  'en orden ✓': 'up to date ✓',
  registros: 'records',
  '********': '********',
  '+593 55 0000 0000': '593 555 000 0000',
  'Amante de los animales y orgullosa dueña de...': 'Animal lover and proud pet owner...',
  'Ciudad de Quito': 'Quito City',
  'Describe el motivo de la consulta...': 'Describe the reason for the visit...',
  'Dr. Nombre': 'Dr. Name',
  'Elegir mascota': 'Choose a pet',
  'Elige tu mascota': 'Choose your pet',
  'Escribe la raza de tu mascota': 'Enter your pet’s breed',
  'Especifica la vacuna': 'Specify the vaccine',
  'Instrucciones especiales...': 'Special instructions...',
  'Nombre de la clínica': 'Clinic name',
  'Notas especiales...': 'Special notes...',
  'Reacciones, observaciones...': 'Reactions, observations...',
  'Seleccionar': 'Select',
  'Seleccionar alimento': 'Select food',
  'Seleccionar especie': 'Select species',
  'Seleccionar mascota': 'Select a pet',
  'Seleccionar tamaño': 'Select size',
  'Tu nombre': 'Your name',
  'correo@ejemplo.com': 'email@example.com',
  'ej. 28': 'e.g. 28',
  'ej. Atigrado': 'e.g. Tabby',
  'ej. Erizo': 'e.g. Hedgehog',
  'ej. LOTE-2024-ABC': 'e.g. LOT-2024-ABC',
  'ej. Max': 'e.g. Max',
  'sara@correo.com': 'sara@example.com',
  'tu@correo.com': 'you@example.com',
  'Guardar cambios': 'Save changes',
  'Editar mascota': 'Edit pet',
  'No hay registros': 'No records',
  'Todos los días': 'Every day',
  Español: 'Spanish',
  Inglés: 'English',
  'Métrico (kg)': 'Metric (kg)',
  'Imperial (lb)': 'Imperial (lb)',
  'DD/MM/AAAA': 'DD/MM/YYYY',
  'MM/DD/AAAA': 'MM/DD/YYYY',
  'Seleccionar fecha': 'Select date',
  'Seleccionar tipo': 'Select type',
  'No especificado': 'Not specified',
  'No registrada': 'Not recorded',
  'Sin peso': 'No weight',
  'Tipo de comida': 'Meal type',
  'Tipo de alimento': 'Food type',
  'Siguiente': 'Next',
  'Anterior': 'Previous',
  'Detalles': 'Details',
  'Agregar foto': 'Add photo',
  'Cambiar foto': 'Change photo',
  'Guardar mascota': 'Save pet',
  'Guardar perfil': 'Save profile',
  'Selecciona los días de alimentación': 'Select feeding days',
  'No se pudieron cargar las gráficas.': 'Could not load charts.',
  'No hay datos suficientes para mostrar este gráfico.':
    'There is not enough data to display this chart.',
  Perro: 'Dog',
  Gato: 'Cat',
  Ave: 'Bird',
  Roedor: 'Rodent',
  Conejo: 'Rabbit',
  Caballo: 'Horse',
  Reptil: 'Reptile',
  Pez: 'Fish',
  Otro: 'Other',
  Macho: 'Male',
  Hembra: 'Female',
  Pequeña: 'Small',
  Mediana: 'Medium',
  Grande: 'Large',
  Seco: 'Dry',
  Húmedo: 'Wet',
  Mixto: 'Mixed',
  Croquetas: 'Kibble',
  Lata: 'Can',
  Polvo: 'Powder',
  Barra: 'Bar',
  'Comida diaria': 'Daily food',
  'Cada día': 'Every day',
  'Próximo': 'Upcoming',
  Hecho: 'Done',
  Confirmada: 'Confirmed',
  Pendiente: 'Pending',
  Vacuna: 'Vaccine',
  Alimentación: 'Feeding',
  Salud: 'Health',
  Alimento: 'Food',
  Manual: 'Manual',
  'Sin datos': 'No data',
  'A las': 'At',
  'Aún no': 'Not yet',
  'Error': 'Error',
  'Permiso necesario': 'Permission required',
  'No se pudo seleccionar la foto': 'Could not select the photo',
  'Imagen demasiado grande': 'Image is too large',
  'Foto de la mascota': 'Pet photo',
  'Foto de perfil': 'Profile photo',
  '¿Quieres eliminar la foto de tu mascota?': 'Do you want to remove your pet’s photo?',
  '¿Quieres eliminar tu foto de perfil?': 'Do you want to remove your profile photo?',
  '¿Quieres eliminar tu foto de perfil? El cambio se guardará al guardar el perfil.':
    'Do you want to remove your profile photo? The change will be saved when you save your profile.',
  '¿Quieres eliminar la foto de tu mascota? El cambio se guardará al guardar los datos.':
    'Do you want to remove your pet’s photo? The change will be saved when you save the pet details.',
  'Tomar una foto': 'Take a photo',
  'Elegir de la galería': 'Choose from gallery',
  'Tamaño de la mascota': 'Pet size',
  'Género': 'Sex',
  Programada: 'Scheduled',
  'Alimento diario': 'Daily food',
  'Porción diaria': 'Daily portion',
  'Enfermedad': 'Condition',
  'Hoy,': 'Today,',
  'Mis mascotas (': 'My pets (',
  'Próxima alimentación: Mañana': 'Next feeding: Tomorrow',
  'prom.': 'avg.',
  'g/día': 'g/day',
  'años': 'years',
  'g promedio /': 'g average /',
  'g recomendado': 'g recommended',
  'de la meta diaria': 'of the daily goal',
  '· Aplicada:': '· Administered:',
  'días': 'days',
  'día(s)': 'day(s)',
  'Cada semana': 'Every week',
  'Mi perfil': 'My profile',
  'Nombre': 'Name',
  'Especie': 'Species',
  'Raza': 'Breed',
  'Ración': 'Portion',
  'Porción': 'Portion',
  'Fecha y hora': 'Date and time',
  'Aún no hay datos': 'There is no data yet',
  'Aún no hay registros': 'There are no records yet',
  'No hay datos disponibles': 'No data available',
  'Abrir política...': 'Open policy...',
  'Agrega el peso y tamaño de la mascota para calcular su ración.':
    'Add your pet’s weight and size to calculate its portion.',
  'Eliminar notificación': 'Delete notification',
  'No se pudo quitar la notificación': 'Could not hide the notification',
  '¿Quieres quitar esta notificación de tu lista?': 'Do you want to remove this notification from your list?',
  'Campos incompletos': 'Incomplete fields',
  'Completa los campos': 'Complete the fields',
  'Completa todos los campos obligatorios.': 'Complete all required fields.',
  'Correo no válido': 'Invalid email',
  'Debes aceptar los términos y condiciones.': 'You must accept the terms and conditions.',
  'El servidor todavía no está configurado para enviar códigos de verificación por correo. No se envió ningún mensaje.':
    'The server is not configured to send email verification codes. No message was sent.',
  'Elige de dónde quieres obtener la foto.': 'Choose where to get the photo.',
  'Elige de dónde quieres obtener tu foto.': 'Choose where to get your photo.',
  'Elige una imagen de menos de 5 MB.': 'Choose an image smaller than 5 MB.',
  Eliminar: 'Delete',
  'Escribe el nombre de la vacuna en el campo indicado.':
    'Enter the vaccine name in the indicated field.',
  'Escribe un correo electrónico válido.': 'Enter a valid email address.',
  'Faltan datos de la mascota': 'Pet information is missing',
  'Generar token': 'Generate token',
  'Informe exportado': 'Report exported',
  'Ingresa el tipo de vacuna.': 'Enter the vaccine type.',
  'Ingresa tu correo y contraseña.': 'Enter your email and password.',
  'Ingresa un peso mayor que cero.': 'Enter a weight greater than zero.',
  'Las contraseñas no coinciden.': 'The passwords do not match.',
  'Los datos de tu mascota se guardaron correctamente.': 'Your pet’s information was saved.',
  'Mascota actualizada': 'Pet updated',
  'No se pudo actualizar el perfil': 'Could not update the profile',
  'No se pudo actualizar la foto': 'Could not update the photo',
  'No se pudo crear la cuenta': 'Could not create the account',
  'No se pudo crear la cuenta.': 'Could not create the account.',
  'Nombre no válido': 'Invalid name',
  'El nombre solo puede contener letras y espacios.':
    'The name can only contain letters and spaces.',
  'El correo electrónico ingresado no existe o no es válido. Por favor, verifica tu dirección e inténtalo nuevamente.':
    'The email address you entered does not exist or is invalid. Please check your address and try again.',
  'No se pudo eliminar la mascota': 'Could not delete the pet',
  'No se pudo exportar el informe de la mascota.': 'Could not export the pet report.',
  'No se pudo guardar la preferencia de tema en este dispositivo.':
    'Could not save the theme preference on this device.',
  'No se pudo guardar la preferencia del tema en este dispositivo.':
    'Could not save the theme preference on this device.',
  'No se pudo iniciar sesión': 'Could not sign in',
  'No se pudo vincular el ESP32': 'Could not pair the ESP32',
  'No tienes mascotas registradas. Agrega una antes de registrar una vacuna.':
    'You have no pets yet. Add one before recording a vaccine.',
  'Nombre y correo son obligatorios.': 'Name and email are required.',
  'PETCARE IoT almacena los datos de tu cuenta y de tus mascotas para ofrecer seguimiento de alimentación y salud. Usa la aplicación para tus propios registros y protege tus credenciales. Puedes solicitar la eliminación de tu cuenta contactando al administrador del servicio.':
    'PETCARE IoT stores your account and pet information to track feeding and health. Use the app for your own records and protect your credentials. Contact the service administrator to request account deletion.',
  'Perfil actualizado': 'Profile updated',
  'Peso no válido': 'Invalid weight',
  'Revisa el formato del correo electrónico.': 'Check the email address format.',
  'Selecciona una mascota.': 'Select a pet.',
  'Selecciona una vacuna válida para la especie de tu mascota.':
    'Select a vaccine that is valid for your pet’s species.',
  'Sin mascotas': 'No pets',
  'Todos los campos obligatorios deben estar llenos.':
    'All required fields must be completed.',
  'Tus datos se guardaron correctamente.': 'Your information was saved successfully.',
  'Usuario no identificado. Inicia sesión de nuevo.':
    'User not identified. Please sign in again.',
  '¿Seguro que deseas cerrar sesión?': 'Are you sure you want to sign out?',
  'Sesión inválida o expirada': 'Invalid or expired session',
  'La contraseña debe tener al menos 8 caracteres': 'The password must be at least 8 characters long.',
  'Mascota no encontrada': 'Pet not found',
  'El correo electrónico ya está registrado': 'This email address is already registered.',
  'Abstract API rechazó la clave de validación. Revisa ABSTRACT_EMAIL_VALIDATION_API_KEY en backend/.env y reinicia el backend.':
    'Abstract API rejected the validation key. Check ABSTRACT_EMAIL_VALIDATION_API_KEY in backend/.env and restart the backend.',
  'Correo o contraseña incorrectos': 'Incorrect email or password',
  'El correo ya está en uso': 'This email address is already in use.',
  'El peso debe ser mayor que cero': 'Weight must be greater than zero.',
  'Credenciales del dispositivo inválidas': 'Invalid device credentials',
  'Horario de alimentación no encontrado': 'Feeding schedule not found',
  'Este horario no está programado para el día de hoy.':
    'This schedule is not set for today.',
  'La porción calculada no es válida.': 'The calculated portion is invalid.',
  'Aún no hay registros de alimentación para generar la gráfica.':
    'There are no feeding records to generate the chart yet.',
  'No puedes consultar notificaciones de otro usuario':
    'You cannot view another user’s notifications.',
  'Abdomen muy recogido; costillas y huesos se notan mucho.':
    'Very tucked abdomen; ribs and bones are highly visible.',
  'Abdomen recogido y casi sin cobertura de grasa.':
    'Tucked abdomen with almost no fat coverage.',
  'Al mirar a tu gato de lado y tocar suavemente el abdomen, ¿qué notas?':
    'When looking at your cat from the side and gently feeling the abdomen, what do you notice?',
  'Al mirar a tu gato desde arriba, ¿cómo se ve su cintura detrás de las costillas?':
    'When looking at your cat from above, how does its waist look behind the ribs?',
  'Al mirar a tu perro de lado, ¿cómo se ve el abdomen?':
    'When looking at your dog from the side, how does the abdomen look?',
  'Al mirar a tu perro desde arriba, ¿cómo se ve su cintura detrás de las costillas?':
    'When looking at your dog from above, how does its waist look behind the ribs?',
  'Al pasar suavemente los dedos por los costados, ¿cómo sientes las costillas?':
    'When gently running your fingers along the sides, how do the ribs feel?',
  'Aún no se ha completado una evaluación para esta mascota.':
    'No assessment has been completed for this pet yet.',
  'Bien recogido, con muy poca cobertura.': 'Well tucked, with very little coverage.',
  'Casi no se sienten por una cobertura marcada.':
    'Almost impossible to feel through a pronounced covering.',
  'Condición corporal': 'Body condition',
  'Cuesta sentirlas por la cobertura de grasa.':
    'They are difficult to feel through the fat covering.',
  'Depósito abdominal abundante y difícil de palpar.':
    'Abundant abdominal fat that is difficult to feel.',
  'Depósito de grasa abdominal evidente.': 'Noticeable abdominal fat deposit.',
  'En gatos, no evalúes un pliegue de piel suelta por sí solo: puede ser normal. Considera el contorno general y la palpación.':
    'For cats, do not assess a loose skin fold by itself; it may be normal. Consider the overall shape and feel.',
  'Esta autoevaluación no es un diagnóstico ni sustituye la revisión de un veterinario. Si tienes dudas, consulta a un profesional.':
    'This self-assessment is not a diagnosis and does not replace a veterinary examination. If you have concerns, consult a professional.',
  'Esta guía está disponible actualmente para perros y gatos. Para otras especies, solicita una evaluación a un veterinario especializado.':
    'This guide is currently available for dogs and cats. For other species, ask a veterinarian who specializes in them.',
  'Evaluación orientativa de condición corporal': 'Guided body condition assessment',
  'Evaluación guardada:': 'Assessment saved:',
  'Evaluar condición corporal': 'Assess body condition',
  'Guardar evaluación': 'Save assessment',
  'Guardando...': 'Saving...',
  'La guía está disponible actualmente para perros y gatos. Para otras especies, consulta a un veterinario especializado.':
    'This guide is currently available for dogs and cats. For other species, consult a veterinarian who specializes in them.',
  'Ligeramente recogido detrás de las costillas.':
    'Slightly tucked behind the ribs.',
  'Ligera cobertura; se puede palpar sin presionar.':
    'Light coverage; can be felt without pressing.',
  'Muy marcada; se notan mucho los huesos.':
    'Very pronounced; bones are highly visible.',
  'Muy recogido y con huesos claramente visibles.':
    'Very tucked with clearly visible bones.',
  'Muy estrecha y marcada detrás de las costillas.':
    'Very narrow and pronounced behind the ribs.',
  'No se distingue; el cuerpo se ve redondeado.':
    'Not distinguishable; the body looks rounded.',
  'Observa a tu mascota de pie y toca suavemente sus costados; no presiones. El peso por sí solo no determina la condición corporal.':
    'Observe your pet standing and gently feel its sides; do not press. Weight alone does not determine body condition.',
  'Evaluación pendiente': 'Assessment pending',
  'Poco recogido y con grasa visible.': 'Little tuck with visible fat.',
  'Poco visible o casi ausente.': 'Hardly visible or nearly absent.',
  Delgado: 'Underweight',
  'Condición ideal': 'Ideal condition',
  Sobrepeso: 'Overweight',
  Obesidad: 'Obesity',
  'Redondeado o colgante, con grasa marcada.':
    'Rounded or hanging, with pronounced fat.',
  'Repetir evaluación': 'Repeat assessment',
  'Resultado orientativo; no sustituye la valoración de un veterinario.':
    'Guided result; does not replace a veterinarian’s assessment.',
  'Se sienten con una ligera cobertura.': 'Felt with a light covering.',
  'Se sienten muy fácilmente, con cobertura mínima.':
    'Very easy to feel, with minimal coverage.',
  'Se ven claramente y casi no se siente grasa.':
    'Clearly visible with almost no fat felt.',
  'Sin evaluación registrada': 'No assessment recorded',
  'Ver resultado orientativo': 'View guided result',
  'Visible detrás de las costillas.': 'Visible behind the ribs.',
  'No se pudo guardar la evaluación': 'Could not save the assessment',
};

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  translate: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function translateText(text: string, language: AppLanguage) {
  if (language !== 'Inglés') return text;
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const exactTranslation = EN_TRANSLATIONS[text] ?? EN_TRANSLATIONS[normalizedText];
  if (exactTranslation) return exactTranslation;

  const deletedPet = text.match(/^¿Eliminar a (.+) y todos sus horarios, registros de comida, vacunas y citas\? Esta acción no se puede deshacer\.$/);
  if (deletedPet) {
    return `Delete ${deletedPet[1]} and all of its schedules, feeding records, vaccines, and appointments? This cannot be undone.`;
  }
  const fedPet = normalizedText.match(/^(.+) ha sido alimentado con ([\d.,]+)g de (.+) a las ([\d:]+)\.$/);
  if (fedPet) return `${fedPet[1]} was fed ${fedPet[2]} g of ${fedPet[3]} at ${fedPet[4]}.`;
  return normalizedText
    .replace(/\bLun\b/g, 'Mon')
    .replace(/\bMar\b/g, 'Tue')
    .replace(/\bMié\b/g, 'Wed')
    .replace(/\bJue\b/g, 'Thu')
    .replace(/\bVie\b/g, 'Fri')
    .replace(/\bSáb\b/g, 'Sat')
    .replace(/\bDom\b/g, 'Sun')
    .replace(/A las/g, 'At')
    .replace(/a las/g, 'at');
}

export function LanguageProvider({ children }: React.PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>('Español');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((saved) => {
        if (active && (saved === 'Español' || saved === 'Inglés')) {
          setLanguageState(saved);
        }
      })
      .catch((error) => console.error('No se pudo recuperar el idioma:', error));
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
  }, []);

  const translate = useCallback((text: string) => translateText(text, language), [language]);
  const value = useMemo(() => ({ language, setLanguage, translate }), [language, setLanguage, translate]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage debe utilizarse dentro de LanguageProvider.');
  return context;
}

export function useLocalizedAlert() {
  const { translate } = useLanguage();
  return useCallback(
    (
      title: string,
      message?: string,
      buttons?: NonNullable<Parameters<typeof NativeAlert.alert>[2]>,
    ) => {
      NativeAlert.alert(
        translate(title),
        message ? translate(message) : undefined,
        buttons?.map((button) => ({
          ...button,
          text: button.text ? translate(button.text) : button.text,
        })),
      );
    },
    [translate],
  );
}

type LocalizedTextProps = React.ComponentProps<typeof Text>;

export function AppText({ children, ...props }: LocalizedTextProps) {
  const { translate } = useLanguage();
  return (
    <Text {...props}>
      {React.Children.map(children, (child) => {
        if (typeof child !== 'string') return child;
        if (!child.trim()) return child;
        const leading = child.match(/^\s*/)?.[0] ?? '';
        const trailing = child.match(/\s*$/)?.[0] ?? '';
        const end = child.length - trailing.length;
        return `${leading}${translate(child.slice(leading.length, end))}${trailing}`;
      })}
    </Text>
  );
}

type LocalizedTextInputProps = React.ComponentProps<typeof TextInput>;

export function AppTextInput({ placeholder, ...props }: LocalizedTextInputProps) {
  const { translate } = useLanguage();
  return <TextInput {...props} placeholder={placeholder ? translate(placeholder) : placeholder} />;
}
