const Discord = require('discord.js')
const client = new Discord.Client();
const table = require('table');
const Datastore = require('nedb');

client.login("") //Discord Token Here

//Load Database
const MatchesDatabase = new Datastore('MatchesDatastore.db');
MatchesDatabase.loadDatabase();

const PlayersDatabase = new Datastore('PlayersDatastore.db');
PlayersDatabase.loadDatabase();

const dbCompactInterval = 300000;
const matchCloseSignupDelay = 0; //amount of time after match time to close sign-ups in milliseconds (300000 = 5 minutes)
const MVP_ACE_VOTE_TIME = 600000;


client.on('ready', () => {
	client.user.setActivity("DM me %help")
	listAllConnectedServersAndChannels()
	console.log("DiscordBot Started")
	MatchesDatabase.persistence.setAutocompactionInterval(dbCompactInterval)
	PlayersDatabase.persistence.setAutocompactionInterval(dbCompactInterval)
})

client.on('message', (receivedMessage) => {
	if (receivedMessage.author == client.user) {
		return
	}
	else if (receivedMessage.content.startsWith("%")) { //% command
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


//processes the command to be run
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
			case "create":
				if (receivedMessage.channel.type == "text") {
					createMatch(arguments, receivedMessage);
					break;
				}
				receivedMessage.author.send("Cannot create a match in DMs")
				break;
			case "players":
				printUserRoles(arguments, receivedMessage);
				receivedMessage.delete();
				break;
			case "team":
				teamCommand(arguments, receivedMessage);
				receivedMessage.delete();
				break;
			case "start":
				startMatchCommand(arguments, receivedMessage);
				receivedMessage.delete();
				break;
			case "mvp":
				mvpCommand(arguments, receivedMessage);
				receivedMessage.delete();
				break;
			case "ace":
				aceCommand(arguments, receivedMessage);
				receivedMessage.delete();
				break;
			case "roles":
				rolesCommand(arguments, receivedMessage);
				break;
			case "stats":
				statsCommand(arguments, receivedMessage);
				break;
			case "leaderboard":
				leaderboardCommand(arguments, receivedMessage);
				receivedMessage.delete();
				break;
			case "help":
				helpCommand(arguments, receivedMessage);
				receivedMessage.delete();
				break;
			default:
				receivedMessage.author.send("type %help to get the list of commands");
				break;
		}
	}

}

function helpCommand(arguments, receivedMessage) {

}

async function createMatch(arguments, receivedMessage) {
	if (!checkCreateMatchArguments(arguments, receivedMessage)) {
		console.log("invalid arguments");
		return;
	}
	const embedMessage = new Discord.MessageEmbed()
		.setAuthor("In-House Bot")
		.setDescription("Processing Match...")
		.setFooter("React to sign-up for role(s), ❓ to get your role(s)")
		.setThumbnail("https://i.imgur.com/YeRFD2H.png")
	let embedMessageTitle = "";
	if (arguments[0] == "fun") {
		embedMessageTitle += "Fun In-House @ "
	}
	else {
		embedMessageTitle += "Serious In-House @ "
	}
	//time here "^(([0]?[1-9]|1[0-2])(:)([0-5][0-9]))$"
	embedMessageTitle += arguments[1];
	if (arguments[2] == "am") {
		embedMessageTitle += " a.m."
	}
	else {
		embedMessageTitle += " p.m."
	}
	embedMessage.setTitle(embedMessageTitle)

	const msg = await receivedMessage.channel.send(embedMessage);
	msg.react('🇹')
		.then(() => msg.react('🇯'))
		.then(() => msg.react('🇲'))
		.then(() => msg.react('🇧'))
		.then(() => msg.react('🇸'))
		//.then(() => msg.react('❌'))
		.then(() => msg.react('❓'))
		.catch(() => console.error('One of the emojis failed to react.'));

	addMatchToDatabase(msg, embedMessage, arguments, receivedMessage)
	receivedMessage.delete()
	let currentDate = new Date();
	let matchTime = getDateFromHHMM(arguments[1], arguments[2]);
	let timeOutTime = Math.abs(currentDate.getTime() - matchTime.getTime()) + matchCloseSignupDelay;
	const filter = (reaction, user) => { return ['🇹', '🇯', '🇲', '🇧', '🇸', '❓'].includes(reaction.emoji.name) && user.id != client.user.id };
	const collector = msg.createReactionCollector(filter, { time: timeOutTime, dispose: true });

	collector.on('collect', (reaction, user) => {
		console.log("collected reaction: " + reaction.emoji.name)
		switch (reaction.emoji.name) {
			case "🇹":
				console.log("top selected from: " + user.id)
				addUserToRole(msg, embedMessage, user, "top", receivedMessage);
				break;
			case "🇯":
				console.log("jungle selected from: " + user.id)
				addUserToRole(msg, embedMessage, user, "jungle", receivedMessage);
				break;
			case "🇲":
				console.log("mid selected from: " + user.id)
				addUserToRole(msg, embedMessage, user, "mid", receivedMessage);
				break;
			case "🇧":
				console.log("bot selected from: " + user.id)
				addUserToRole(msg, embedMessage, user, "bot", receivedMessage);
				break;
			case "🇸":
				console.log("support selected from: " + user.id)
				addUserToRole(msg, embedMessage, user, "support", receivedMessage);
				break;
			case "❓":
				console.log("❓ selected from: " + user.id)
				sendSelectedRoles(msg, user);
				if (user.id != client.id) {
					removeReaction(msg, user.id, '❓');
				}
				break;
			default:
				console.log("something went wrong with collecting reactions")
				break;
		}
	});

	collector.on('remove', (reaction, user) => {
		console.log("collected reaction: " + reaction.emoji.name)
		switch (reaction.emoji.name) {
			case "🇹":
				console.log("removed reaction: " + user.id)
				removeUserFromRole(msg, embedMessage, user, receivedMessage, "top");
				break;
			case "🇯":
				console.log("jungle removed from: " + user.id)
				removeUserFromRole(msg, embedMessage, user, receivedMessage, "jungle");
				break;
			case "🇲":
				console.log("mid removed from: " + user.id)
				removeUserFromRole(msg, embedMessage, user, receivedMessage, "mid");
				break;
			case "🇧":
				console.log("bot removed from: " + user.id)
				removeUserFromRole(msg, embedMessage, user, receivedMessage, "bot");
				break;
			case "🇸":
				console.log("support removed from: " + user.id)
				removeUserFromRole(msg, embedMessage, user, receivedMessage, "support");
				break;
			default:
				console.log("something went wrong with collecting remove reactions")
				break;
		}
	});

	collector.on('end', collected => {
		try {
			MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
				if (data == null) {
					console.log("no data found")
				}
				else {
					embedMessage.setFooter("Sign-ups have closed, please wait for match creator to create teams, type \"%roles " + data.match_id + "\" to get your roles");
					msg.edit(embedMessage);
					receivedMessage.author.send("Match sign-ups for Match ID: " + data.match_id + " ended, please type \"%players " + data.match_id + "\" to get players and assign them to teams, type %help for commands")
				}
			});
		}
		catch {
			console.log("Error getting match after collection end");
		}
		console.log("collection ended");
	});
}

