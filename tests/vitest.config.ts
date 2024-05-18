/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
    test: {
        include: ['src/*'],
        globals: true,
        environment: 'node',
        exclude: ['src/driver.ts'],
    },
})
