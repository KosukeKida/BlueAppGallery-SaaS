// Image-based icon mapping: "img:<name>" → PNG path
const IMAGE_ICON_MAP: Record<string, string> = {
  'img:streamlit': '/icons/streamlit.png',
  'img:postgres': '/icons/postgres.png',
  'img:blueappworks': '/blueappworks-logo.png',
};

/**
 * Check if an icon_emoji value is an image-based icon.
 */
export function isImageIcon(icon: string): boolean {
  return icon.startsWith('img:');
}

/**
 * Get the image src for an image-based icon.
 */
export function getImageIconSrc(icon: string): string | null {
  return IMAGE_ICON_MAP[icon] ?? null;
}
