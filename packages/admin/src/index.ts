import type { PathConfig, Session } from '@frsh-auth/frsh'
import type { Adaptor, TablePath } from '@frsh-auth/frsh/lib/internal'
import type { Updatable } from './internal/index.js'
import type { Database } from '@firebase/database-types'

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
     * Returns a invalid, valid, or null session given a sessionId
     * @param {string} sessionId
     * @returns {Promise<Session | null>}
     */
    async getSession(sessionId: string): Promise<Session | null> {
        const ref = this.ref(this.sessionPath(sessionId))
        const snapshot = await ref.once('value')
        return snapshot.val()
    }

    /**
     * Returns an array of invalid or valid sessions
     * @param {string} userId
     * @returns {Promise<Session[]>}
     */
    async getUserSessions(userId: string): Promise<Session[]> {
        const sessionIds = await this.getUserSessionIds(userId)

        const sessionSnapshots = await Promise.all(
            sessionIds.map((id) => this.ref(this.sessionPath(id)).once('value'))
        )

        return sessionSnapshots
            .filter((snapshot) => snapshot.exists())
            .map((snapshot) => snapshot.val())
    }

    /**
     * Returns a unique session ID
     * @throws Will throw an error if database does not return a unique key (rare case)
     * @param {Session} session
     * @returns {Promise<string>}
     */
    async createSession(session: Session): Promise<string> {
        const sessionRef = this.ref(this.sessionPath())

        const ref = await sessionRef.push(session)

        if (!ref.key)
            throw new Error(
                `Session Create - ${session.userId} session key response is null`
            )

        const tableRef = this.ref(this.tablePath(session.userId))

        await tableRef.push({
            [ref.key]: session.TTL,
        })

        return ref.key
    }

    /**
     * Extends the expiry time of a valid session
     * @throws Will throw if the session does not exist or if the session is invalid
     * @param {string} sessionId
     * @param {string} extension
     * @returns {Promise<void>}
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

        const sessionTTLPath = this.sessionPath(sessionId, 'TTL')
        const tableTTLPath = this.tablePath(session.userId, sessionId)

        const updates: Updatable = {
            [sessionTTLPath]: session.TTL + extension,
            [tableTTLPath]: session.TTL + extension,
        }

        await this.ref().update(updates)
    }

    /**
     * Remove a session given a sessionId
     * @param {string} sessionId
     */
    async removeSession(sessionId: string): Promise<void> {
        const session = await this.getSession(sessionId)
        if (!session) return

        const sessionRef = this.sessionPath(sessionId)
        const tableRef = this.tablePath(session.userId, sessionId)

        const updates: Updatable = {
            [sessionRef]: null,
            [tableRef]: null,
        }

        await this.ref().update(updates)
    }

    /**
     * Remove all sessions attached to a user given the userId
     * @param {string} userId
     */
    async removeUserSessions(userId: string): Promise<void> {
        const sessionIds = await this.getUserSessionIds(userId)

        const removalUpdates: Updatable = sessionIds.reduce((removable, id) => {
            return {
                ...removable,
                [this.sessionPath(id)]: null,
            }
        }, {})

        removalUpdates[this.tablePath(userId)] = null
        await this.ref().update(removalUpdates)
    }

    /**
     * Removes all expired/dead session within the database
     * @param {number} batch number of concurrent workers
     */
    async removeExpiredSessions(batch: number): Promise<void> {
        const ref = this.ref(this.tablePath())
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

                const tablePath = this.tablePath(userId, sessionId)
                const sessionPath = this.sessionPath(sessionId)

                updates[tablePath] = null
                updates[sessionPath] = null
            }

            await this.ref().update(updates)
        }

        const workers = sessionIds.length < batch ? sessionIds.length : batch
        await Promise.allSettled(
            new Array<typeof iterable>(workers)
                .fill(iterable)
                .map(removeSessions)
        )
    }

    private async getUserSessionIds(userId: string) {
        const tableRef = this.ref(this.tablePath(userId))
        const tableSnapshot = await tableRef.once('value')

        if (!tableSnapshot.exists()) return []

        const userSessionIds = tableSnapshot.val()

        return Object.entries(userSessionIds).map(([id]) => id)
    }

    private ref(path?: string) {
        return this.driver.ref(path)
    }

    private rootPath(...path: string[]) {
        return this.config.root.concat(path).join('/')
    }

    private sessionPath(...path: string[]) {
        return this.rootPath(this.SESSION_PATH, ...path)
    }

    private tablePath(...path: string[]) {
        return this.rootPath(this.TABLE_PATH, ...path)
    }
}
