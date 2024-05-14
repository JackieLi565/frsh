export interface SessionAttributes {}

export interface Session extends SessionAttributes {
    userId: string
    TTL: number
}

export interface Adaptor {
    getSession(sessionId: string): Promise<Session | null>
    createSession(session: Session): Promise<Session>
    updateSessionExpiry(sessionId: string, newExpiry: number): Promise<Session>
    removeSession(sessionId: string): Promise<void>
    removeExpiredSessions(): Promise<void>
    removeUserSessions(userId: string): Promise<void>
}

export interface Options {}

export class Frsh {
    private adaptor: Adaptor
    private options: Options

    constructor(adaptor: Adaptor, options?: Partial<Options>) {
        this.adaptor = adaptor

        const defaultOptions: Options = {}

        this.options = { ...defaultOptions, ...options }
    }
}
