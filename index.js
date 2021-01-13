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

async function modifyKarma(amount, user, channel) {
    const channelObject = await prisma.channel.upsert({
        where: { id: channel },
        create: { id: channel },
        update: {}
    })

    if (channelObject.enabled) {
        await prisma.user.upsert({
            where: {
                id_channelId: {
                    id: user,
                    channelId: channel
                }
            },
            create: {
                id: user,
                channel: {
                    connect: {
                        id: channel
                    }
                },
                karmaForChannel: amount
            },
            update: {
                karmaForChannel: {
                    increment: amount
                }
            }
        })
    }
}
app.command('/karma-global-personal', async ({ command, ack, client }) => {
    await ack()
    console.log(command)
    const karma = await prisma.user.findMany({
        where: {
            id: command.user_id
        },
        select: {
            id: false,
            channelId: false,
            channel: false,
            karmaForChannel: true
        }
    })

    let totalKarma = 0
    for (const channel of karma) {
        totalKarma += channel.karmaForChannel
    }

    client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `You have a total of ${totalKarma} Karma across channels ${getRandomEmoji()}`
    })
})

app.command('/karma-global-user', async ({ command, ack, client }) => {
    await ack()
    console.log(command)
    const userID = command.text.match(/<@(.*)\|.*>/i)[1]
    if (userID) {
        const karma = await prisma.user.findMany({
            where: {
                id: userID
            },
            select: {
                id: false,
                channelId: false,
                channel: false,
                karmaForChannel: true
            }
        })

        let totalKarma = 0
        for (const channel of karma) {
            totalKarma += channel.karmaForChannel
        }

        client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: `<@${userID}> has a total of ${totalKarma} Karma across channels ${getRandomEmoji()}`
        })
    } else {
        client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: `Command parse error. Make sure you include a mention in your command`
        })
    }
})

async function main() {
    await app.start(process.env.PORT || 3000)
    console.log('⚡️ Bolt app is running!')
}

main()