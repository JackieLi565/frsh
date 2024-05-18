import admin, { database } from 'firebase-admin'
import serviceAccount from '../credentials.json'
import { runTestsForAdaptor } from './driver.js'
import { AdminAdaptor } from '../../packages/admin/lib/index.js'

admin.initializeApp(
    {
        credential: admin.credential.cert({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: serviceAccount.private_key,
        }),
        databaseURL: serviceAccount.database_url,
    },
    'adaptor'
)

const adaptor = new AdminAdaptor(database())
runTestsForAdaptor(adaptor, 'admin')
