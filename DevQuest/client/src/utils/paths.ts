/**
 * Gets the correct asset path with the base URL for GitHub Pages compatibility
 * @param path The asset path without the base URL
 * @returns The asset path with the correct base URL
 */
export const getAssetPath = (path: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  // Remove leading slash to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${cleanPath}`;
}; 