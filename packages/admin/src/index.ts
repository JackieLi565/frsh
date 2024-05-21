import type { PathConfig, Session } from '@frsh-auth/frsh'
import type { Adaptor, TablePath } from '@frsh-auth/frsh/lib/internal'
import type { Updatable } from './internal/index.js'
import type { DataSnapshot, Database } from '@firebase/database-types'

export class AdminAdaptor implements Adaptor {
    private config: PathConfig
    private driver: Database
    private SESSION_PATH = 'sessions'
    private TABLE_PATH = 'table'

    constructor(driver: Database, config?: Partial<PathConfig>) {
        const defaultConfig: PathConfig = {
            root: ['frsh'],
        }

        if (config?.root) {
            config.root = config.root.map((path) => path.replace('/', ''))
        }

        this.config = { ...defaultConfig, ...config }
        this.driver = driver
    }

    /**
     * Retrieves session data for a given sessionId
     * @param {string} sessionId
     * @returns {Promise<Session | null>} - Returns a invalid, valid, or null session given a sessionId
     */
    async getSession(sessionId: string): Promise<Session | null> {
        const ref = this._ref(this._sessionPath(sessionId))
        const snapshot = await ref.once('value')
        return snapshot.val()
    }

    /**
     * Retrieves a list of sessions from a given userId
     * @param {string} userId
     * @returns {Promise<Session[]>} - Returns an array of invalid or valid sessions
     */
    async getUserSessions(userId: string): Promise<Session[]> {
        const sessionIds = await this._getUserSessionIds(userId)

        const sessionSnapshots = await Promise.allSettled(
            sessionIds.map((id) =>
                this._ref(this._sessionPath(id)).once('value')
            )
        )

        return sessionSnapshots
            .filter(
                (result): result is PromiseFulfilledResult<DataSnapshot> =>
                    result.status === 'fulfilled' && result.value.exists()
            )
            .map((result) => result.value.val())
    }

    /**
     * Creates a new unique session
     * @param {Session} session
     * @returns {Promise<string>} - Returns a unique session ID
     * @throws {Error} Will throw an error if database does not return a unique key (rare case)
     */
    async createSession(session: Session): Promise<string> {
        const sessionRef = this._ref(this._sessionPath())

        const ref = await sessionRef.push(session)

        if (!ref.key)
            throw new Error(
                `Session Create - ${session.userId} session key response is null`
            )

        const tableRef = this._ref(this._tablePath(session.userId))

        await tableRef.push({
            [ref.key]: session.TTL,
        })

        return ref.key
    }

    /**
     * Extends the expiry time of a valid session
     * @param {string} sessionId
     * @param {string} extension
     * @returns {Promise<void>}
     * @throws {Error} Will throw if the session does not exist or if the session is invalid
     */
    async updateSessionExpiry(
        sessionId: string,
        extension: number
    ): Promise<void> {
        const session = await this.getSession(sessionId)

        if (!session)
            throw new Error(
                `Session Update - can not update null session ${sessionId}`
            )

        if (Date.now() > session.TTL)
            throw new Error(
                `Session Update - can not update invalid session ${sessionId}`
            )

        const sessionTTLPath = this._sessionPath(sessionId, 'TTL')
        const tableTTLPath = this._tablePath(session.userId, sessionId)

        const updates: Updatable = {
            [sessionTTLPath]: session.TTL + extension,
            [tableTTLPath]: session.TTL + extension,
        }

        await this._ref().update(updates)
    }

    /**
     * Remove a session given a sessionId
     * @param {string} sessionId
     */
    async removeSession(sessionId: string): Promise<void> {
        const session = await this.getSession(sessionId)
        if (!session) return

        const sessionRef = this._sessionPath(sessionId)
        const tableRef = this._tablePath(session.userId, sessionId)

        const updates: Updatable = {
            [sessionRef]: null,
            [tableRef]: null,
        }

        await this._ref().update(updates)
    }

    /**
     * Remove all sessions attached to a user given the userId
     * @param {string} userId
     */
    async removeUserSessions(userId: string): Promise<void> {
        const sessionIds = await this._getUserSessionIds(userId)

        const removalUpdates: Updatable = sessionIds.reduce((removable, id) => {
            return {
                ...removable,
                [this._sessionPath(id)]: null,
            }
        }, {})

        removalUpdates[this._tablePath(userId)] = null
        await this._ref().update(removalUpdates)
    }

    /**
     * Removes all expired/dead session within the database
     * @param {number} concurrent number of concurrent workers
     */
    async removeExpiredSessions(concurrent: number): Promise<void> {
        const ref = this._ref(this._tablePath())
        const snapshot = await ref.once('value')
        const data: TablePath = snapshot.val()

        const sessionIds: [string, string, number][] = []

        // depending on the size of the table this compute could get out of hand
        for (const [userId, sessionMap] of Object.entries(data)) {
            for (const [sessionId, TTL] of Object.entries(sessionMap)) {
                sessionIds.push([userId, sessionId, TTL])
            }
        }

        const iterable = sessionIds.values()
        const removeSessions = async (
            iterable: ReturnType<typeof sessionIds.values>
        ) => {
            const updates: Updatable = {}

            for (const [userId, sessionId, TTL] of iterable) {
                if (Date.now() <= TTL) {
                    continue
                }

                const tablePath = this._tablePath(userId, sessionId)
                const sessionPath = this._sessionPath(sessionId)

                updates[tablePath] = null
                updates[sessionPath] = null
            }

            await this._ref().update(updates)
        }

        const workers =
            sessionIds.length < concurrent ? sessionIds.length : concurrent
        await Promise.allSettled(
            new Array<typeof iterable>(workers)
                .fill(iterable)
                .map(removeSessions)
        )
    }

    private async _getUserSessionIds(userId: string) {
        const tableRef = this._ref(this._tablePath(userId))
        const tableSnapshot = await tableRef.once('value')

        if (!tableSnapshot.exists()) return []

        const userSessionIds = tableSnapshot.val()

        return Object.entries(userSessionIds).map(([id]) => id)
    }

    private _ref(path?: string) {
        return this.driver.ref(path)
    }

    private _rootPath(...path: string[]) {
        return this.config.root.concat(path).join('/')
    }

    private _sessionPath(...path: string[]) {
        return this._rootPath(this.SESSION_PATH, ...path)
    }

    private _tablePath(...path: string[]) {
        return this._rootPath(this.TABLE_PATH, ...path)
    }
}
