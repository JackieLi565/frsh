import { Adaptor } from './internal/index.js'

export interface SessionAttributes {}

export interface Session extends SessionAttributes {
    // database userId
    userId: string
    // time in milliseconds when the session expires
    TTL: number
}

export interface PathConfig {
    // root storage path
    root: string[]
    // session path
    sessions: string[]
    // table path
    table: string[]
}

export interface Options {
    // time it takes for a session to expire in milliseconds
    expiry: number
}

export class Frsh {
    private adaptor: Adaptor
    private options: Options

    constructor(adaptor: Adaptor, options?: Partial<Options>) {
        this.adaptor = adaptor

        const defaultOptions: Options = {
            expiry: 60 * 60 * 3, // 3 hours
        }

        this.options = { ...defaultOptions, ...options }
    }

    async createSession(
        userId: string,
        record: SessionAttributes
    ): Promise<[string, Session]> {
        const session: Session = {
            userId,
            TTL: Date.now() + this.options.expiry,
            ...record,
        }

        const key = await this.adaptor.createSession(session)

        return [key, session]
    }

    async verifySession(sessionId: string): Promise<Session | null> {
        const session = await this.adaptor.getSession(sessionId)

        if (!session) return null
        if (this.isExpired(session.TTL)) {
            await this.adaptor.removeSession(sessionId)
            return null
        }

        return session
    }

    async getUserSessions(userId: string) {
        const sessions = await this.adaptor.getUserSessions(userId)

        return sessions
            .filter((session) => !this.isExpired(session.TTL))
            .sort((a, b) => b.TTL - a.TTL)
    }

    async deleteSession(sessionId: string) {
        await this.adaptor.removeSession(sessionId)
    }

    async deleteUserSessions(sessionId: string) {
        await this.adaptor.removeUserSessions(sessionId)
    }

    async deleteExpiredSessions() {
        await this.deleteExpiredSessions()
    }

    private isExpired(expiry: number) {
        return Date.now() > expiry
    }
}
