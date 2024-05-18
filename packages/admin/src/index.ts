import type { PathConfig, Session } from '@frsh-auth/frsh'
import type { Adaptor, TablePath } from '@frsh-auth/frsh/lib/internal'
import type { Database } from 'firebase-admin/database'
import { Removable } from './internal/index.js'

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
        const tableRef = this.ref(this.tablePath(userId))
        const sessionRef = this.ref(this.sessionPath())

        const sessionUpdates: Removable = sessionIds.reduce((removable, id) => {
            return {
                ...removable,
                [id]: null,
            }
        }, {})

        await Promise.all([
            tableRef.remove(),
            sessionRef.update(sessionUpdates),
        ])
    }

    async removeExpiredSessions(): Promise<void> {
        const ref = this.ref(this.tablePath())
        const snapshot = await ref.once('value')
        const data: TablePath = snapshot.val()

        const sessionIds = Object.entries(data).flatMap(
            ([userId, sessionMap]) =>
                Object.keys(sessionMap).map((sessionId) => [userId, sessionId])
        )
        const iterable = sessionIds.values()

        const transaction = async (
            iterable: ReturnType<typeof sessionIds.values>,
            index: number
        ) => {
            const tableCleanup: Removable = {}

            for (const [userId, sessionId] of iterable) {
                const ref = this.ref(this.sessionPath(sessionId))

                await ref.transaction((session: Session | null) => {
                    if (!session) {
                        return session
                    }

                    if (Date.now() > session.TTL) {
                        console.log(index, 'expired', sessionId)

                        tableCleanup[this.tablePath(userId, sessionId)] = null
                        return null
                    }

                    console.log(index, 'ok', sessionId)
                    return session
                })
            }

            await this.ref().update(tableCleanup)
        }

        await Promise.allSettled(
            new Array<typeof iterable>(4).fill(iterable).map(transaction)
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
