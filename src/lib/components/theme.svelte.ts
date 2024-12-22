export type Theme = 'light' | 'dark';

const LOCAL_STORAGE_KEY = 'cv-theme';
const THEME_ATTRIBUTE = 'data-theme';

const theme = $state({
  value: 'light' as Theme,
  sync: () => {
    const savedTheme = localStorage.getItem(LOCAL_STORAGE_KEY);
    theme.set(savedTheme === 'dark' ? 'dark' : 'light');
  },
  set: (newValue: Theme) => {
    theme.value = newValue;
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    document.documentElement.setAttribute(THEME_ATTRIBUTE, newValue);
    localStorage.setItem(LOCAL_STORAGE_KEY, newValue);
  },
});

export default theme;
