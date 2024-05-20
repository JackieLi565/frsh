import { PathConfig } from '@frsh-auth/frsh'

export interface Updatable {
    [path: string]: any
}

export interface Config extends PathConfig {}