function teamCommand(arguments, receivedMessage) {
	let matchID;
	if (checkIfStringIsValidInt(arguments[0])) {
		matchID = parseInt(arguments[0]);
	}
	else {
		console.log("invalid match id");
		//output user error message here
		return;
	}
	let teamNumber;
	if (checkIfStringIsValidInt(arguments[1])) {
		teamNumber = parseInt(arguments[1]);
	}
	else {
		console.log("invalid team #");
		//output user error message here
		return;
	}
	let usersArray = getArrayOfUsersFromMentions(arguments.slice(2));
	if (usersArray.length != 5) {
		console.log("invalid users array")
		//output user error message here
		return;
	}
	let usersIdArray = [];
	usersArray.forEach(user => usersIdArray.push(user.id));

	if (teamNumber == 1) {
		MatchesDatabase.update({ match_id: matchID }, { $set: { team1: usersIdArray } }, { multi: false });
	}
	else if (teamNumber == 2) {
		MatchesDatabase.update({ match_id: matchID }, { $set: { team2: usersIdArray } }, { multi: false });
	}

}

async function startMatchCommand(arguments, receivedMessage) {
	let matchID;
	let matchDate;
	let newMatchTime = true;
	if (checkIfStringIsValidInt(arguments[0])) {
		matchID = parseInt(arguments[0]);
	}
	else {
		console.log("invalid match id");
		//output user error message here
		return;
	}
	//console.log()
	if (!isUserMatchCreator(receivedMessage.author, matchID)) {
		return;
	}
	if (arguments.length == 3) {
		let timeRe = new RegExp('^(([0]?[1-9]|1[0-2])(:)([0-5][0-9]))$');
		if (!timeRe.test(arguments[1])) {
			receivedMessage.author.send("Invalid time, valid input HH:MM | example: 08:15");
			return;
		}
		else if (arguments[2].toLowerCase() != "am" && arguments[2].toLowerCase() != "pm") {
			receivedMessage.author.send("Invalid time argument | try \"am\" or \"pm\"");
			return;
		}
		else {
			matchDate = getDateFromHHMM(arguments[1], arguments[2]);
		}
	}
	else {
		newMatchTime = false;
	}

	const embedMessage = new Discord.MessageEmbed()
		.setAuthor("In-House Bot | Match ID: " + arguments[0])
		.setDescription("Processing Teams...")
		//.setFooter("")
		.setThumbnail("https://i.imgur.com/YeRFD2H.png")
		.setFooter("Click on a team number to assign a win, 🛑 when match is over")

	const msg = await receivedMessage.channel.send(embedMessage);

	try {
		MatchesDatabase.findOne({ match_id: matchID }, async function (err, data) {
			if (data == null) {
				console.log("no data found")
			}
			else {
				let team1Arr = data.team1;
				let team2Arr = data.team2;

				if (team1Arr.length != 5) {
					console.log("team 1 invalid");
					msg.delete();
					return;
				}
				else if (team2Arr.length != 5) {
					console.log("team 2 invalid");
					msg.delete();
					return;
				}

				let embedDescription = "Team 1 vs Team 2\n\n";
				embedDescription += "Top: <@" + team1Arr[0] + "> vs <@" + team2Arr[0] + ">\n";
				embedDescription += "Jng: <@" + team1Arr[1] + "> vs <@" + team2Arr[1] + ">\n";
				embedDescription += "Mid: <@" + team1Arr[2] + "> vs <@" + team2Arr[2] + ">\n";
				embedDescription += "Bot: <@" + team1Arr[3] + "> vs <@" + team2Arr[3] + ">\n";
				embedDescription += "Sup: <@" + team1Arr[4] + "> vs <@" + team2Arr[4] + ">\n";
				embedMessage.setDescription(embedDescription);

				if (!newMatchTime) {
					matchDate = data.match_time;
					//console.log(matchDate.toLocaleTimeString());
				}
				MatchesDatabase.update({ match_id: matchID }, { $set: { match_time: matchDate } }, { multi: false }, function (err, numReplaced) { console.log("Changed match time") });
				embedMessage.setTitle("Starting at: " + matchDate.toLocaleTimeString([], { timeStyle: 'short' }));
				await msg.edit(embedMessage)
				try {
					sendDMToPlayers(data.team1, data.match_id, matchDate);
					sendDMToPlayers(data.team2, data.match_id, matchDate);
				}
				catch {
					console.log("error sending DM to players, perhaps player(s) is/are invalid?")
				}

			}
		});
	}
	catch {
		console.log("Error starting match database");
		return;
	}

	msg.react('1️⃣')
		.then(() => msg.react('2️⃣'))
		.then(() => msg.react('🛑'))
		.catch(() => console.error('One of the emojis failed to react.'));

	const filter = (reaction, user) => { return ['1️⃣', '2️⃣', '🛑'].includes(reaction.emoji.name) && user.id != client.user.id };
	const collector = msg.createReactionCollector(filter, {});
	collector.on('collect', (reaction, user) => {
		MatchesDatabase.findOne({ match_id: matchID }, async function (err, data) {
			if (data == null) {
				return;
			}
			switch (reaction.emoji.name) {
				case "1️⃣":
					console.log("team 1 won selected from: " + user.id)
					if (user.id == data.creator_id && data.serious) {
						teamWon(msg, matchID, data.team1);
						teamLose(msg, matchID, data.team2);
					}
					if (user.id != client.id) {
						removeReaction(msg, user.id, '1️⃣');
					}
					break;
				case "2️⃣":
					console.log("team 2 won selected from: " + user.id)
					if (user.id == data.creator_id && data.serious) {
						teamWon(msg, matchID, data.team2);
						teamLose(msg, matchID, data.team1);
					}
					if (user.id != client.id) {
						removeReaction(msg, user.id, '2️⃣');
					}
					break;
				case "🛑":
					console.log("🛑 selected from: " + user.id)
					if (user.id == data.creator_id) {
						msg.reactions.removeAll();
						collector.stop();
					}
					break;
				default:
					console.log("something went wrong with collecting reactions")
					break;
			}
		});
	});

	collector.on('end', collected => {
		console.log("collection ended");
		embedMessage.setFooter("Match Ended");
		embedMessage.setTitle("");
		msg.edit(embedMessage);
	});
}

async function teamWon(msg, matchID, playersIdArray) {
	for (let playerID of playersIdArray) {
		PlayersDatabase.findOne({ player_id: playerID }, async function (err, data) {
			if (data == null) {
				console.log("Player not found, adding to DB")
				//let user = client.users.cache.get(playerID);
				let userNickname = await getUserNickName(msg, playerID);
				PlayersDatabase.insert({ player_id: playerID, nickname: userNickname, number_of_mvp: 0, number_of_ace: 0, win: 1, loss: 0, win_rate: 1.0, winteam: playersIdArray, loseteam: [] });
			}
			else {
				let userNickname = await getUserNickName(msg, playerID);
				let playersArray = playersIdArray.concat(data.winteam);
				let numberOfWins = (data.win + 1)
				let numberOfLoss = data.loss;
				let winrate = numberOfWins / (numberOfWins + numberOfLoss);
				PlayersDatabase.update({ player_id: playerID }, { $set: { win: numberOfWins, win_rate: winrate, winteam: playersArray, nickname: userNickname } }, { multi: false }, function (err, numReplaced) { });
			}
		});
	}
	compactDatabases();
}

