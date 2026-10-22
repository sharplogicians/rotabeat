export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const apiUrl = (path: string) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (cleanPath.startsWith(basePath)) {
        return cleanPath;
    }
    return `${basePath}${cleanPath}`;
};