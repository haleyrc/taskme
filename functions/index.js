const functions = require("firebase-functions")
const request = require("request")

const token = functions.config().taskme.token
const projectID = parseInt(functions.config().taskme.project)
const helpText =
  "To add a task for me to get back to you, use `/taskme Your message here` and I'll get a TODO added to my list for today.\n\n" +
  "If your task is somewhat urgent, use `/taskme urgent Your message here` to have `taskme` assign it a higher priority.\n\n" +
  "If it's really urgent, use the usual methods to get attention in Slack as I will process tasks in my todo list as I have time."
const successText =
  "I usually process todo items in the mornings, so I should usually have some response for you by tomorrow!"
const urgentMarker = `urgent`

exports.taskMe = functions.https.onRequest((req, res) => {
  return new Promise((resolve, reject) => {
    const { text, user_name, response_url } = req.body
    if (text.toLowerCase() === "help") {
      res.send({
        response_type: "ephemeral",
        text: "How to use /taskme",
        attachments: [{ text: helpText }]
      })
      resolve()
      return
    }

    res.send({
      response_type: "ephemeral",
      text: "Your task is being added..."
    })

    const [isUrgent, msg] = parsePriority(text)
    const options = {
      url: "https://beta.todoist.com/API/v8/tasks",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      json: true,
      body: {
        content:
          msg.length === 0
            ? `${user_name} has a task for you`
            : `${user_name} says: ${msg}`,
        due_string: "today",
        priority: isUrgent ? 3 : 2,
        order: 1,
        project_id: projectID
      }
    }
    request.post(options, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        request.post({
          url: response_url,
          json: true,
          body: {
            response_type: "ephemeral",
            text: "Success!",
            attachments: [{ text: successText }]
          }
        })
        resolve()
      } else {
        console.error({ error, request: options.body, response: body })
        request.post({
          url: response_url,
          json: true,
          body: {
            response_type: "ephemeral",
            text: "Failed to add a task :(",
            attachments: [{ text: "Feel free to contact me directly!" }]
          }
        })
        reject(error)
      }
    })
  })
})

function parsePriority(msg = "") {
  const prefix = msg.substr(0, urgentMarker.length)
  if (prefix.toLowerCase() === urgentMarker) {
    return [true, msg.slice(urgentMarker.length).trim()]
  }
  return [false, msg]
}
