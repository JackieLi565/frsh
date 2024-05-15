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
        const ref = this.driver.ref(this.sessionPath(sessionId))
        const snapshot = await ref.once('value')
        return snapshot.val()
    }

    async getUserSessions(userId: string): Promise<Session[]> {
        const tableRef = this.driver.ref(this.tablePath(userId))
        const tableSnapshot = await tableRef.once('value')
        const userSessionIds = tableSnapshot.toJSON()

        if (!userSessionIds) return []

        const sessionIds: string[] = Object.entries(userSessionIds).map(
            ([id]) => id
        )

        const sessionSnapshots = await Promise.all(
            sessionIds.map((id) =>
                this.driver.ref(this.sessionPath(id)).once('value')
            )
        )

        return sessionSnapshots
            .map((snapshot) => snapshot.val())
            .filter((nullSessions) => nullSessions)
    }

    async createSession(session: Session): Promise<string> {
        const tableRef = this.driver.ref(this.tablePath())
        const sessionRef = this.driver.ref(this.sessionPath())

        const ref = await sessionRef.push(session)

        if (!ref.key)
            throw new Error(
                `null session key response for user - ${session.userId}`
            )

        await tableRef.update({
            [ref.key]: session.TTL,
        })

        return ref.key
    }

    async updateSessionExpiry(
        sessionId: string,
        newExpiry: number
    ): Promise<Session> {
        throw new Error('Method not implemented.')
    }

    async removeSession(sessionId: string): Promise<void> {
        throw new Error('Method not implemented.')
    }

    async removeExpiredSessions(): Promise<void> {
        throw new Error('Method not implemented.')
    }

    async removeUserSessions(userId: string): Promise<void> {
        throw new Error('Method not implemented.')
    }

    private rootPath(...path: string[]) {
        return this.config.root.concat(path).join('/')
    }

    private sessionPath(...path: string[]) {
        return this.rootPath(...this.config.sessions, ...path)
    }

    private tablePath(...path: string[]) {
        return this.rootPath(...this.config.table, ...path)
    }
}
