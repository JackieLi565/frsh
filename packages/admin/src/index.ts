import { Adaptor, PathConfig, Session } from '@frsh-auth/frsh'
import { Database } from 'firebase-admin/database'

export class AdminAdaptor implements Adaptor {
    private config: PathConfig
    private driver: Database

    constructor(driver: Database, config?: Partial<PathConfig>) {
        const defaultConfig: PathConfig = {
            root: ['frsh'],
            sessions: ['sessions'],
            table: ['table'],
        }

        this.config = { ...defaultConfig, ...config }
        this.driver = driver
    }

    async getSession(sessionId: string): Promise<Session | null> {
        const ref = this.sessionPath(sessionId)
        const snapshot = await ref.once('value')
        return snapshot.val()
    }

    async getUserSessions(userId: string): Promise<Session[]> {
        const sessionIds = await this.getUserSessionIds(userId)

        const sessionSnapshots = await Promise.all(
            sessionIds.map((id) => this.sessionPath(id).once('value'))
        )

        return sessionSnapshots
            .filter((snapshot) => snapshot.exists())
            .map((snapshot) => snapshot.val())
    }

    async createSession(session: Session): Promise<string> {
        const tableRef = this.tablePath()
        const sessionRef = this.sessionPath()

        const ref = await sessionRef.push(session)

        if (!ref.key)
            throw new Error(
                `Session Create - ${session.userId} session key response is null`
            )

        await tableRef.update({
            [ref.key]: Date.now(),
        })

        return ref.key
    }

    async updateSessionExpiry(
        sessionId: string,
        extension: number
    ): Promise<Session> {
        const ref = this.sessionPath(sessionId, 'TTL')

        const res = await ref.transaction((TTL) => {
            if (TTL === null)
                throw new Error(
                    `Session Update - property TTL does not exist within ${sessionId} session`
                )

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

        await Promise.all([sessionRef.remove(), tableRef.remove()])
    }

    async removeExpiredSessions(): Promise<void> {
        throw new Error('Method not implemented.')
    }

    async removeUserSessions(userId: string): Promise<void> {
        const sessionIds = await this.getUserSessionIds(userId)
        const tableRef = this.tablePath(userId)

        const sessionPromise = sessionIds.map((id) =>
            this.sessionPath(id).remove()
        )

        await Promise.all([...sessionPromise, tableRef.remove()])
    }

    private async getUserSessionIds(userId: string) {
        const tableRef = this.tablePath(userId)
        const tableSnapshot = await tableRef.once('value')

        if (!tableSnapshot.exists()) return []

        const userSessionIds = tableSnapshot.val()

        return Object.entries(userSessionIds).map(([id]) => id)
    }

    private rootPath(...path: string[]) {
        return this.driver.ref(this.config.root.concat(path).join('/'))
    }

    private sessionPath(...path: string[]) {
        return this.rootPath(...this.config.sessions, ...path)
    }

    private tablePath(...path: string[]) {
        return this.rootPath(...this.config.table, ...path)
    }
}
