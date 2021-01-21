const fetch = require("node-fetch");

const { API_ENDPOINT, MAX_EMBED_FIELD_CHARS } = require("./helpers/discord-helpers.js");
const { createJwt, decodeJwt } = require("./helpers/jwt-helpers.js");

exports.handler = async function (event, context) {
    let payload;

    if (process.env.USE_NETLIFY_FORMS) {
        payload = JSON.parse(event.body).payload.data;
    } else {
        if (event.httpMethod !== "POST") {
            return {
                statusCode: 405
            };
        }

        const params = new URLSearchParams(event.body);
        payload = {
            banReason: params.get("banReason") || undefined,
            appealText: params.get("appealText") || undefined,
            futureActions: params.get("futureActions") || undefined,
            token: params.get("token") || undefined
        };
    }

    if (payload.banReason !== undefined &&
        payload.appealText !== undefined &&
        payload.futureActions !== undefined && 
        payload.token !== undefined) {
        
        const userInfo = decodeJwt(payload.token);
        const embedFields = [
            {
                name: "Bruger:",
                value: `<@${userInfo.id}> (${userInfo.username}#${userInfo.discriminator})`
            },
            {
                name: "Hvorfor var du bannet?",
                value: payload.banReason.slice(0, MAX_EMBED_FIELD_CHARS)
            },
            {
                name: "Hvorfor skal du unbannes?",
                value: payload.appealText.slice(0, MAX_EMBED_FIELD_CHARS)
            },
            {
                name: "Hvad vil du gøre for at undgå at blive bannet i fremtiden?",
                value: payload.futureActions.slice(0, MAX_EMBED_FIELD_CHARS)
            }
        ];

        if (process.env.GUILD_ID && !process.env.DISABLE_UNBAN_LINK) {
            const unbanUrl = new URL("/.netlify/functions/unban", process.env.URL);
            const unbanInfo = {
                userId: userInfo.id
            };

            embedFields.push({
                name: "Actions",
                value: `[Godkend Appel og unban brugeren](${unbanUrl.toString()}?token=${encodeURIComponent(createJwt(unbanInfo))})`
            });
        }

        const result = await fetch(`${API_ENDPOINT}/channels/${encodeURIComponent(process.env.APPEALS_CHANNEL)}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`
            },
            body: JSON.stringify({
                embed: {
                    title: "Ny Ban Appel er modtaget",
                    timestamp: new Date().toISOString(),
                    fields: embedFields
                }
            })
        });

        if (result.ok) {
            if (process.env.USE_NETLIFY_FORMS) {
                return {
                    statusCode: 200
                };
            } else {
                return {
                    statusCode: 303,
                    headers: {
                        "Location": "/success"
                    }
                };
            }
        } else {
            console.log(await result.json());
            throw new Error("Failed to submit message");
        }
    }

    return {
        statusCode: 400
    };
}
