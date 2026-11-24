export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(
      (data && typeof data.error === 'string' ? data.error : null) ||
        `Request failed (${res.status})`,
      res.status
    );
  }

  return data as T;
}

export async function uploadAdminFile(file: File): Promise<{
  url: string;
  filename: string;
  size: string;
  mimetype: string;
}> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch('/api/upload', {
    method: 'POST',
    body: form,
  });
}
