const { App } = require('@slack/bolt')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN,
})

async function main() {
    await app.start(process.env.PORT || 3000)
    console.log('⚡️ Bolt app is running!')
}

main()