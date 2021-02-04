const { App } = require('@slack/bolt')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN,
})

const admins = [
    "U01C21G88QM", // Khushraj
    "UDFBPS5CZ", // Edwin
    "U013B6CPV62", // Caleb
    "UARKJATPW" // Claire
]

app.event("reaction_added", async ({ event, client }) => {
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

app.command('/karma-leaderboard-global', async ({ command, ack, client }) => {
    await ack()
    const map = {}
    const data = await prisma.user.findMany()
    for (const { id, karmaForChannel } of data) {
        id in map ? map[id] += karmaForChannel : map[id] = karmaForChannel
    }

    let sortedTop20 = Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 20)

    let build = "Hack Club Karma Leaderboard :chart_with_upwards_trend::\n\n"

    for (let i = 0; i < sortedTop20.length; i++) {
        build += `${i + 1}. <@${sortedTop20[i][0]}>: ${sortedTop20[i][1]}\n`
    }

    await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: build
    })
})

app.command('/karma-leaderboard-channel', async ({ command, ack, client }) => {
    await ack()
    const map = {}
    const data = await prisma.user.findMany({
        where: {
            channelId: command.channel_id
        }
    })
    for (const { id, karmaForChannel } of data) {
        id in map ? map[id] += karmaForChannel : map[id] = karmaForChannel
    }

    let sortedTop20 = Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 20)

    let build = "Hack Club Karma Channel Leaderboard :chart_with_upwards_trend::\n\n"

    for (let i = 0; i < sortedTop20.length; i++) {
        build += `${i + 1}. <@${sortedTop20[i][0]}>: ${sortedTop20[i][1]}\n`
    }

    await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: build
    })
})

app.command('/karma-global-personal', async ({ command, ack, client }) => {
    await ack()
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

app.command('/karma-channel-personal', async ({ command, ack, client }) => {
    await ack()
    const karma = await prisma.user.findUnique({
        where: {
            id_channelId: {
                id: command.user_id,
                channelId: command.channel_id
            }
        },
        select: {
            id: false,
            channelId: false,
            channel: false,
            karmaForChannel: true
        }
    })

    client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `You have a total of ${karma ? karma.karmaForChannel : 0} Karma in <#${command.channel_id}> ${getRandomEmoji()}`
    })
})

app.command('/karma-channel-user', async ({ command, ack, client }) => {
    await ack()
    const userID = command.text.match(/<@(.*)\|.*>/i)[1]
    if (userID) {
        const karma = await prisma.user.findUnique({
            where: {
                id_channelId: {
                    id: userID,
                    channelId: command.channel_id
                }
            },
            select: {
                id: false,
                channelId: false,
                channel: false,
                karmaForChannel: true
            }
        })

        client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: `<@${userID}> has a total of ${karma ? karma.karmaForChannel : 0} Karma in <#${command.channel_id}> ${getRandomEmoji()}`
        })
    } else {
        client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: `Command parse error. Make sure you include a mention in your command`
        })
    }
})

app.command('/karma-distribution-user', async ({ command, ack, client }) => {
    await ack()
    const userID = command.text.match(/<@(.*)\|.*>/i)[1]
    if (userID) {
        let build = `Distribution of <@${userID}>'s Karma:\n`

        const karma = await prisma.user.findMany({
            where: {
                id: userID
            },
            select: {
                id: false,
                channelId: true,
                channel: false,
                karmaForChannel: true
            },
            orderBy: {
                karmaForChannel: 'desc'
            }
        })

        let totalKarma = 0
        for (const channel of karma) {
            build += `\n<#${channel.channelId}>: ${channel.karmaForChannel}`
            totalKarma += channel.karmaForChannel
        }

        build += `\n\nTotal Karma: ${totalKarma}`

        client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: build
        })

    } else {
        client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: `Command parse error. Make sure you include a mention in your command`
        })
    }
})

app.command('/karma-distribution-personal', async ({ command, ack, client }) => {
    await ack()

    let build = "Distribution of your Karma:\n"

    const karma = await prisma.user.findMany({
        where: {
            id: command.user_id
        },
        select: {
            id: false,
            channelId: true,
            channel: false,
            karmaForChannel: true
        },
        orderBy: {
            karmaForChannel: 'desc'
        }
    })

    let totalKarma = 0
    for (const channel of karma) {
        build += `\n<#${channel.channelId}>: ${channel.karmaForChannel}`
        totalKarma += channel.karmaForChannel
    }

    build += `\n\nTotal Karma: ${totalKarma}`

    client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: build
    })
})

app.command('/karma-enable', async ({ command, ack, client }) => {
    await ack()
    if (admins.includes(command.user_id)) {
        await prisma.channel.upsert({
            where: { id: command.channel_id },
            create: {
                id: command.channel_id,
                enabled: true
            },
            update: { enabled: true }
        })
        try {
            await client.conversations.join({
                channel: command.channel_id
            })
        } catch {
            // Already in channel 
        }
        await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: `Enabled Karma for <#${command.channel_id}>`
        })
    } else {
        await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: "Unfortunately, you don't have authorization to do that"
        })
    }
})

app.command('/karma-disable', async ({ command, ack, client }) => {
    await ack()
    if (admins.includes(command.user_id)) {
        await prisma.channel.upsert({
            where: { id: command.channel_id },
            create: {
                id: command.channel_id,
                enabled: false
            },
            update: { enabled: false }
        })
        await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: `Disabled Karma for <#${command.channel_id}>`
        })
    } else {
        await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: "Unfortunately, you don't have authorization to do that"
        })
    }
})

async function main() {
    await app.start(process.env.PORT || 3000)
    console.log('⚡️ Bolt app is running!')
}

main()

function getRandomEmoji() {
    const emojis = [
        ':sunglasses:',
        ':parrot:',
        ':yay:',
        ':eyes:'
    ]
    return emojis[Math.floor(Math.random() * emojis.length)]
}
