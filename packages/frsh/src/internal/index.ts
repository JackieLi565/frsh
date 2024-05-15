import { Session } from '../index.js'

export interface Adaptor {
    getSession(sessionId: string): Promise<Session | null>
    getUserSessions(userId: string): Promise<Session[]>
    createSession(session: Session): Promise<string>
    updateSessionExpiry(sessionId: string, newExpiry: number): Promise<Session>
    removeSession(sessionId: string): Promise<void>
    removeExpiredSessions(): Promise<void>
    removeUserSessions(userId: string): Promise<void>
}

export interface SessionPath {
    [sessionId: string]: Session
}

export interface TablePath<TExtra = number> {
    [userId: string]: {
        [sessionId: string]: TExtra
    }
}
