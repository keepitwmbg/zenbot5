import { IncomingWebhook } from '@slack/client';

export default function slack(config) {
  var slack = {
    pushMessage: (title, message) => {
      var slackWebhook = new IncomingWebhook(config.webhook_url || '', {});
      slackWebhook.send(title + ': ' + message, function (err) {
        if (err) {
          console.error('\nerror: slack webhook');
          console.error(err);
        }
      });
    },
  };
  return slack;
}
