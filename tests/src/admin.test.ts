import admin, { database } from 'firebase-admin'
import serviceAccount from '../credentials.json'
import { runTestsForAdaptor } from './driver.js'
import { AdminAdaptor } from '../../packages/admin/lib/index.js'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { v4 } from 'uuid'

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
    }),
    databaseURL: serviceAccount.database_url,
})

const db = database()

describe('Config path', () => {
    const clean = async () => {
        await db.ref().remove()
    }

    beforeEach(clean)

    afterEach(clean)

    test('path should be defined given a custom config', async () => {
        const adaptor = new AdminAdaptor(db, {
            root: ['custom', 'root', 'path'],
        })

        await adaptor.createSession({
            TTL: Date.now() * 2,
            userId: v4(),
        })

        const [expectedSessionPath, expectedTablePath] = await Promise.all([
            db.ref('custom/root/path/sessions').once('value'),
            db.ref('custom/root/path/table').once('value'),
        ])

        expect(expectedSessionPath.exists()).toBeTruthy()
        expect(expectedTablePath.exists()).toBeTruthy()
    })

    test('default config path should be defined', async () => {
        const adaptor = new AdminAdaptor(db)

        await adaptor.createSession({
            TTL: Date.now() * 2,
            userId: v4(),
        })

        const [expectedSessionPath, expectedTablePath] = await Promise.all([
            db.ref('frsh/sessions').once('value'),
            db.ref('frsh/table').once('value'),
        ])

        expect(expectedSessionPath.exists()).toBeTruthy()
        expect(expectedTablePath.exists()).toBeTruthy()
    })
})

runTestsForAdaptor(db, new AdminAdaptor(db), 'Admin')