async function teamLose(msg, matchID, playersIdArray) {
	for (let playerID of playersIdArray) {
		PlayersDatabase.findOne({ player_id: playerID }, async function (err, data) {
			if (data == null) {
				console.log("Player not found, adding to DB")
				let userNickname = await getUserNickName(msg, playerID);
				PlayersDatabase.insert({ player_id: playerID, nickname: userNickname, number_of_mvp: 0, number_of_ace: 0, win: 0, loss: 1, win_rate: 0.0, winteam: [], loseteam: playersIdArray });
			}
			else {
				let userNickname = await getUserNickName(msg, playerID);
				let playersArray = playersIdArray.concat(data.loseteam);
				let numberOfWins = data.win;
				let numberOfLoss = (data.loss + 1);
				let winrate = numberOfWins / (numberOfWins + numberOfLoss);
				PlayersDatabase.update({ player_id: playerID }, { $set: { loss: numberOfLoss, win_rate: winrate, loseteam: playersArray, nickname: userNickname } }, { multi: false }, function (err, numReplaced) { });
			}
		});
	}
	compactDatabases();
}

async function mvpCommand(arguments, receivedMessage) {
	let authorID = receivedMessage.author.id;
	let matchID;
	if (checkIfStringIsValidInt(arguments[0])) {
		matchID = parseInt(arguments[0]);
	}
	else {
		console.log("invalid match id");
		//output user error message here
		return;
	}
	if (!isUserMatchCreator(receivedMessage.author, matchID)) {
		return;
	}
	let teamNumber;
	if (checkIfStringIsValidInt(arguments[1])) {
		teamNumber = parseInt(arguments[1]);
	}
	else {
		console.log("invalid team #");
		//output user error message here
		return;
	}
	const embedMessage = new Discord.MessageEmbed()
		.setAuthor("In-House Bot | Match ID: " + matchID)
		.setTitle("Vote for the MVP 🏅")
		.setDescription("Processing Teams...")
		.setThumbnail("https://i.imgur.com/YeRFD2H.png")
		.setFooter("Vote for the MVP(s)")

	const msg = await receivedMessage.channel.send(embedMessage);

	mvpAceDescription(msg, embedMessage, matchID, teamNumber)

	msg.react('1️⃣')
		.then(() => msg.react('2️⃣'))
		.then(() => msg.react('3️⃣'))
		.then(() => msg.react('4️⃣'))
		.then(() => msg.react('5️⃣'))
		.then(() => msg.react('🛑'))
		.catch(() => console.error('One of the emojis failed to react.'));

	let player1VoteCount = 0;
	let player2VoteCount = 0;
	let player3VoteCount = 0;
	let player4VoteCount = 0;
	let player5VoteCount = 0;

	const filter = (reaction, user) => { return ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '🛑'].includes(reaction.emoji.name) && user.id != client.user.id };
	const collector = msg.createReactionCollector(filter, { time: MVP_ACE_VOTE_TIME, dispose: true });

	collector.on('collect', (reaction, user) => {
		switch (reaction.emoji.name) {
			case "🛑":
				console.log("🛑 selected from: " + user.id)
				if (user.id == authorID) {
					//msg.reactions.removeAll();
					collector.stop();
				}
				else {
					removeReaction(msg, user.id, '🛑');
				}
				break;
			default:
				break;
		}
	});

	collector.on('end', collected => {
		const userReactions = msg.reactions.cache;
		userReactions.forEach(msgReaction => {
			switch (msgReaction.emoji.name) {
				case "1️⃣":
					player1VoteCount = msgReaction.count;
					break;
				case "2️⃣":
					player2VoteCount = msgReaction.count;
					break;
				case "3️⃣":
					player3VoteCount = msgReaction.count;
					break;
				case "4️⃣":
					player4VoteCount = msgReaction.count;
					break;
				case "5️⃣":
					player5VoteCount = msgReaction.count;
					break;
			}
		})
		let playerVoteCountArray = [player1VoteCount, player2VoteCount, player3VoteCount, player4VoteCount, player5VoteCount];
		playerVoteCountArray.sort(function (a, b) { return b - a });
		let mvpArray = [];
		let maxVote = playerVoteCountArray[0];
		if (maxVote <= 1) {
			return;
		}
		try {
			MatchesDatabase.findOne({ match_id: matchID }, async function (err, data) {
				if (data == null) {
					console.log("no data found")
				}
				else {
					let playersIdArray;
					if (teamNumber == 1) {
						playersIdArray = data.team1;
					}
					else if (teamNumber == 2) {
						playersIdArray = data.team2;
					}
					if (playersIdArray.length != 5) {
						return;
					}
					if (player1VoteCount == maxVote) {
						mvpArray.push(playersIdArray[0]);
					}
					if (player2VoteCount == maxVote) {
						mvpArray.push(playersIdArray[1]);
					}
					if (player3VoteCount == maxVote) {
						mvpArray.push(playersIdArray[2]);
					}
					if (player4VoteCount == maxVote) {
						mvpArray.push(playersIdArray[3]);
					}
					if (player5VoteCount == maxVote) {
						mvpArray.push(playersIdArray[4]);
					}
					mvpArray.forEach(mvpID => {
						PlayersDatabase.findOne({ player_id: mvpID }, async function (err, data) {
							if (data == null) {
								PlayersDatabase.insert({ player_id: playerID, nickname: userNickname, win: 0, loss: 0, win_rate: 1.0, winteam: [], loseteam: [], number_of_mvp: 1, number_of_ace: 0 });
							}
							else {
								PlayersDatabase.update({ player_id: mvpID }, { $inc: { number_of_mvp: 1 } }, { multi: false }, function (err, numReplaced) { });
							}
						})
					})
					if (mvpArray.length > 1) {
						embedMessage.setTitle("MVPs 🏅")
						let mvpNickNames = "";
						var i;
						for (i = 0; i < mvpArray.length; i++) {
							let userNickname = await getUserNickName(msg, mvpArray[i]);
							mvpNickNames += "**" + userNickname + "**\n";
						}
						embedMessage.setDescription("\n" + mvpNickNames);
					}
					else if (mvpArray.length == 1) {
						embedMessage.setTitle("MVP 🏅")
						let userNickname = await getUserNickName(msg, mvpArray[0]);
						embedMessage.setDescription("\n**" + userNickname + "**")

					}
					embedMessage.setFooter("")
					msg.edit(embedMessage);

				}
			});
		}
		catch {
			console.log("error");
			return;
		}
	});

}

