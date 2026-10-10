export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
    ) {
        super(message);
    }
}
export type Envelope<T> = { data: T; type?: number; total?: number };
const sessionMessage =
    /未登录或登陆已过期|未登錄或登陸已過期|phiên đăng nhập.*hết hạn|unauthenticated/i;
export function createApi(
    getToken: () => string | null,
    expired: () => void,
    fetcher: typeof fetch = fetch,
) {
    return async function request<T = any>(
        path: string,
        body?: Record<string, unknown>,
        signal?: AbortSignal,
    ): Promise<Envelope<T>> {
        const token = getToken();
        let response: Response;
        try {
            response = await fetcher(`/api/v1/${path}`, {
                method: body ? "POST" : "GET",
                signal,
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "Accept-Language": "vi-VN",
                    ...(token ? { Authorization: token } : {}),
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError")
                throw error;
            throw new ApiError(
                "Không thể kết nối. Kiểm tra mạng rồi thử lại.",
                0,
            );
        }
        const json = await response.json().catch(() => null);
        if (!response.ok) {
            const message =
                Object.values(json?.errors || {})
                    .flat()
                    .join("\n") ||
                json?.message ||
                `Yêu cầu thất bại (${response.status}).`;
            if (
                path.startsWith("user/") &&
                token &&
                (response.status === 401 ||
                    (response.status === 403 && sessionMessage.test(message)))
            ) {
                expired();
                throw new ApiError(
                    "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
                    response.status,
                );
            }
            throw new ApiError(
                /[\u3400-\u9fff]/.test(message)
                    ? "Không thể thực hiện yêu cầu. Vui lòng kiểm tra thông tin hoặc liên hệ hỗ trợ."
                    : message,
                response.status,
            );
        }
        if (!json || !Object.prototype.hasOwnProperty.call(json, "data"))
            throw new ApiError(
                "Máy chủ trả về dữ liệu không hợp lệ.",
                response.status,
            );
        return json;
    };
}
const key = "ios-glass.auth";
export const session = {
    get: () => sessionStorage.getItem(key) || localStorage.getItem(key),
    save: (token: string, remember: boolean) => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
        (remember ? localStorage : sessionStorage).setItem(key, token);
    },
    clear: () => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    },
};
export const api = createApi(session.get, () => {
    session.clear();
    window.dispatchEvent(new Event("ios-glass:expired"));
});
