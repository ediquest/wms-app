// src/utils/welcomeToggle.js
export const LS_KEY_WELCOME_DISMISSED = 'welcome.dismissed.v1'

/** Returns true when the Welcome screen should be shown at '/' */
export function shouldShowWelcome() {
  return typeof window !== 'undefined' && localStorage.getItem(LS_KEY_WELCOME_DISMISSED) !== '1'
}