async function aceCommand(arguments, receivedMessage) {
	let authorID = receivedMessage.author.id;
	let matchID;
	if (checkIfStringIsValidInt(arguments[0])) {
		matchID = parseInt(arguments[0]);
	}
	else {
		console.log("invalid match id");
		//output user error message here
		return;
	}
	if (!isUserMatchCreator(receivedMessage.author, matchID)) {
		return;
	}
	let teamNumber;
	if (checkIfStringIsValidInt(arguments[1])) {
		teamNumber = parseInt(arguments[1]);
	}
	else {
		console.log("invalid team #");
		//output user error message here
		return;
	}
	const embedMessage = new Discord.MessageEmbed()
		.setAuthor("In-House Bot | Match ID: " + matchID)
		.setTitle("Vote for the ACE 🥈")
		.setDescription("Processing Teams...")
		.setThumbnail("https://i.imgur.com/YeRFD2H.png")
		.setFooter("Vote for the ACE(s)")

	const msg = await receivedMessage.channel.send(embedMessage);

	mvpAceDescription(msg, embedMessage, matchID, teamNumber)

	msg.react('1️⃣')
		.then(() => msg.react('2️⃣'))
		.then(() => msg.react('3️⃣'))
		.then(() => msg.react('4️⃣'))
		.then(() => msg.react('5️⃣'))
		.then(() => msg.react('🛑'))
		.catch(() => console.error('One of the emojis failed to react.'));

	let player1VoteCount = 0;
	let player2VoteCount = 0;
	let player3VoteCount = 0;
	let player4VoteCount = 0;
	let player5VoteCount = 0;

	const filter = (reaction, user) => { return ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '🛑'].includes(reaction.emoji.name) && user.id != client.user.id };
	const collector = msg.createReactionCollector(filter, { time: MVP_ACE_VOTE_TIME, dispose: true });

	collector.on('collect', (reaction, user) => {
		switch (reaction.emoji.name) {
			case "🛑":
				console.log("🛑 selected from: " + user.id)
				if (user.id == authorID) {
					//msg.reactions.removeAll();
					collector.stop();
				}
				else {
					removeReaction(msg, user.id, '🛑');
				}
				break;
			default:
				break;
		}
	});

	collector.on('end', collected => {
		const userReactions = msg.reactions.cache;
		userReactions.forEach(msgReaction => {
			switch (msgReaction.emoji.name) {
				case "1️⃣":
					player1VoteCount = msgReaction.count;
					break;
				case "2️⃣":
					player2VoteCount = msgReaction.count;
					break;
				case "3️⃣":
					player3VoteCount = msgReaction.count;
					break;
				case "4️⃣":
					player4VoteCount = msgReaction.count;
					break;
				case "5️⃣":
					player5VoteCount = msgReaction.count;
					break;
			}
		})
		let playerVoteCountArray = [player1VoteCount, player2VoteCount, player3VoteCount, player4VoteCount, player5VoteCount];
		playerVoteCountArray.sort(function (a, b) { return b - a });
		let aceArray = [];
		let maxVote = playerVoteCountArray[0];
		if (maxVote <= 1) {
			return;
		}
		try {
			MatchesDatabase.findOne({ match_id: matchID }, async function (err, data) {
				if (data == null) {
					console.log("no data found")
				}
				else {
					let playersIdArray;
					if (teamNumber == 1) {
						playersIdArray = data.team1;
					}
					else if (teamNumber == 2) {
						playersIdArray = data.team2;
					}
					if (playersIdArray.length != 5) {
						return;
					}
					if (player1VoteCount == maxVote) {
						aceArray.push(playersIdArray[0]);
					}
					if (player2VoteCount == maxVote) {
						aceArray.push(playersIdArray[1]);
					}
					if (player3VoteCount == maxVote) {
						aceArray.push(playersIdArray[2]);
					}
					if (player4VoteCount == maxVote) {
						aceArray.push(playersIdArray[3]);
					}
					if (player5VoteCount == maxVote) {
						aceArray.push(playersIdArray[4]);
					}
					aceArray.forEach(aceID => {
						PlayersDatabase.findOne({ player_id: aceID }, async function (err, data) {
							if (data == null) {
								PlayersDatabase.insert({ player_id: playerID, nickname: userNickname, win: 0, loss: 0, win_rate: 1.0, winteam: [], loseteam: [], number_of_mvp: 0, number_of_ace: 1 });
							}
							else {
								PlayersDatabase.update({ player_id: aceID }, { $inc: { number_of_ace: 1 } }, { multi: false }, function (err, numReplaced) { });
							}
						})
					})

					if (aceArray.length > 1) {
						embedMessage.setTitle("ACEs 🥈")
						let aceNickNames = "";
						var i;
						for (i = 0; i < aceArray.length; i++) {
							let userNickname = await getUserNickName(msg, aceArray[i]);
							aceNickNames += "**" + userNickname + "**\n";
						}
						embedMessage.setDescription("\n" + aceNickNames);
					}
					else if (aceArray.length == 1) {
						embedMessage.setTitle("ACE 🥈")
						let userNickname = await getUserNickName(msg, aceArray[0]);
						embedMessage.setDescription("\n**" + userNickname + "**")
					}
					embedMessage.setFooter("")
					msg.edit(embedMessage);
				}
			});
		}
		catch {
			console.log("error");
			return;
		}
	});

}

function mvpAceDescription(msg, embedMessage, matchID, teamNumber) {
	try {
		MatchesDatabase.findOne({ match_id: matchID }, async function (err, data) {
			if (data == null) {
				console.log("no data found")
			}
			else {
				let emojiList = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
				let playersIdArray;
				if (teamNumber == 1) {
					playersIdArray = data.team1;
				}
				else if (teamNumber == 2) {
					playersIdArray = data.team2;
				}
				if (playersIdArray.length != 5) {
					return;
				}
				let embedDescription = "";
				var i;
				for (i = 0; i < 5; i++) {
					embedDescription += emojiList[i] + " | " + await getUserNickName(msg, playersIdArray[i]) + "\n";
				}
				embedMessage.setDescription(embedDescription);
				msg.edit(embedMessage);
			}
		});
	}
	catch {
		console.log("Error updating mvpAce description");
		return;
	}
}

function sendDMToPlayers(usersIdArray, matchID, matchDate) {
	const rolesArray = ["Top", "Jungle", "Mid", "Bot", "Support"];
	var i;
	for (i = 0; i < usersIdArray.length; i++) {
		//client.users.cache.get(usersIdArray[i]).send("**Match ID: " + matchID + "** starting at " + matchDate.toLocaleTimeString([], { timeStyle: 'short' }) + "! You are assigned to play: **" + rolesArray[i] + "**");
	}

}

async function removeReaction(msg, user_id, emoji) {
	const userReactions = msg.reactions.cache.filter(reaction => reaction.users.cache.has(user_id));
	try {
		for (const reaction of userReactions.values()) {
			if (reaction.emoji.name == emoji) {
				await reaction.users.remove(user_id);
			}
		}
	} catch (error) {
		console.error('Failed to remove reaction');
	}
}

