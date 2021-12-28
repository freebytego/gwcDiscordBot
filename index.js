const Discord = require('discord.js');
const client = new Discord.Client();

const lowdb = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('db.json');
const db = lowdb(adapter);

const request = require('request');

const config = require("./config.json");

db.defaults({ servers: [] }).write();

client.login(config.token);

var lastRecord;
async function compareRecords() {
    const message = new Date();
    const currDate = message.getDate() + "/" + message.getMonth() + "/" +
        message.getFullYear() + " " + message.getHours() + ":" +
        message.getMinutes() + ":" + message.getSeconds();
    console.log(`[${currDate}] Sending a request to the server...`);
    request('https://gwcleaderboard.000webhostapp.com/getleader.php', { json: true }, async (err, res, body) => {
        if (lastRecord == null) {
            lastRecord = body;
        } else {
            if (body && body.length > 0) {
                for (let i = 0; i < body.length; i++) {
                    if (lastRecord[i]) {
                        if (lastRecord[i][0].version == body[i][0].version) {
                            const newTime = new Date('1970-01-01T00:' + body[i][0].time + 'Z');
                            const oldTime = new Date('1970-01-01T00:' + lastRecord[i][0].time + 'Z');
                            const compare = oldTime > newTime;

                            if (compare || lastRecord[i][0].nickname != body[i][0].nickname) {
                                console.log("New record!");
                                const _lastRecord = lastRecord[i][0];
                                const guilds = client.guilds.cache.map(guild => guild.id);
                                guilds.forEach(async id => {
                                    const channelID = db.get('servers').find({ serverID: id }).value().channelID;
                                    if (channelID != 0) {
                                        const channel = await client.channels.fetch(channelID, { cache: true });
                                        const Embed = new Discord.MessageEmbed()
                                            .setColor('#ed5381')
                                            .setTitle('New Record!')
                                            .setDescription(`Player **${body[i][0].nickname}** just beat the record on track **${body[i][0].level}**!`)
                                            .addField(`New record`, `**${body[i][0].time}**`);
                                        if (_lastRecord.nickname != "placeholder") {
                                            Embed.addField(`Previous record by ${_lastRecord.nickname}`, `**${_lastRecord.time}**`);
                                        }
                                        Embed.addField(`Version`, `**${body[i][0].version}**`);
                                        channel.send(Embed);
                                    }
                                });
                            }
                        }
                    }
                }
                lastRecord = body;
            }
        }
    });
}

client.on("ready", () => {
    console.log("Game with Car Bot successfully started!");
    client.user.setActivity("Game with Car 2", { type: 'PLAYING' });

    const guilds = client.guilds.cache.map(guild => guild.id);
    guilds.forEach(id => {
        if (!db.get('servers').find({ serverID: id }).value()) {
            db.get('servers').push({ serverID: id, channelID: config.channelID }).write();
        }
    });
    compareRecords();
    var interval = setInterval(async () => {
        compareRecords();
    }, config.timeout * 1000);
});

client.on('guildCreate', guild => {
    if (!db.get('servers').find({ serverID: guild.id }).value()) {
        db.get('servers').push({ serverID: guild.id, channelID: config.channelID }).write();
    }
});

client.on('guildDelete', guild => {
    if (db.get('servers').find({ serverID: guild.id }).value()) {
        db.get('servers').remove({ serverID: guild.id }).write();
    }
});

