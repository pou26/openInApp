const { google } = require("googleapis");
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, REFRESH_TOKEN } = require("./credentials");

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const repliedUsers = new Set();

async function checkEmailsendReply() {
  try {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    const res = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
    });
    const messages = res.data.messages;
    if (messages && messages.length > 0) {
      for (const message of messages) {
        const email = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
        });
        const from = email.data.payload.headers.find(
          (header) => header.name === "From"
        );
        const toHeader = email.data.payload.headers.find(
          (header) => header.name === "To"
        );
        const Subject = email.data.payload.headers.find(
          (header) => header.name === "Subject"
        );
        const From = from.value;
        const toEmail = toHeader.value;
        const subject = Subject.value;
        console.log("This email is coming From", From);
        console.log("to Email", toEmail);

        if (repliedUsers.has(From)) {
          console.log("Already replied to:", From);
          continue;
        }

        const thread = await gmail.users.threads.get({
          userId: "me",
          id: message.threadId,
        });
        const replies = thread.data.messages.slice(1);
        if (replies.length === 0) {
          const reply = await createReplyRaw(From, toEmail, subject);

          await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: reply,
            },
          });

          const labelName = "onVacation";
          const labelId = await createLabelIfNeeded(labelName);

          await gmail.users.messages.modify({
            userId: "me",
            id: message.id,
            requestBody: {
              addLabelIds: [labelId],
            },
          });

          console.log("Sent reply to email: ", From);

          repliedUsers.add(From);
        }
      }
    }
  } catch (error) {
    console.error("Error occurred: ", error);
  }
}

async function createReplyRaw(from, to, subject) {
  const emailContent = `From : ${from}\nTo: ${to}\nSubject: ${subject}\n\nThank you for your message. I am unavailable right now. Please expect a delay in my response. I will get back to you as soon as possible...`;

  const base64EncodedEmail = Buffer.from(emailContent)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return base64EncodedEmail;
}

async function createLabelIfNeeded(labelName) {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  const res = await gmail.users.labels.list({ userId: "me" });
  const labels = res.data.labels;

  const existingLabel = labels.find((label) => label.name === labelName);
  if (existingLabel) {
    return existingLabel.id;
  }

  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: labelName,
      labelListVisibility: "labelShow",
    },
  });
  return newLabel.data.id;
}

// Set the interval for checking emails and sending replies
setInterval(checkEmailsendReply,300000); // Check every 5 minutes (300,000 milliseconds)
