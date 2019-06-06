const functions = require("firebase-functions")
const request = require("request")

const token = functions.config().taskme.token
const project_id = parseInt(functions.config().taskme.project)
const helpText =
  "To add a task for me to get back to you, use `/taskme Your message here` and I'll get a TODO added to my list for today.\n\n" +
  "If your task is somewhat urgent, use `/taskme urgent Your message here` to have `taskme` assign it a higher priority.\n\n" +
  "If it's really urgent, use the usual methods to get attention in Slack as I will process tasks in my todo list as I have time."
const successText =
  "I usually process todo items in the mornings, so I should usually have some response for you by tomorrow!"
const urgentMarker = `urgent`

exports.taskMe = functions.https.onRequest((req, res) => {
  return new Promise((resolve, reject) => {
    const { text, response_url } = req.body
    if (text.toLowerCase() === "help") {
      res.send(slackMessage("How to use /taskme", helpText))
      resolve()
      return
    }

    res.send(slackMessage("Your task is being added..."))

    addTask(req.body, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        request.post(response_url, slackMessage("Success!", successText))
        resolve()
        return
      }

      console.error({ error, request: options.body, response: body })
      post(
        response_url,
        slackMessage(
          "Failed to add a task :(",
          "Feel free to contact me directly!"
        )
      )
      reject(error)
    })
  })
})

function addTask({ text, user_name }, cb) {
  const [isUrgent, msg] = parsePriority(text)
  const content =
    msg.length === 0
      ? `${user_name} has a task for you`
      : `${user_name} says: ${msg}`
  const priority = isUrgent ? 3 : 2
  const order = 1
  const due_string = "today"

  const options = {
    url: "https://beta.todoist.com/API/v8/tasks",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    json: true,
    body: { content, priority, project_id, order, due_string }
  }
  request.post(options, cb)
}

function slackMessage(title, ...rest) {
  const msg = {
    response_type: "ephemeral",
    text: title
  }
  if (rest !== undefined && rest.length > 0) {
    msg.attachments = rest.map((text) => ({ text }))
  }
  return msg
}

function post(url, body, cb) {
  return request.post({ url, json: true, body }, cb)
}

function parsePriority(msg = "") {
  const prefix = msg.substr(0, urgentMarker.length)
  if (prefix.toLowerCase() === urgentMarker) {
    return [true, msg.slice(urgentMarker.length).trim()]
  }
  return [false, msg]
}