async function removeReactions(msg, user_id) {
	const userReactions = msg.reactions.cache.filter(reaction => reaction.users.cache.has(user_id));
	try {
		for (const reaction of userReactions.values()) {
			await reaction.users.remove(user_id);
		}
	} catch (error) {
		console.error('Failed to remove reactions.');
	}
}

function checkCreateMatchArguments(arguments, receivedMessage) {
	let timeRe = new RegExp('^(([0]?[1-9]|1[0-2])(:)([0-5][0-9]))$');
	if (arguments[0].toLowerCase() != "fun" && arguments[0].toLowerCase() != "serious") {
		receivedMessage.author.send("Invalid game-type | try \"serious\" or \"fun\"");
		return false;
	}
	else if (!timeRe.test(arguments[1])) {
		receivedMessage.author.send("Invalid time, valid input HH:MM | example: 08:15");
		return false;
	}
	else if (arguments[2].toLowerCase() != "am" && arguments[2].toLowerCase() != "pm") {
		receivedMessage.author.send("Invalid time argument | try \"am\" or \"pm\"");
		return false;
	}
	return true;
}

async function addMatchToDatabase(msg, embedMessage, arguments, receivedMessage) {
	let currentDate = new Date();
	let HHMM = arguments[1];
	let matchTime = getDateFromHHMM(HHMM, arguments[2]);
	let isSerious = true;
	if (arguments[0].toLowerCase() == "fun") {
		isSerious = false;
	}
	MatchesDatabase.findOne({ match_id: 0 }, function (err, data) {
		if (data != null) {
			let last_match_id = data.LAST_MATCH_ID;
			MatchesDatabase.insert({
				match_id: last_match_id + 1, creator_id: receivedMessage.author.id, message_id: msg.id, match_time: matchTime, create_time: currentDate, serious: isSerious, number_of_players: 0,
				top: [], jungle: [], mid: [], bot: [], support: [],
				team1: [], team2: []
			});
			MatchesDatabase.update({ match_id: 0 }, { $inc: { LAST_MATCH_ID: 1 } }, { multi: false }, function (err, numReplaced) { console.log("Increased LAST_MATCH_ID by 1") });
			let embedDescription = "";
			embedDescription += "```Number of Players: 0/10\n\n";
			embedDescription += "Top: 0/2\n";
			embedDescription += "Jng: 0/2\n";
			embedDescription += "Mid: 0/2\n";
			embedDescription += "Bot: 0/2\n";
			embedDescription += "Sup: 0/2\n\n```";
			embedMessage.setDescription(embedDescription);
			embedMessage.setAuthor("In-House Bot | Match ID: " + (last_match_id + 1))
			msg.edit(embedMessage);
		}
		else {
			console.log("No entries found, contact administrator")
		}
	});

}

async function updateEmbedDescription(msg, embedMessage, matchID) {
	try {
		MatchesDatabase.findOne({ match_id: matchID }, async function (err, data) {
			if (data == null) {
				console.log("no data found")
			}
			else {
				let topArr = data.top;
				let jungleArr = data.jungle;
				let midArr = data.mid;
				let botArr = data.bot;
				let supportArr = data.support;
				let numberOfPlayers = data.number_of_players;
				let embedDescription = "";
				embedDescription += "```Number of Players: " + numberOfPlayers + "/10\n\n";
				embedDescription += "Top: " + topArr.length + "/2\n";
				embedDescription += "Jng: " + jungleArr.length + "/2\n";
				embedDescription += "Mid: " + midArr.length + "/2\n";
				embedDescription += "Bot: " + botArr.length + "/2\n";
				embedDescription += "Sup: " + supportArr.length + "/2\n\n```";
				embedMessage.setDescription(embedDescription);
				msg.edit(embedMessage);
			}
		});
	}
	catch {
		console.log("Error getting players from match ID");
	}
}

function getDateFromHHMM(HHMMInput, ampm) {
	let currentDate = new Date();
	let date = new Date();
	let splitHHMM = HHMMInput.split(":");
	if (checkIfStringIsValidInt(splitHHMM[0]) && checkIfStringIsValidInt(splitHHMM[1])) {
		if (ampm == "pm") {
			if (splitHHMM[0] == "12") {
				date.setHours((parseInt(splitHHMM[0])));
			}
			else {
				date.setHours((parseInt(splitHHMM[0]) + 12));
			}
		}
		else {
			if (splitHHMM[0] == "12") {
				date.setHours((parseInt(0)));
			}
			else {
				date.setHours(parseInt(splitHHMM[0]));
			}
		}
		date.setMinutes(parseInt(splitHHMM[1]));
		date.setSeconds(0);
		if ((currentDate.getTime() - date.getTime()) > 0) {
			date.setDate(date.getDate() + 1);
		}
	}
	return date;
}

//function does not work
function didPlayerSignup(msg, user) {
	try {
		let didPlayerSignupBoolean = false;
		MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
			if (data == null) {
				console.log("no data found")
			}
			else {
				if (isUserInArray(user, data.top) || isUserInArray(user, data.jungle)
					|| isUserInArray(user, data.mid) || isUserInArray(user, data.bot) || isUserInArray(user, data.support)) {
					didPlayerSignupBoolean = true;
				}
			}
		});
		console.log(didPlayerSignupBoolean);
		return didPlayerSignupBoolean;
	}
	catch {
		console.log("Error checking if player signed up");
	}
}

