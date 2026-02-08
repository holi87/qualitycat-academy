const mode = (import.meta.env.VITE_BUGS ?? "off").toString().trim().toLowerCase();

export const isUiBugModeEnabled = (): boolean => mode === "on";
