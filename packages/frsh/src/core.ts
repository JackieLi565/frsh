import { Database } from 'firebase-admin/database'
import { Options, WithBaseAttributes, BaseAttributes } from './types.js'

export default class Frsh<SessionRecord> {
    private adaptor: Database
    private opt: Options
    private rootPath = 'frsh'
    // include addapters
    public constructor(db: Database, opts?: Partial<Options>) {
        const hello = ''
        const defaultOptions: Options = {
            sessionPath: 'sessions',
            tablePath: 'session-table',
            expires: 60 * 60 * 2,
        }

        this.adaptor = db
        this.opt = { ...defaultOptions, ...opts }
    }

    public async createSession(
        userId: string,
        record?: SessionRecord
    ): Promise<string | undefined> {
        const sessionRef = this.adaptor.ref(this.opt.sessionPath)
        const tableRef = this.adaptor.ref(this.tableRef(userId))

        const sessionRecord: WithBaseAttributes = {
            TTL: Date.now() + this.opt.expires * 1000,
            userId,
            ...record,
        }

        const res = await sessionRef.push(sessionRecord)

        if (!res.key) return undefined

        await tableRef.update({
            [res.key]: sessionRecord.TTL,
        })

        return res.key
    }

    public async getSession(
        sessionId: string
    ): Promise<WithBaseAttributes<SessionRecord> | undefined> {
        const sessionRef = this.adaptor.ref(this.sessionRef(sessionId))
        const snapshot = await sessionRef.once('value')
        const sessionData =
            snapshot.val() as WithBaseAttributes<SessionRecord> | null

        if (!sessionData) return undefined
        if (sessionData.TTL < Date.now()) return undefined

        return sessionData
    }

    public async updateSession(
        sessionId: string,
        record: Partial<SessionRecord>
    ) {
        const sessionData = await this.getSession(sessionId)
        if (!sessionData) throw new Error('Session not available')

        const sessionRef = this.adaptor.ref(this.sessionRef(sessionId))
        await sessionRef.update(record)
    }

    public async removeSession(
        userId: string,
        sessionId: string
    ): Promise<void> {
        const tableRef = this.adaptor.ref(
            this.tableSessionRef(userId, sessionId)
        )
        const sessionRef = this.adaptor.ref(this.sessionRef(sessionId))

        await Promise.all([tableRef.remove(), sessionRef.remove()])
    }

    // helpers
    private join(...path: string[]) {
        const prefix = [this.rootPath, ...path]
        return prefix.join('/')
    }

    private tableRef(userId: string) {
        return this.join(this.opt.tablePath, userId)
    }

    private tableSessionRef(userId: string, sessionId: string) {
        return this.join(this.opt.tablePath, userId, sessionId)
    }

    private sessionRef(sessionId: string) {
        return this.join(this.opt.sessionPath, sessionId)
    }
}
