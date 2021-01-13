const { App } = require('@slack/bolt')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN,
})

app.event("reaction_added", async ({ event, client }) => {
    console.log(event)
    if (event.reaction === "upvote") {
        if (event.user === event.item_user) {
            client.chat.postEphemeral({
                channel: event.item.channel,
                text: "Upvoting / Downvoting your own post does not affect Karma",
                user: event.user
            })
            return
        }
        await modifyKarma(1, event.item_user, event.item.channel)
        console.log(`${event.user} upvoted ${event.item_user}`)
    } else if (event.reaction === "downvote") {
        if (event.user === event.item_user) {
            client.chat.postEphemeral({
                channel: event.item.channel,
                text: "Upvoting / Downvoting your own post does not affect Karma",
                user: event.user
            })
            return
        }
        await modifyKarma(-1, event.item_user, event.item.channel)
        console.log(`${event.user} downvoted ${event.item_user}`)
    }
})

app.event("reaction_removed", async ({ event }) => {
    if (event.reaction === "upvote") {
        if (event.user === event.item_user) return
        await modifyKarma(-1, event.item_user, event.item.channel)
        console.log(`${event.user} removed upvote from ${event.item_user}`)
    } else if (event.reaction === "downvote") {
        if (event.user === event.item_user) return
        await modifyKarma(1, event.item_user, event.item.channel)
        console.log(`${event.user} removed downvote from ${event.item_user}`)
    }
})

async function main() {
    await app.start(process.env.PORT || 3000)
    console.log('⚡️ Bolt app is running!')
}

main()