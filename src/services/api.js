import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  allowAbsoluteUrls: false,
  timeout: 30000,
  withCredentials: false,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});
let tokenProvider = () => null;
let refreshTokenProvider;

export function setAccessTokenProvider(provider, refreshProvider) {
  tokenProvider = provider;
  refreshTokenProvider = refreshProvider;
}

client.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  if (error.response?.status !== 401 || !config?.headers?.get('Authorization') || config.authRetried || !refreshTokenProvider) throw error;
  const token = await refreshTokenProvider();
  // Only replay writes carrying their original operation key and serialized body.
  const canRetry = config.method === 'get' || config.headers.has('Idempotency-Key');
  if (!token || !canRetry) throw error;
  config.authRetried = true;
  config.headers.set('Authorization', `Bearer ${token}`);
  return client.request(config);
});

export class ApiError extends Error {
  constructor(
    message,
    {
      status = 0,
      code = "NETWORK_ERROR",
      requestId,
      fields = [],
      retryAfterMs = 0,
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.fields = fields;
    this.retryAfterMs = retryAfterMs;
  }
}

// Headerless calls still send JSON headers, but never an Authorization header.
function jsonHeaders({ headers, idempotencyKey } = {}) {
  const result = new axios.AxiosHeaders(headers);
  result.delete("Authorization");
  if (idempotencyKey) result.set("Idempotency-Key", idempotencyKey);
  return result;
}

async function authHeaders(options) {
  const token = await tokenProvider();
  if (!token)
    throw new ApiError("An access token is required.", {
      status: 401,
      code: "UNAUTHENTICATED",
    });
  const headers = jsonHeaders(options);
  headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

function readResponse(response) {
  if (response.status === 204) return null;
  if (response.data == null || typeof response.data === "string") {
    throw new ApiError("The server returned an unexpected response.", {
      status: 502,
      code: "INVALID_RESPONSE",
      requestId: response.headers.get("X-Request-Id"),
    });
  }
  return response.data;
}

function handleError(error) {
  if (error instanceof ApiError || axios.isCancel(error)) throw error;
  if (error.response) {
    const { status, data, headers } = error.response;
    const retryAfter = headers.get("Retry-After");
    const retryAfterMs = retryAfter
      ? /^\d+$/.test(retryAfter)
        ? Number(retryAfter) * 1000
        : Math.max(0, Date.parse(retryAfter) - Date.now())
      : 0;
    throw new ApiError(
      data?.error?.message ||
        "The request could not be completed. Please try again.",
      {
        status,
        code: data?.error?.code || "REQUEST_FAILED",
        requestId: headers.get("X-Request-Id") || data?.error?.requestId,
        fields: Array.isArray(data?.error?.fields) ? data.error.fields : [],
        retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : 0,
      },
    );
  }
  throw new ApiError(
    "The connection was interrupted. Please retry your request.",
  );
}

// Each method calls Axios directly. URLs are relative to VITE_API_BASE_URL.
export const api = {
  async get(url, options = {}) {
    return client
      .get(url, {
        headers: await authHeaders(options),
        signal: options.signal,
      })
      .then(readResponse)
      .catch(handleError);
  },
  async post(url, payload, options = {}) {
    return client
      .post(url, payload, {
        headers: await authHeaders(options),
        signal: options.signal,
      })
      .then(readResponse)
      .catch(handleError);
  },
  async put(url, payload, options = {}) {
    return client
      .put(url, payload, {
        headers: await authHeaders(options),
        signal: options.signal,
      })
      .then(readResponse)
      .catch(handleError);
  },
  async patch(url, payload, options = {}) {
    return client
      .patch(url, payload, {
        headers: await authHeaders(options),
        signal: options.signal,
      })
      .then(readResponse)
      .catch(handleError);
  },
  async delete(url, payload, options = {}) {
    return client
      .delete(url, {
        data: payload,
        headers: await authHeaders(options),
        signal: options.signal,
      })
      .then(readResponse)
      .catch(handleError);
  },
};

export const headerlessApi = {
  get(url, options = {}) {
    return client
      .get(url, {
        headers: jsonHeaders(options),
        signal: options.signal,
      })
      .then(readResponse)
      .catch(handleError);
  },
  post(url, payload, options = {}) {
    return client
      .post(url, payload, {
        headers: jsonHeaders(options),
        signal: options.signal,
      })
      .then(readResponse)
      .catch(handleError);
  },
  put(url, payload, options = {}) {
    return client
      .put(url, payload, {
        headers: jsonHeaders(options),
        signal: options.signal,
      })
      .then(readResponse)
      .catch(handleError);
  },
  patch(url, payload, options = {}) {
    return client
      .patch(url, payload, {
        headers: jsonHeaders(options),
        signal: options.signal,
      })
      .then(readResponse)
      .catch(handleError);
  },
  delete(url, payload, options = {}) {
    return client
      .delete(url, {
        data: payload,
        headers: jsonHeaders(options),
        signal: options.signal,
      })
      .then(readResponse)
      .catch(handleError);
  },
};