async function addUserToRole(msg, embedMessage, user, role, receivedMessage) {
	//maybe can use $addToSet
	console.log("adding user to database")
	try {
		MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
			if (data == null) {
				console.log("no data found")
			}
			else {
				if (!isUserInArray(user, data.top) && !isUserInArray(user, data.jungle) && !isUserInArray(user, data.mid) && !isUserInArray(user, data.bot) && !isUserInArray(user, data.support)) {
					console.log("PLAYER DID NOT SIGN UP");
					MatchesDatabase.update({ message_id: msg.id }, { $inc: { number_of_players: 1 } }, { multi: false });
				}
			}
		});
	}
	catch {
		console.log("Error checking if player signed up");
	}

	switch (role) {
		case "top":
			try {
				MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
					if (data == null) {
						console.log("no data found")
					}
					else if (isUserInArray(user, data.top)) {
						console.log("user already registered for top")
					}
					else {
						let array = data.top;
						array.push({ nickname: await getUserNickName(msg, user.id), discord_id: user.id })
						MatchesDatabase.update({ message_id: msg.id }, { $set: { top: array } }, { multi: false });
						await updateEmbedDescription(msg, embedMessage, data.match_id);
					}
				});
			}
			catch {
				console.log("Error adding user: " + user.id + " to top role");
			}
			break;
		case "jungle":
			try {
				MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
					if (data == null) {
						console.log("no data found")
					}
					else if (isUserInArray(user, data.jungle)) {
						console.log("user already registered for jungle")
					}
					else {
						let array = data.jungle;
						array.push({ nickname: await getUserNickName(msg, user.id), discord_id: user.id })
						MatchesDatabase.update({ message_id: msg.id }, { $set: { jungle: array } }, { multi: false });
						await updateEmbedDescription(msg, embedMessage, data.match_id);
					}
				});
			}
			catch {
				console.log("Error adding user: " + user.id + " to jungle role");
			}
			break;
		case "mid":
			try {
				MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
					if (data == null) {
						console.log("no data found")
					}
					else if (isUserInArray(user, data.mid)) {
						console.log("user already registered for mid")
					}
					else {
						let array = data.mid;
						array.push({ nickname: await getUserNickName(msg, user.id), discord_id: user.id })
						MatchesDatabase.update({ message_id: msg.id }, { $set: { mid: array } }, { multi: false });
						await updateEmbedDescription(msg, embedMessage, data.match_id);
					}
				});
			}
			catch {
				console.log("Error adding user: " + user.id + " to mid role");
			}
			break;
		case "bot":
			try {
				MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
					if (data == null) {
						console.log("no data found")
					}
					else if (isUserInArray(user, data.bot)) {
						console.log("user already registered for bot")
					}
					else {
						let array = data.bot;
						array.push({ nickname: await getUserNickName(msg, user.id), discord_id: user.id })
						MatchesDatabase.update({ message_id: msg.id }, { $set: { bot: array } }, { multi: false });
						await updateEmbedDescription(msg, embedMessage, data.match_id);
					}
				});
			}
			catch {
				console.log("Error adding user: " + user.id + " to bot role");
			}
			break;
		case "support":
			try {
				MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
					if (data == null) {
						console.log("no data found")
					}
					else if (isUserInArray(user, data.support)) {
						console.log("user already registered for support")
					}
					else {
						let array = data.support;
						array.push({ nickname: await getUserNickName(msg, user.id), discord_id: user.id })
						MatchesDatabase.update({ message_id: msg.id }, { $set: { support: array } }, { multi: false });
						await updateEmbedDescription(msg, embedMessage, data.match_id);
					}
				});
			}
			catch {
				console.log("Error adding user: " + user.id + " to support role");
			}
			break;
	}

}

async function removeUserFromRole(msg, embedMessage, user, receivedMessage, role) {
	try {
		MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
			if (data == null) {
				console.log("no data found")
			}
			else {
				let updateDatabase = false;
				if (role == "top") {
					let topArr = data.top;
					if (getIndexOfUserFromArray(user, topArr) > -1) {
						//updateDatabase = true;
						topArr.splice(getIndexOfUserFromArray(user, topArr), 1)
						let numPlayers = data.number_of_players;
						//MatchesDatabase.update({ message_id: msg.id }, { $set: { top: topArr, number_of_players: numPlayers - 1 } }, { multi: false });
						if (!(isUserInArray(user, data.top) || isUserInArray(user, data.jungle) || isUserInArray(user, data.mid) || isUserInArray(user, data.bot) || isUserInArray(user, data.support))) {
							MatchesDatabase.update({ message_id: msg.id }, { $set: { top: topArr, number_of_players: numPlayers - 1 } }, { multi: false });
						}
						else {
							MatchesDatabase.update({ message_id: msg.id }, { $set: { top: topArr } }, { multi: false });
						}
						updateEmbedDescription(msg, embedMessage, data.match_id);
					}
				}
				else if (role == "jungle") {
					let jungleArr = data.jungle;
					if (getIndexOfUserFromArray(user, jungleArr) > -1) {
						updateDatabase = true;
						jungleArr.splice(getIndexOfUserFromArray(user, jungleArr), 1)
						let numPlayers = data.number_of_players;
						if (!(isUserInArray(user, data.top) || isUserInArray(user, data.jungle) || isUserInArray(user, data.mid) || isUserInArray(user, data.bot) || isUserInArray(user, data.support))) {
							MatchesDatabase.update({ message_id: msg.id }, { $set: { jungle: jungleArr, number_of_players: numPlayers - 1 } }, { multi: false });
						}
						else {
							MatchesDatabase.update({ message_id: msg.id }, { $set: { jungle: jungleArr } }, { multi: false });
						}
						updateEmbedDescription(msg, embedMessage, data.match_id);
					}
				}
				else if (role == "mid") {
					let midArr = data.mid;
					if (getIndexOfUserFromArray(user, midArr) > -1) {
						updateDatabase = true;
						midArr.splice(getIndexOfUserFromArray(user, midArr), 1)
						let numPlayers = data.number_of_players;
						if (!(isUserInArray(user, data.top) || isUserInArray(user, data.jungle) || isUserInArray(user, data.mid) || isUserInArray(user, data.bot) || isUserInArray(user, data.support))) {
							MatchesDatabase.update({ message_id: msg.id }, { $set: { mid: midArr, number_of_players: numPlayers - 1 } }, { multi: false });
						}
						else {
							MatchesDatabase.update({ message_id: msg.id }, { $set: { mid: midArr } }, { multi: false });
						}
						updateEmbedDescription(msg, embedMessage, data.match_id);
					}
				}
				else if (role == "bot") {
					let botArr = data.bot;
					if (getIndexOfUserFromArray(user, botArr) > -1) {
						updateDatabase = true;
						botArr.splice(getIndexOfUserFromArray(user, botArr), 1)
						let numPlayers = data.number_of_players;
						if (!(isUserInArray(user, data.top) || isUserInArray(user, data.jungle) || isUserInArray(user, data.mid) || isUserInArray(user, data.bot) || isUserInArray(user, data.support))) {
							MatchesDatabase.update({ message_id: msg.id }, { $set: { bot: botArr, number_of_players: numPlayers - 1 } }, { multi: false });
						}
						else {
							MatchesDatabase.update({ message_id: msg.id }, { $set: { bot: botArr } }, { multi: false });
						}
						updateEmbedDescription(msg, embedMessage, data.match_id);
					}
				}
				else if (role == "support") {
					let supportArr = data.support;
					if (getIndexOfUserFromArray(user, supportArr) > -1) {
						updateDatabase = true;
						supportArr.splice(getIndexOfUserFromArray(user, supportArr), 1)
						let numPlayers = data.number_of_players;
						if (!(isUserInArray(user, data.top) || isUserInArray(user, data.jungle) || isUserInArray(user, data.mid) || isUserInArray(user, data.bot) || isUserInArray(user, data.support))) {
							MatchesDatabase.update({ message_id: msg.id }, { $set: { support: supportArr, number_of_players: numPlayers - 1 } }, { multi: false });
						}
						else {
							MatchesDatabase.update({ message_id: msg.id }, { $set: { support: supportArr } }, { multi: false });
						}
						updateEmbedDescription(msg, embedMessage, data.match_id);
					}
				}
			}
		});

	}
	catch {
		console.log("Error removing user: " + user.id + " from all roles");
	}
}

