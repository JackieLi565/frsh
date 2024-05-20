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

    /**
     * Creates a new session for the given user with specified attributes.
     * @param {string} userId
     * @param {SessionAttributes} record
     * @returns {Promise<[string, Session]>} - A tuple containing the session ID and the session object.
     */
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

    /**
     * Verifies a session given a session ID
     * @param {string} sessionId
     * @returns {Promise<Session | null>} - Returns a session if the session is valid, otherwise null
     */
    async verifySession(sessionId: string): Promise<Session | null> {
        const session = await this.adaptor.getSession(sessionId)

        if (!session) return null
        if (this.isExpired(session.TTL)) {
            await this.adaptor.removeSession(sessionId)
            return null
        }

        return session
    }

    /**
     * Retrieves a list of active sessions from a given user
     * @param {string} userId
     * @returns - Returns a sorted list of session ordered by newest to oldest
     */
    async getUserSessions(userId: string) {
        const sessions = await this.adaptor.getUserSessions(userId)

        return sessions
            .filter((session) => !this.isExpired(session.TTL))
            .sort((a, b) => b.TTL - a.TTL)
    }

    /**
     * Extends the expiry time of a given session
     * @param {string} sessionId
     * @param {number} expiry time in milliseconds
     * @throws {Error} An error will throw if the expiry parameter is less than or equal to zero
     */
    async extendSessionExpiry(sessionId: string, expiry: number) {
        if (expiry <= 0)
            throw new Error(
                `Invalid expiry: ${expiry}. The expiry duration must be greater than zero.`
            )

        await this.adaptor.updateSessionExpiry(sessionId, expiry)
    }

    /**
     * Deletes a given session
     * @param sessionId
     */
    async deleteSession(sessionId: string) {
        await this.adaptor.removeSession(sessionId)
    }

    /**
     * Deletes all sessions attached to a given user
     * @param userId
     */
    async deleteUserSessions(userId: string) {
        await this.adaptor.removeUserSessions(userId)
    }

    /**
     * Deletes all expired/invalid sessions within the database
     * @param batch - Number of workers, default = 50
     * @throws {Error} An error will throw if the batch size is less than or equal to zero
     */
    async deleteExpiredSessions(batch: number = 50) {
        if (batch <= 0)
            throw new Error(
                `Invalid batch: ${batch}. The batch workers must be greater than zero.`
            )

        await this.adaptor.removeExpiredSessions(batch)
    }

    private isExpired(expiry: number) {
        return Date.now() > expiry
    }
}
