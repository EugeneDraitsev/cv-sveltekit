export type Theme = 'light' | 'dark';

const THEME_LOCAL_STORAGE_KEY = 'cv-theme';
const THEME_ATTRIBUTE = 'data-theme';

const store = $state({
  theme: getInitialTheme(),
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

export default store;