async function removeUserFromAllRoles(msg, embedMessage, user, receivedMessage) {
	try {
		MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
			if (data == null) {
				console.log("no data found")
			}
			else {
				let updateDatabase = false;
				let topArr = data.top;
				if (getIndexOfUserFromArray(user, topArr) > -1) {
					updateDatabase = true;
					topArr.splice(getIndexOfUserFromArray(user, topArr), 1)
				}
				let jungleArr = data.jungle;
				if (getIndexOfUserFromArray(user, jungleArr) > -1) {
					updateDatabase = true;
					jungleArr.splice(getIndexOfUserFromArray(user, jungleArr), 1)
				}
				let midArr = data.mid;
				if (getIndexOfUserFromArray(user, midArr) > -1) {
					updateDatabase = true;
					midArr.splice(getIndexOfUserFromArray(user, midArr), 1)
				}
				let botArr = data.bot;
				if (getIndexOfUserFromArray(user, botArr) > -1) {
					updateDatabase = true;
					botArr.splice(getIndexOfUserFromArray(user, botArr), 1)
				}
				let supportArr = data.support;
				if (getIndexOfUserFromArray(user, supportArr) > -1) {
					updateDatabase = true;
					supportArr.splice(getIndexOfUserFromArray(user, supportArr), 1)
				}
				if (updateDatabase) {
					let numPlayers = data.number_of_players;
					MatchesDatabase.update({ message_id: msg.id }, { $set: { top: topArr, jungle: jungleArr, mid: midArr, bot: botArr, support: supportArr, number_of_players: numPlayers - 1 } }, { multi: false });
					updateEmbedDescription(msg, embedMessage, data.match_id);
				}

			}
		});

	}
	catch {
		console.log("Error removing user: " + user.id + " from all roles");
	}
}

async function printUserRoles(arguments, receivedMessage) {
	let authorID = receivedMessage.author.id;
	console.log(authorID);
	let matchID = arguments[0];
	if (!checkIfStringIsValidInt(matchID)) {
		console.log("Not a valid match ID");
		return;
	}
	matchID = parseInt(arguments[0]);

	const embedMessage = new Discord.MessageEmbed()
		.setAuthor("In-House Bot")
		.setTitle("Players for Match ID: " + arguments[0])
		.setDescription("Processing Teams...")
		.setFooter("Click on 🔄 to refresh players, ❌ to delete this message")
	//.setThumbnail("https://i.imgur.com/YeRFD2H.png")

	const msg = await receivedMessage.channel.send(embedMessage);
	msg.react('🔄')
		.then(() => msg.react('❌'))
		.catch(() => console.error('One of the emojis failed to react.'));


	const filter = (reaction, user) => { return ['❌', '🔄'].includes(reaction.emoji.name) && user.id != client.user.id };
	const collector = msg.createReactionCollector(filter, {});
	collector.on('collect', (reaction, user) => {
		switch (reaction.emoji.name) {
			case "❌":
				if (user.id == authorID) {
					msg.delete();
				}
				removeReaction(msg, user.id, '❌');
				break;
			case "🔄":
				updatePrintUserRoles(msg, embedMessage, matchID);
				removeReaction(msg, user.id, '🔄');
				break;
			default:
				console.log("something went wrong with collecting reactions")
				break;
		}
	});

	collector.on('end', collected => {
		console.log("collection ended");
	});

	updatePrintUserRoles(msg, embedMessage, matchID);

}

function updatePrintUserRoles(msg, embedMessage, matchID) {
	try {
		MatchesDatabase.findOne({ match_id: matchID }, async function (err, data) {
			if (data == null) {
				console.log("no data found")
			}
			else {
				let printMessage = "";
				let topArr = data.top;
				let jungleArr = data.jungle;
				let midArr = data.mid;
				let botArr = data.bot;
				let supportArr = data.support;
				printMessage += "Number of Players: " + data.number_of_players + "/10\n\n";
				printMessage += "TOP: " + getUserNickNamesFromArray(topArr) + "\n";
				printMessage += "JNG: " + getUserNickNamesFromArray(jungleArr) + "\n";
				printMessage += "MID: " + getUserNickNamesFromArray(midArr) + "\n";
				printMessage += "BOT: " + getUserNickNamesFromArray(botArr) + "\n";
				printMessage += "SUP: " + getUserNickNamesFromArray(supportArr) + "\n";
				embedMessage.setDescription("```" + printMessage + "```");
				//receivedMessage.author.send();
				msg.edit(embedMessage)
			}
		});
	}
	catch {
		console.log("Error trying to print all players from match ID");
	}
}

function sendSelectedRoles(msg, user) {
	try {
		MatchesDatabase.findOne({ message_id: msg.id }, async function (err, data) {
			if (data == null) {
				console.log("no data found")
			}
			else {
				let printMessage = "Match ID: " + data.match_id + " | You are currently signed up to play ";
				let isSignedUp = false;
				let topArr = data.top;
				let jungleArr = data.jungle;
				let midArr = data.mid;
				let botArr = data.bot;
				let supportArr = data.support;
				if (isUserInArray(user, topArr)) {
					isSignedUp = true;
					printMessage += "TOP, "
				}
				if (isUserInArray(user, jungleArr)) {
					isSignedUp = true;
					printMessage += "JUNGLE, "
				}
				if (isUserInArray(user, midArr)) {
					isSignedUp = true;
					printMessage += "MID, "
				}
				if (isUserInArray(user, botArr)) {
					isSignedUp = true;
					printMessage += "BOT, "
				}
				if (isUserInArray(user, supportArr)) {
					isSignedUp = true;
					printMessage += "SUPPORT, "
				}
				if (isSignedUp) {
					user.send(printMessage.slice(0, -2));
				}
				else {
					user.send("Match ID: " + data.match_id + " | You are currently NOT signed up for this match")
				}
			}
		});
	}
	catch {
		console.log("Error trying to print all players from match ID");
	}
}

function rolesCommand(arguments, receivedMessage) {
	try {
		if (!checkIfStringIsValidInt(arguments[0])) {
			receivedMessage.author.send("Invalid Match ID, must be a number");
			return;
		}
		MatchesDatabase.findOne({ match_id: parseInt(arguments[0]) }, async function (err, data) {
			if (data == null) {
				receivedMessage.author.send("Error in finding the match, perhaps the match does not exist?")
				console.log("no data found")
			}
			else {
				let printMessage = "Match ID: " + data.match_id + " | You are currently signed up to play ";
				let isSignedUp = false;
				let topArr = data.top;
				let jungleArr = data.jungle;
				let midArr = data.mid;
				let botArr = data.bot;
				let supportArr = data.support;
				let user = receivedMessage.author;
				if (isUserInArray(user, topArr)) {
					isSignedUp = true;
					printMessage += "TOP, "
				}
				if (isUserInArray(user, jungleArr)) {
					isSignedUp = true;
					printMessage += "JUNGLE, "
				}
				if (isUserInArray(user, midArr)) {
					isSignedUp = true;
					printMessage += "MID, "
				}
				if (isUserInArray(user, botArr)) {
					isSignedUp = true;
					printMessage += "BOT, "
				}
				if (isUserInArray(user, supportArr)) {
					isSignedUp = true;
					printMessage += "SUPPORT, "
				}
				if (isSignedUp) {
					user.send(printMessage.slice(0, -2));
				}
				else {
					user.send("Match ID: " + data.match_id + " | You are currently NOT signed up for this match")
				}
			}
		});
	}
	catch {
		console.log("Error with roles command");
	}
}

