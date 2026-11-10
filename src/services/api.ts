import { File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
const ACCESS_TOKEN_STORAGE_KEY = 'petcare.accessToken';
const AUTH_USER_STORAGE_KEY = 'petcare.authUser';
  
export type ApiHealth = {
  status: 'ok';
  database: 'connected';
  collections: string[];
};

export type ApiUser = {
  id: string;
  nombre: string;
  email: string;
};

export type AuthResponse = {
  access_token: string;
  user: ApiUser;
};

export type ChartType = 'histograma' | 'barras' | 'lineas';

let accessToken: string | null = null;

export async function setAccessToken(token: string | null, user?: ApiUser) {
  if (token) {
    await AsyncStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    if (user) {
      await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  } else {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY]);
  }
  accessToken = token;
}

export async function restoreSession() {
  const [token, userJson] = await Promise.all([
    AsyncStorage.getItem(ACCESS_TOKEN_STORAGE_KEY),
    AsyncStorage.getItem(AUTH_USER_STORAGE_KEY),
  ]);
  accessToken = token;

  if (!token) return null;
  if (!userJson) return { token, user: null };

  try {
    const user = JSON.parse(userJson) as Partial<ApiUser>;
    if (
      typeof user.id === 'string' &&
      typeof user.nombre === 'string' &&
      typeof user.email === 'string'
    ) {
      return { token, user: user as ApiUser };
    }
  } catch (error) {
    console.error('No se pudieron leer los datos guardados de la sesión:', error);
  }
  return { token, user: null };
}

function getAuthorizationHeader() {
  if (!accessToken) {
    throw new Error('Inicia sesión de nuevo para ver tus gráficas.');
  }
  return `Bearer ${accessToken}`;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  if (!API_BASE_URL) {
    throw new Error(
      'No se configuró la URL de la API. Inicia Expo con "npm start" para detectar la IP actual de tu computadora.',
    );
  }

  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', getAuthorizationHeader());

  try {
    return await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    const reason = error instanceof Error ? ` (${error.message})` : '';
    throw new Error(
      `No se pudo conectar con la API en ${API_BASE_URL}. Inicia el backend en el puerto 8000, conecta el celular y la computadora a la misma Wi-Fi y vuelve a abrir Expo con "npm start".${reason}`,
    );
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof payload?.detail === 'string' ? payload.detail : `API respondió con estado ${response.status}`;
    throw new Error(detail);
  }
  return payload as T;
}

export async function getChartImageUri(chartType: ChartType): Promise<string> {
  if (!accessToken) {
    throw new Error('Inicia sesión de nuevo para ver tus gráficas.');
  }

  const response = await apiFetch(`/api/v1/graficas/usuario/${chartType}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail =
      typeof payload?.detail === 'string'
        ? payload.detail
        : `No se pudo cargar la gráfica (${response.status}).`;
    throw new Error(detail);
  }

  if (!response.headers.get('content-type')?.includes('image/png')) {
    throw new Error('La respuesta no contiene una imagen válida.');
  }

  const file = new File(
    Paths.cache,
    `grafica_${chartType}_${Date.now()}.png`,
  );
  file.create();
  file.write(new Uint8Array(await response.arrayBuffer()));
  return file.uri;
}

export async function checkApiHealth(): Promise<ApiHealth> {
  return apiRequest<ApiHealth>('/health');
}

export function registerWithApi(data: {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
}) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function loginWithApi(data: { email: string; password: string }) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function requestPasswordReset(data: { email: string; nombre: string }) {
  return apiRequest<{ reset_token: string; message: string }>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function confirmPasswordReset(data: { token: string; password: string }) {
  return apiRequest<{ message: string }>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getApi<T>(path: string) {
  return apiRequest<T>(path);
}

export function postApi<T>(path: string, data: Record<string, unknown>) {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(data) });
}

export async function postPdfApi(
  path: string,
  data: Record<string, unknown>,
  fileName = `reporte_alimentacion_${Date.now()}.pdf`,
) {
  if (!accessToken) {
    throw new Error('Inicia sesión de nuevo para descargar el informe.');
  }

  const response = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail =
      typeof payload?.detail === 'string'
        ? payload.detail
        : 'No se pudo generar el informe.';
    throw new Error(detail);
  }

  if (!response.headers.get('content-type')?.includes('application/pdf')) {
    throw new Error('La respuesta no contiene un archivo PDF válido.');
  }

  const file = new File(Paths.cache, fileName);
  file.create();
  file.write(new Uint8Array(await response.arrayBuffer()));
  return file.uri;
}

export function patchApi<T>(path: string, data: Record<string, unknown>) {
  return apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteApi<T>(path: string) {
  return apiRequest<T>(path, { method: 'DELETE' });
}
