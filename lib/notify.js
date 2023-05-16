export default async function notify(conf) {
  let active_notifiers = [];
  let interactive_notifiers = [];

  for (let notifier in conf.notifiers) {
    if (conf.notifiers[notifier].on) {
      let a = await import(`../extensions/notifiers/${notifier}.js`);
      let notif = a.default(conf.notifiers[notifier]);
      notif.notifier_name = notifier;

      active_notifiers.push(notif);
      if (conf.notifiers[notifier].interactive) {
        interactive_notifiers.push(notif);
      }
    }
  }

  let pushMessage = (title, message) => {
    if (conf.debug) {
      console.log(`${title}: ${message}`);
    }

    active_notifiers.forEach(notifier => {
      if (conf.debug) {
        console.log(`Sending push message via ${notifier.notifier_name}`);
      }
      notifier.pushMessage(title, message);
    });
  };

  let onMessage = callback => {
    interactive_notifiers.forEach(notifier => {
      if (conf.debug) {
        console.log(`Receiving message from ${notifier.notifier_name}`);
      }
      notifier.onMessage(callback);
    });
  };

  return {
    pushMessage: pushMessage,
    onMessage: onMessage,
  };
}