function getUserNickNamesFromArray(array) {
	let returnMsg = "";
	for (const elem of array) {
		returnMsg += elem.nickname;
		returnMsg += " | "
	}
	if (array.length > 0) {
		return returnMsg.slice(0, -3)
	}
	return returnMsg;
}

function checkIfStringIsValidInt(input) {
	if (isNaN(input)) {
		return false
	}
	else {
		if (Number(input) === parseInt(input, 10)) {
			return true
		}
		else {
			return false
		}
	}
}

async function isUserMatchCreator(user, matchID) {
	var isCreator = false;
	try {
		MatchesDatabase.findOne({ match_id: matchID }, function (err, data) {
			if (data == null) {
				console.log("no data found")
			}
			else {
				if (user.id == data.creator_id) {
					//console.log(isCreator);
					isCreator = true;
					//console.log(isCreator);
				}
			}
		});
		//console.log(isCreator);
		return isCreator;
	}
	catch {
		console.log("Error checking if user is match creator");
		return false;
	}

}

function isUserInArray(user, array) {
	for (const elem of array) {
		if (elem.discord_id == user.id) {
			return true;
		}
	}
	return false;
}

function getIndexOfUserFromArray(user, array) {
	let index = 0;
	for (const elem of array) {
		if (elem.discord_id == user.id) {
			return index;
		}
		index += 1;
	}
	return -1;
}

async function getUserNickName(msg, userId) {
	let nickname = msg.guild.members.fetch(userId).then(result => {
		return result.displayName
	});
	return nickname;
}

function getUserFromMention(mention) {
	if (!mention) return;

	if (mention.startsWith('<@') && mention.endsWith('>')) {
		mention = mention.slice(2, -1);

		if (mention.startsWith('!')) {
			mention = mention.slice(1);
		}

		return client.users.cache.get(mention);
	}
}

function getArrayOfUsersFromMentions(mentions, receivedMessage) {
	//mentions is list of arguments past 1
	let users = []
	var i;
	for (i = 0; i < mentions.length; i++) {
		let user = getUserFromMention(mentions[i]);
		if (user !== undefined) {
			users.push(user);
		}
	}
	return users;
}

function leaderboardCommand(arguments, receivedMessage) {
	try {
		if (arguments[0] == "all") {
			limit = Number.MAX_SAFE_INTEGER
		}
		else if (arguments[0] == null) {
			limit = 10;
		}
		else if (!checkIfStringIsValidInt(arguments[0])) {
			receivedMessage.channel.send("not a valid number!\n\!leaderboard <number>")
			return;
		}
		else {
			limit = parseInt(arguments[0])
		}

		PlayersDatabase.find({}).sort({ win_rate: -1, number_of_mvp: -1, number_of_ace: -1 }).exec(function (err, data) {
			if (data != null) {
				let amt = 0;
				let tenIn = 0;
				var fields = [["#", "Name", "W/L | %", "MVPs", "ACEs"]];
				data.forEach(function (item) {

					if (amt < limit && !(item.win + item.loss < 4)) {
						let winrateString = (Math.floor(item.win_rate * 100) + "%");
						let numMVP = "";
						if (item.number_of_mvp != 0) {
							numMVP = item.number_of_mvp;
						}
						let numACE = "";
						if (item.number_of_ace != 0) {
							numACE = item.number_of_ace;
						}
						fields.push([amt + 1, item.nickname, (item.win + "W/" + item.loss + "L | " + winrateString), numMVP, numACE]);
						amt++;
						tenIn++;
					}

					if (tenIn == 10) {
						tenIn = 0;
						receivedMessage.channel.send("```\n" + table.table(fields) + "\n```");
						fields = [["#", "Name", "W/L | %", "MVPs", "ACEs"]];
					}

				});
				if (tenIn > 0) {
					receivedMessage.channel.send("```\n" + table.table(fields) + "\n```");
				}
			}
			else {
				receivedMessage.channel.send("DB error, perhaps it's empty?");
			}
		});
	}
	catch (err) {
		receivedMessage.channel.send("Something went wrong");
	}
}

function statsCommand(arguments, receivedMessage) {
	//!stats
	//console.log("stats command ran")
	PlayersDatabase.findOne({ player_id: receivedMessage.author.id }, async function (err, data) {
		if (data == null) {
			console.log("Player not found");
			receivedMessage.channel.send("No stats available, if you think this is wrong please contact the administrators");
		}
		else {
			
			let winrateString = (Math.floor(data.win_rate * 100) + "%");
			var msg = "```Stats for " + data.nickname + "\n";
			msg += data.win + "W " + data.loss + "L\n";
			msg += "Winrate | " + winrateString + "\n";
			msg += "MVPs | " + data.number_of_mvp + "\n";
			msg += "ACEs | " + data.number_of_ace + "\n";
			msg += "=================================================\n"
			//msg += "```";
			
			//const sentMsg = await receivedMessage.channel.send(msg);

			let mergedwin = [].concat.apply([], data.winteam);
			let mergedlose = [].concat.apply([], data.loseteam);
			let players = await getPlayersWinrates(receivedMessage.author.id, mergedwin, mergedlose);
			players.forEach(function(value, key) {
				PlayersDatabase.findOne({player_id: key}, async function (err, player) {
				   //console.log(player.nickname);
				   //msg += (player.nickname + " " + value.wins + " " + value.loss);
				   msg += player.nickname + " | " + value.wins + "W " + value.loss + "L ";
				   console.log(player.nickname);


					
			   });
			   //msg += (key + " " + value.wins + " " + value.loss);
		   });
		   console.log(msg);
		}
	});
}

async function getPlayersWinrates(pID, winteamArray, loseteamArray) {
	var players = new Map();
	winteamArray.forEach(id => {
		//console.log(id);
		if(id == pID){
		}
		else if(players.has(id)){
			players.set(id, {wins: players.get(id).wins + 1, loss: players.get(id).loss});
		}
		else {
			players.set(id, {wins: 1, loss: 0});
		}
	});

	loseteamArray.forEach(id => {
		//console.log(id);
		if(id == pID){
		}
		else if(players.has(id)){
			players.set(id, {wins: players.get(id).wins, loss: players.get(id).loss + 1});
		}
		else {
			players.set(id, {wins: 0, loss: 1});
		}
	});

	return players;
}

function isPlayerInArray(playerArray, id) {
	var found = false;
	for (var i = 0; i < playerArray.length; i++) {
		if (playerArray[i].id == id) {
			found = true;
			break;
		}
	}
	return found;
}

async function compactDatabases() {
	MatchesDatabase.persistence.compactDatafile();
	PlayersDatabase.persistence.compactDatafile();
}

async function testCommand(arguments, receivedMessage) {
	
}
