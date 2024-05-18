import type { PathConfig, Session } from '@frsh-auth/frsh'
import type { Adaptor, TablePath } from '@frsh-auth/frsh/lib/internal'
import type { Removable } from './internal/index.js'
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

    async getSession(sessionId: string): Promise<Session | null> {
        const ref = this.ref(this.sessionPath(sessionId))
        const snapshot = await ref.once('value')
        return snapshot.val()
    }

    async getUserSessions(userId: string): Promise<Session[]> {
        const sessionIds = await this.getUserSessionIds(userId)

        const sessionSnapshots = await Promise.all(
            sessionIds.map((id) => this.ref(this.sessionPath(id)).once('value'))
        )

        return sessionSnapshots
            .filter((snapshot) => snapshot.exists())
            .map((snapshot) => snapshot.val())
    }

    async createSession(session: Session): Promise<string> {
        const sessionRef = this.ref(this.sessionPath())

        const ref = await sessionRef.push(session)

        if (!ref.key)
            throw new Error(
                `Session Create - ${session.userId} session key response is null`
            )

        const tableRef = this.ref(this.tablePath(session.userId))

        await tableRef.push({
            [ref.key]: Date.now(),
        })

        return ref.key
    }

    async updateSessionExpiry(
        sessionId: string,
        extension: number
    ): Promise<Session> {
        const ref = this.ref(this.sessionPath(sessionId, 'TTL'))

        const res = await ref.transaction((TTL) => {
            if (!TTL) {
                return TTL
            }

            return TTL + extension
        })

        if (!res.committed)
            throw new Error(
                `Session Update - failed to update ${sessionId} session expiry`
            )

        return res.snapshot.val()
    }

    async removeSession(sessionId: string): Promise<void> {
        const session = await this.getSession(sessionId)
        if (!session) return

        const sessionRef = this.sessionPath(sessionId)
        const tableRef = this.tablePath(session.userId, sessionId)

        const updates: Removable = {
            [sessionRef]: null,
            [tableRef]: null,
        }

        await this.ref().update(updates)
    }

    async removeUserSessions(userId: string): Promise<void> {
        const sessionIds = await this.getUserSessionIds(userId)

        const removalUpdates: Removable = sessionIds.reduce((removable, id) => {
            return {
                ...removable,
                [this.sessionPath(id)]: null,
            }
        }, {})

        removalUpdates[this.tablePath(userId)] = null
        await this.ref().update(removalUpdates)
    }

    async removeExpiredSessions(batch: number): Promise<void> {
        const ref = this.ref(this.tablePath())
        const snapshot = await ref.once('value')
        const data: TablePath = snapshot.val()

        // depending on the size of the table this compute could get out of hand
        const sessionIds = Object.entries(data).flatMap(
            ([userId, sessionMap]) =>
                Object.keys(sessionMap).map((sessionId) => [userId, sessionId])
        )
        const iterable = sessionIds.values()

        const transaction = async (
            iterable: ReturnType<typeof sessionIds.values>
        ) => {
            const tableCleanup: Removable = {}

            for (const [userId, sessionId] of iterable) {
                const ref = this.ref(this.sessionPath(sessionId))

                await ref.transaction((session: Session | null) => {
                    if (!session) {
                        return session
                    }

                    if (Date.now() > session.TTL) {
                        tableCleanup[this.tablePath(userId, sessionId)] = null
                        return null
                    }

                    return session
                })
            }

            await this.ref().update(tableCleanup)
        }

        const workers = sessionIds.length < batch ? sessionIds.length : batch
        await Promise.allSettled(
            new Array<typeof iterable>(workers).fill(iterable).map(transaction)
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
