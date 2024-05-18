import { describe, expect, beforeEach, test, afterEach } from 'vitest'
import { Adaptor, TablePath } from '../../packages/frsh/lib/internal/index.js'
import { Frsh, Session } from '../../packages/frsh/lib/index.js'
import { database } from 'firebase-admin'
import type { Database } from 'firebase-admin/database'
import { v4 } from 'uuid'

export function runTestsForAdaptor(
    db: Database,
    adaptorInstance: Adaptor,
    adaptorName: string
) {
    describe(`Frsh - ${adaptorName} Adaptor`, () => {
        let frsh: Frsh

        beforeEach(async () => {
            frsh = new Frsh(adaptorInstance, {
                expiry: 15_000,
            })

            await initData(db)
        })

        afterEach(async () => {
            await database().ref().remove()
        })

        describe('createSession Method', () => {
            test('should successfully create a session & retrieve it', async () => {
                const userId = v4()
                const [key] = await frsh.createSession(userId, {})

                expect(key).not.toBeNull()
            })
        })

        describe('verifySession Method', () => {
            test('defined & non-expired session, should return a valid session', async () => {
                const session = validSessions[0]

                const resultSession = await frsh.verifySession(session.id)

                expect(resultSession).not.toBeNull()
            })

            test('defined & expired session, should return a null session', async () => {
                const session = expiredSessions[0]

                const resultSession = await frsh.verifySession(session.id)

                expect(resultSession).toBeNull()
            })
        })

        describe('getUserSessions Method', () => {
            test('should return a list of non-expired sessions from a given user ID', async () => {
                const expectListSize = 2
                const sessions = await frsh.getUserSessions(user1)

                expect(sessions.length).toEqual(expectListSize)

                for (const session of sessions) {
                    expect(session.userId).toEqual(user1)
                }
            })
        })

        describe('deleteSession Method', () => {
            test('should successfully delete a session & ensure that it does not exist', async () => {
                const selectedSession = sessions[0]
                const sessionId = selectedSession.id
                const userId = selectedSession.userId

                await frsh.deleteSession(sessionId)

                const sessionSnapshot = await db
                    .ref(`frsh/sessions/${sessionId}`)
                    .once('value')
                const tableSnapshot = await db
                    .ref(`frsh/table/${userId}/${sessionId}`)
                    .once('value')

                expect(sessionSnapshot.exists()).toBeFalsy()
                expect(tableSnapshot.exists()).toBeFalsy()
            })
        })

        describe('deleteUserSessions Method', () => {
            test('should delete all sessions from a given user ID', async () => {
                const userId = sessions[0].userId

                await frsh.deleteUserSessions(userId)

                const tableSnapshot = await db
                    .ref(`frsh/table/${userId}`)
                    .once('value')
                const sessionSnapshot = await db
                    .ref(`frsh/sessions`)
                    .once('value')

                expect(tableSnapshot.exists()).toBeFalsy()

                for (const session of Object.values<Session>(
                    sessionSnapshot.val()
                )) {
                    expect(session.userId).not.toEqual(userId)
                }
            })
        })

        describe('deleteExpiredSessions Method', () => {
            test('should delete all expired session', async () => {
                const expiredSessionIds = expiredSessions.map(
                    (session) => session.id
                )

                await frsh.deleteExpiredSessions()

                const tableSnapshot = await db.ref('frsh/table').once('value')
                const sessionSnapshot = await db
                    .ref('frsh/sessions')
                    .once('value')

                const tableSessionIds = Object.values<TablePath>(
                    tableSnapshot.val()
                ).flatMap((userSessions) => Object.keys(userSessions))
                const sessionIds = Object.keys(sessionSnapshot.val())

                for (const expiredSessionId of expiredSessionIds) {
                    expect(sessionIds).not.toContain(expiredSessionId)
                    expect(tableSessionIds).not.toContain(expiredSessionId)
                }
            })
        })
    })
}

const user1 = v4(),
    user2 = v4()

const expiredSessions = [user1, user2].map((user) => ({
    id: v4(),
    TTL: Date.now() - 60 * 60,
    userId: user,
}))

const validSessions = [user1, user1, user2, user2].map((user) => ({
    id: v4(),
    TTL: Date.now() + 60 * 60,
    userId: user,
}))

const sessions = [...validSessions, ...expiredSessions]

const initData = async (db: Database) => {
    const sessionRef = db.ref('frsh/sessions')

    await Promise.all(
        sessions.map(async ({ TTL, userId, id }) => {
            await sessionRef.update({
                [id]: {
                    userId,
                    TTL,
                },
            })

            const tableRef = db.ref(`frsh/table/${userId}`)
            tableRef.update({ [id]: Date.now() })
        })
    )
}