client.on("message", async message => {
    if (!message.author.bot) {
        if (!message.content.startsWith(config.prefix)) return;
        const args = message.content.slice(config.prefix.length).trim().split(" ");
        const cmd = args.shift().toLowerCase();

        switch (cmd) {
            case "help":
                await message.channel.send(`Here are the commands: `).then(async msg => {
                    const Embed = new Discord.MessageEmbed()
                        .setTitle("Commands")
                        .setColor("#eb4034")
                        .addFields(
                            { name: "Prefix: ", value: '- $', inline: true },
                            { name: "help", value: "- Sends this help menu" },
                            { name: "ping", value: "- Checks the ping to Discord servers" },
                            { name: "lb <LEVEL> (optional)<VERSION>", value: "- Gets best times of selected track. Valid versions: 0.1.3 and 0.1.4" },
                            { name: "wr <VERSION>", value: "- Gets the best time of all tracks. Valid versions: 0.1.3 and 0.1.4" },
                            { name: "chatid <text-channel id> or get", value: "**Admininstator command.** Set the new best time channel or get the current one" },
                            { name: "dl", value: "Get the download link for the latest version." }
                        );
                    msg.edit(Embed);
                });
                break;
            case "ping":
                await message.channel.send(`Calculating ping...`).then(async msg => {
                    await msg.edit(`Your ping is not **${client.ws.ping}ms.**`);
                    await msg.react('🏓');
                });
                break;
            case "chatid":
                if (message.member.hasPermission('ADMINISTRATOR')) {
                    if (args.length > 0) {
                        if (args[0] == "get") {
                            const channelID = db.get('servers').find({ serverID: message.guild.id }).value().channelID;
                            await message.channel.send(`Current Record channel is ${channelID}`);
                        } else {
                            const channel = await client.channels.fetch(args[0], { cache: true });
                            if (channel) {
                                await message.channel.send(`Changing records channel...`).then(async msg => {
                                    db.get('servers').find({ serverID: message.guild.id }).assign({ channelID: args[0] }).write()
                                    await msg.edit(`Success! The channel ${channel.name} is now a New Records channel!`)
                                });
                            } else {
                                await message.channel.send(`No channel with ID: ${args[0]}!`);
                            }
                        }
                    } else {
                        await message.channel.send(`Missing argument <channelID>`);
                    }
                } else return;
                break;
            case "wr":
                let askedVersion = "0.3.0";
                if (args.length > 0) {
                    if (args[0] == "0.1.3") askedVersion = "0.1.3";
                    else if (args[0] == "0.1.4") askedVersion = "0.1.4";
                    else if (args[0] == "0.2.0") askedVersion = "0.2.0";
                    else if (args[0] == "0.3.0") askedVersion = "0.3.0";
                    else {
                        await message.channel.send(`Incorrect version. Valid versions: "0.1.3", "0.1.4", "0.2.0" or "0.3.0"`);
                        break;
                    }
                }
                else {
                    await message.channel.send(`You have not specified a version. Getting data from last version. Check help for more information...`);
                }
                await message.channel.send(`Getting current best records...`).then(async msg => {
                    function generateEmbed(data, start = 0) {
                        const page = start / config.leaderboardLength;
                        const Embed = new Discord.MessageEmbed()
                            .setURL('http://gwcleaderboard.000webhostapp.com/')
                            .setTitle(`(${askedVersion} Page ${page + 1})\nAll records here!`);
                        switch (page) {
                            case 0:
                                Embed.setColor("#16ca16");
                                break;
                            case 1:
                                Embed.setColor("#16caaf");
                                break;
                            case 2:
                                Embed.setColor("#9416ca");
                                break;
                        }
                        for (let i = start; i < (data.length - start > config.leaderboardLength ? config.leaderboardLength + start : data.length); i++) {
                            if (data[i][0].version == askedVersion) {
                                if (i < data.length) {
                                    if (data[i][0].nickname == "placeholder") {
                                        Embed.addField(`Level ${data[i][0].level}`, `No one holds a record for this track. You can be first!`);
                                    } else {
                                        Embed.addField(`Level ${data[i][0].level}`, `${data[i][0].time} by **${data[i][0].nickname}**`);
                                    }
                                }
                            }
                        }
                        return Embed;
                    }
                    async function regenerateEmbed(body, page) {
                        const shift = page * config.leaderboardLength;
                        const Embed = generateEmbed(body, shift);
                        await msg.edit(Embed);
                        await msg.reactions.removeAll();
                        if (shift > 0) {
                            await msg.react('◀');
                        }
                        if (body.length - shift > config.leaderboardLength) {
                            await msg.react('▶');
                        }

                    }
                    request('https://gwcleaderboard.000webhostapp.com/getleader.php', { json: true }, async (err, res, body) => {
                        if (body && body.length > 0) {
                            var page = 0;
                            regenerateEmbed(body, page);
                            const collector = msg.createReactionCollector((reaction, user) => {
                                return (reaction.emoji.name === '◀' || reaction.emoji.name === '▶') && user.id === message.author.id;
                            }, { time: 30000 });

                            collector.on('collect', (reaction, user) => {
                                if (reaction.emoji.name === '◀' && user.id === message.author.id) {
                                    page--;
                                    regenerateEmbed(body, page);
                                } else if (reaction.emoji.name === '▶' && user.id === message.author.id) {
                                    page++;
                                    regenerateEmbed(body, page);
                                }
                            });
                            collector.on('end', () => {
                                msg.reactions.removeAll();
                            });
                        }
                    });
                });
                break;
            case "lb":
                let askedVersion_ = "0.3.0";
                let askedLevel;
                if (args.length > 0) {
                    askedLevel = args[0];
                    if (args[1]) {
                        if (args[1] == "0.1.3") askedVersion_ = "0.1.3";
                        else if (args[1] == "0.1.4") askedVersion_ = "0.1.4";
                        else if (args[1] == "0.2.0") askedVersion_ = "0.2.0";
                        else if (args[1] == "0.3.0") askedVersion_ = "0.3.0";
                        else {
                            await message.channel.send(`Incorrect version. Valid versions: "0.1.3", "0.1.4", "0.2.0" or "0.3.0"`);
                            break;
                        }
                    }
                } else {
                    await message.channel.send(`You have not specified a level. Check help for more information...`);
                    break;
                }
                await message.channel.send(`Getting current best records for level...`).then(async msg => {
                    function generateEmbed(data, empty = false) {
                        const Embed = new Discord.MessageEmbed()
                            .setURL('http://gwcleaderboard.000webhostapp.com/')
                            .setTitle(`(Top 5 of Level ${askedLevel} in ${askedVersion_})\nAll records here!`);
                        if (data == "wrong") {
                            msg.edit(`This level doesn't exist in the game.`)
                            return;
                        }
                        if (!empty) {
                            Embed.setColor("#16ca16");
                            for (let i = 0; i < (data[0].length < 5 ? data[0].length : 5); i++) {
                                Embed.addField(`Place ${i + 1}`, `${data[0][i].time} by **${data[0][i].nickname}**`);
                            }
                        } else {
                            Embed.setColor("#16caaf");
                            Embed.addField(`No records for this level!`, `You can be the first one to beat this level!`);
                        }
                        return Embed;
                    }
                    request(`https://gwcleaderboard.000webhostapp.com/getleveltop.php?level=${askedLevel}&version=${askedVersion_}`, { json: true }, async (err, res, body) => {
                        let Embed;
                        if (body && body.length > 0) {
                            Embed = generateEmbed(body);
                        } else {
                            Embed = generateEmbed(body, true);
                        }
                        await msg.edit(Embed);
                    });
                });
                break;
            case "dl":
                await message.channel.send(`**Download the latest version here:**\n${config.downloadLink}`);
                break;
        }
    }
});
