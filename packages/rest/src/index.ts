import type { Session } from '@frsh-auth/frsh'
import type { Adaptor } from '@frsh-auth/frsh/lib/internal/index.js'
import type { Config } from './internal/index.js'

export class RESTAdaptor implements Adaptor {
    private config: Config
    private projectId: string

    constructor(projectId: string, config: Partial<Config>) {
        const defaultConfig: Config = {
            root: ['frsh'],
        }

        this.projectId = projectId
        this.config = { ...defaultConfig, ...config }
    }

    getSession(sessionId: string): Promise<Session | null> {
        throw new Error('Method not implemented.')
    }
    getUserSessions(userId: string): Promise<Session[]> {
        throw new Error('Method not implemented.')
    }
    createSession(session: Session): Promise<string> {
        throw new Error('Method not implemented.')
    }
    updateSessionExpiry(
        sessionId: string,
        newExpiry: number
    ): Promise<Session> {
        throw new Error('Method not implemented.')
    }
    removeSession(sessionId: string): Promise<void> {
        throw new Error('Method not implemented.')
    }
    removeExpiredSessions(batch: number): Promise<void> {
        throw new Error('Method not implemented.')
    }
    removeUserSessions(userId: string): Promise<void> {
        throw new Error('Method not implemented.')
    }
}
