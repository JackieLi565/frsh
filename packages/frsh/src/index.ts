export interface SessionAttributes {}

export interface Session extends SessionAttributes {
    userId: string
    TTL: number
}

export interface Adaptor {
    getSession(sessionId: string): Promise<Session | null>
    getUserSessions(userId: string): Promise<Session[]>
    createSession(session: Session): Promise<string>
    updateSessionExpiry(sessionId: string, newExpiry: number): Promise<Session>
    removeSession(sessionId: string): Promise<void>
    removeExpiredSessions(): Promise<void>
    removeUserSessions(userId: string): Promise<void>
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
