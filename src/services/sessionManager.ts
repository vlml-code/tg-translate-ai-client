import { SessionData } from '../types';

const SESSION_KEY = 'telegram_session';

export class SessionManager {
  static saveSession(session: string, phoneNumber: string): void {
    const sessionData: SessionData = {
      session,
      phoneNumber,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  }

  static getSession(): SessionData | null {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as SessionData;
    } catch (error) {
      console.error('Failed to parse session data:', error);
      return null;
    }
  }

  static clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  static hasSession(): boolean {
    return !!this.getSession();
  }
}
