export type Theme = 'light' | 'dark';

const THEME_LOCAL_STORAGE_KEY = 'cv-theme';
const THEME_ATTRIBUTE = 'data-theme';
const GRAYSCALE_LOCAL_STORAGE_KEY = 'cv-grayscale';
const GRAYSCALE_ATTRIBUTE = 'data-grayscale';

const store = $state({
  theme: getInitialTheme(),
  grayscale: getInitialGrayscale(),
});

function getInitialTheme() {
  if (typeof document === 'undefined') {
    return;
  }
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  store.theme = theme;
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  localStorage.setItem(THEME_LOCAL_STORAGE_KEY, theme);
}

function getInitialGrayscale() {
  if (typeof document === 'undefined') {
    return;
  }
  return document.documentElement.getAttribute(GRAYSCALE_ATTRIBUTE) === 'true';
}

export function setGrayscale(grayscale: boolean) {
  store.grayscale = grayscale;
  document.documentElement.removeAttribute(GRAYSCALE_ATTRIBUTE);
  document.documentElement.setAttribute(GRAYSCALE_ATTRIBUTE, String(grayscale));
  localStorage.setItem(GRAYSCALE_LOCAL_STORAGE_KEY, String(grayscale));
}

export default store;
