import type { PathConfig, Session } from '@frsh-auth/frsh'
import type { Adaptor, SessionPath } from '@frsh-auth/frsh/lib/internal'
import type { Database, Reference } from 'firebase-admin/database'

export class AdminAdaptor implements Adaptor {
    private config: PathConfig
    private driver: Database
    private SESSION_PATH = 'sessions'
    private TABLE_PATH = 'table'

    constructor(driver: Database, config?: Partial<PathConfig>) {
        const defaultConfig: PathConfig = {
            root: ['frsh'],
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

    async removeUserSessions(userId: string): Promise<void> {
        const sessionIds = await this.getUserSessionIds(userId)
        const tableRef = this.tablePath(userId)

        const sessionRefs = sessionIds.map((id) => this.sessionPath(id))

        await Promise.all([
            ...sessionRefs.map((ref) => ref.remove()),
            tableRef.remove(),
        ])
    }

    async removeExpiredSessions(): Promise<void> {
        const sessionRef = this.sessionPath()
        const sessionSnapshot = await sessionRef.once('value')

        const sessions: SessionPath = sessionSnapshot.val()

        const expiredSessions: Reference[] = []

        for (const [id, session] of Object.entries(sessions)) {
            if (Date.now() <= session.TTL) continue

            expiredSessions.push(
                this.sessionPath(id),
                this.tablePath(session.userId, id)
            )
        }

        await Promise.all(expiredSessions.map((ref) => ref.remove()))
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
        return this.rootPath(this.SESSION_PATH, ...path)
    }

    private tablePath(...path: string[]) {
        return this.rootPath(this.TABLE_PATH, ...path)
    }
}
