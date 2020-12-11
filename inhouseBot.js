const Discord = require('discord.js')
const client = new Discord.Client();
client.login("") //Discord Token Here

client.on('ready', () => {
	client.user.setActivity("Test Bot")
	listAllConnectedServersAndChannels()
	console.log("DiscordBot Started")
})

client.on('message', (receivedMessage) => {
	if (receivedMessage.author == client.user) {
		return
	}
	else if (receivedMessage.content.startsWith("%")) { //%command
		processCommand(receivedMessage)
	}
})

function listAllConnectedServersAndChannels() {
	console.log("Servers:")
	client.guilds.cache.forEach((guild) => {
		console.log(" - " + guild.name)
		guild.channels.cache.forEach((channel) => {
			console.log(` -- ${channel.name} (${channel.type}) - ${channel.id}`)
		})
	})

}


function processCommand(receivedMessage) {
	let fullCommand = receivedMessage.content.substr(1) // Remove the leading exclamation mark
	let splitCommand = fullCommand.split(" ") // Split the message up in to pieces for each space
	let primaryCommand = splitCommand[0].toLowerCase() // The first word directly after the exclamation is the command
	let arguments = splitCommand.slice(1) // All other words are arguments/parameters/options for the command
    let re = new RegExp("^[a-zA-Z0-9]*$")

	if (fullCommand == null || fullCommand.startsWith("%", 0) || !re.test(primaryCommand)) {
		return;
	}
	else {
		console.log("Command Received from User: " + receivedMessage.author.id + " \n --Command: " + primaryCommand + " with Arguments: " + arguments)
		switch (primaryCommand) {
            case "test":
                testCommand(arguments, receivedMessage);
                break;
            case "":
		}
    }
    
}

function testCommand(arguments, receivedMessage){
    receivedMessage.channel.send("Hello World");
}
