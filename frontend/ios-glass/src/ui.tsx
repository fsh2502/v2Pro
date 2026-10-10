import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import {
    AlertCircle,
    ArrowLeft,
    ChevronRight,
    LoaderCircle,
    X,
} from "lucide-react";
import { api } from "./api";
import type { Row } from "./domain";

export type AppContextValue = {
    info: Row;
    sub: Row;
    config: Row;
    revision: number;
    refresh: () => void;
    go: (page: string) => void;
    modal: (title: string, content: ReactNode) => void;
    close: () => void;
    busy: boolean;
    run: (action: () => Promise<unknown>, message?: string) => Promise<void>;
    notify: (message: string) => void;
    appearance: string;
    setAppearance: (mode: string) => void;
    logout: () => void;
};
export const AppContext = createContext<AppContextValue>(null!);
export const useApp = () => useContext(AppContext);
export function useResource<T = any>(path: string, revision = 0) {
    const [state, setState] = useState<{
        data: T | null;
        error: string;
        loading: boolean;
    }>({ data: null, error: "", loading: true });
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        const abort = new AbortController();
        setState({ data: null, error: "", loading: true });
        api<T>(path, undefined, abort.signal)
            .then(({ data }) => setState({ data, error: "", loading: false }))
            .catch((error) => {
                if (!abort.signal.aborted)
                    setState({
                        data: null,
                        error: error.message,
                        loading: false,
                    });
            });
        return () => abort.abort();
    }, [path, revision, retry]);
    return { ...state, retry: () => setRetry((n) => n + 1) };
}
export function Resource({
    state,
    children,
}: {
    state: ReturnType<typeof useResource>;
    children: ReactNode;
}) {
    if (state.loading)
        return (
            <div className="loading" role="status">
                <LoaderCircle className="spin" /> Đang tải…
            </div>
        );
    if (state.error)
        return (
            <div className="error-panel" role="alert">
                <AlertCircle />
                <p>{state.error}</p>
                <button className="button secondary" onClick={state.retry}>
                    Thử lại
                </button>
            </div>
        );
    return <>{children}</>;
}
export function Card({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return <section className={`card ${className}`}>{children}</section>;
}
export function Badge({
    children,
    tone = "green",
}: {
    children: ReactNode;
    tone?: string;
}) {
    return (
        <span className={`badge ${tone}`}>
            <i />
            {children}
        </span>
    );
}
export function PageTitle({
    title,
    subtitle,
    back,
}: {
    title: string;
    subtitle?: string;
    back?: string;
}) {
    const { go } = useApp();
    return (
        <div className={`page-title ${back ? "has-back" : ""}`}>
            {back && (
                <button
                    className="icon-button"
                    onClick={() => go(back)}
                    aria-label="Quay lại"
                >
                    <ArrowLeft />
                </button>
            )}
            <div>
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
            </div>
        </div>
    );
}
export function MenuRow({
    icon,
    children,
    value,
    onClick,
    danger = false,
}: {
    icon: ReactNode;
    children: ReactNode;
    value?: ReactNode;
    onClick: () => void;
    danger?: boolean;
}) {
    return (
        <button
            className={`menu-row ${danger ? "danger" : ""}`}
            onClick={onClick}
        >
            {icon}
            <span>{children}</span>
            {value && <small>{value}</small>}
            <ChevronRight size={18} />
        </button>
    );
}
export function Empty({ children }: { children: ReactNode }) {
    return <p className="empty">{children}</p>;
}
export function Modal({
    title,
    children,
    close,
    message,
}: {
    title: string;
    children: ReactNode;
    close: () => void;
    message?: string;
}) {
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const dialog = document.getElementById(
            "glass-dialog",
        ) as HTMLDialogElement;
        dialog.showModal();
        const handler = (event: Event) => {
            event.preventDefault();
            close();
        };
        dialog.addEventListener("cancel", handler);
        return () => {
            dialog.removeEventListener("cancel", handler);
            dialog.close();
            previous?.focus();
        };
    }, [close]);
    return (
        <dialog
            id="glass-dialog"
            className="glass-dialog"
            aria-labelledby="dialog-title"
            onClick={(e) => {
                if (e.target === e.currentTarget) close();
            }}
        >
            <div className="dialog-head">
                <h2 id="dialog-title">{title}</h2>
                <button
                    autoFocus
                    className="icon-button"
                    onClick={close}
                    aria-label="Đóng"
                >
                    <X />
                </button>
            </div>
            {message && (
                <div className="dialog-toast" role="status">
                    {message}
                </div>
            )}
            <div className="dialog-body">{children}</div>
        </dialog>
    );
}
export async function copy(value: string) {
    if (!navigator.clipboard)
        throw new Error(
            "Trình duyệt chưa cho phép sao chép. Hãy mở website qua HTTPS.",
        );
    await navigator.clipboard.writeText(value);
}
