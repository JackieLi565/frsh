import { Session } from '../index.js'

export interface Adaptor {
    getSession(sessionId: string): Promise<Session | null>
    getUserSessions(userId: string): Promise<Session[]>
    createSession(session: Session): Promise<string>
    updateSessionExpiry(sessionId: string, newExpiry: number): Promise<void>
    removeSession(sessionId: string): Promise<void>
    removeExpiredSessions(concurrent: number): Promise<void>
    removeUserSessions(userId: string): Promise<void>
}

export interface RootPath {
    session: SessionPath
    table: TablePath
}

export interface SessionPath {
    [sessionId: string]: Session
}

export interface TablePath {
    [userId: string]: {
        // value must be equal to the TTL of the reference session
        [sessionId: string]: number
    }
}
