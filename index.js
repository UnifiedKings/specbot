const {Client, Collection, Events, GatewayIntentBits, MessageFlags, SlashCommandBuilder, Guild} = require("discord.js");
const {token, guildId} = require("./config.json");
const path = require('node:path');
const fs = require('node:fs');

const client = new Client({intents: [GatewayIntentBits.GuildVoiceStates]});
let guild = null;

const specMap = new Map();
const specToUser = new Map();


const fetchMember = async id => client.users.fetch(id);

client.once(Events.ClientReady, async c => {
    console.log('Logged in as ' + c.user.tag);
    guild = await client.guilds.fetch(guildId);
    const spec = new SlashCommandBuilder()
        .setName("spec")
        .setDescription("Allows you to spectate the user specified")
        .addUserOption(option =>
            option.setName('user')
            .setDescription("The user to spectate")
            .setRequired(true)
        );
    
    const unspec = new SlashCommandBuilder()
        .setName("unspec")
        .setDescription("Removes you from spectating");

    client.application.commands.create(spec, guildId);
    client.application.commands.create(unspec, guildId)
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand) return;
    if (interaction.commandName == "spec")
    {
        let specUser = interaction.options.getUser('user');
        //let specUser = await fetchUser(userArg);
        let specUsername = specUser.username;
        if (interaction.options.getUser('user').id == interaction.user.id)
        {
            interaction.reply({content: "You cannot spectate yourself. Sorry :(", flags: MessageFlags.Ephemeral});
            return;
        }
        interaction.reply({content: "Spectating " + specUsername, flags: MessageFlags.Ephemeral});
        console.log("User " + interaction.user.username + " is spectating " + specUser.username);
        addSpectatorToUser(interaction.options.getUser('user').id, interaction.user.id);
        moveSpectatorOnCommandCompletion(interaction.options.getUser('user').id, interaction.user.id);
    }
    if (interaction.commandName == "unspec")
    {
        removeSpectator(interaction.user.id);
        interaction.reply({content: "No longer spectating", flags: MessageFlags.Ephemeral})
    }
});

client.on('voiceStateUpdate', (oldMember, newMember) =>
{
    let oldVoiceChannelID = oldMember.channelId;
    let newVoiceChannelID = newMember.channelId;
    //console.log(client)
    idToMember(newMember.id)
    //console.log(newMember.guild.members.fetch(newMember.id));
    //console.log(newMember.id);
    if (oldVoiceChannelID != newVoiceChannelID)
    {
        console.log("Swapped from " + oldVoiceChannelID + " to " + newVoiceChannelID);
        moveSpectatorsForUser(newMember.id);
    }
    if (newVoiceChannelID == null)
    {
        console.log("User disconnected removing their spectators")
        removeAllSpectatorsFromUser(newMember.id);
        removeSpectator(newMember.id);
    }
});

async function idToMember(id)
{
    let user = await client.users.fetch(id);
    let member = await guild.members.fetch(user);
    return member;
    //console.log(member);
}

function addSpectatorToUser(user, spectator)
{
    if ((spectator == 0) || (spectator == null))
    {
        return;
    }
    let keys = Object.keys(specToUser);
    if (keys.indexOf(spectator) != -1)
    {
        removeSpectator(spectator);
    }
    if (specMap.has(user))
    {
        console.log("new spec " + spectator);
        let array = specMap.get(user);
        array.push(spectator);
        specMap.set(user, array);
        specToUser.set(spectator, user);
    }
    else
    {
        console.log("new spec " + spectator);
        let array = [];
        array.push(spectator);
        specMap.set(user, array);
        specToUser.set(spectator, user);
    }
}

function removeSpectatorFromUser(user, spectator)
{
    console.log("removing " + spectator + " from " + user)
    if (specMap.has(user))
    {
        let array = specMap.get(user);
        array = array.filter(function(e) { return e !== spectator})
        if (array.length == 0)
        {
            specMap.delete(user);
            return;
        }
        specMap.set(user, array);
    }
    else
    {
        console.log(user + " does not have any spectators");
    }
}

function removeSpectator(spectator)
{
    removeSpectatorFromUser(specToUser.get(spectator), spectator);
    specToUser.delete(spectator);
}

function removeAllSpectatorsFromUser(user)
{
    let spectators = specMap.get(user);
    if (spectators == null)
    {
        return;
    }
    for (let i = 0 ; i < spectators.length ; i++)
    {
        removeSpectator(spectators[i]);
    }
}

async function moveSpectatorsForUser(user)
{
    let spectators = specMap.get(user);
    if (spectators == null)
    {
        return;
    }
    await new Promise(r => setTimeout(r, 100));
    console.log("Moving specs");
    //console.log(spectators)
    for (let i = 0 ; i < spectators.length ; i++)
    {
        //spectator.voice.setChannel(user.voice.channel);
        let userMember = await idToMember(user);
        //console.log(spectators[i]);
        //console.log(userMember);
        await moveToChannelID(spectators[i], userMember.voice.channelId);
    }
}

async function moveSpectatorOnCommandCompletion(spectator, user)
{
    let userMember = await idToMember(user);
    await moveToChannelID(spectator, userMember.voice.channelId);
}

async function moveToChannelID(user, new_channel_id)
{
    try
    {
        if (new_channel_id == null)
        {
            removeAllSpectatorsFromUser(user);
            return;
        }
        let userMember = await idToMember(user);
        let channel_to_join = await client.channels.fetch(new_channel_id + "");
        await userMember.voice.setChannel(channel_to_join);
    }
    catch
    {
        return;
    }
}

client.login(token);

