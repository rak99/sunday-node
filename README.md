# sunday-node

Run `yarn dev` in Terminal to test
Run `yarn start` to run
Run `yarn build` and then `forever start dist` to run remotely

Add this line to compile pug:
"pug": "pug -w src/mail/templates -o dist/mail/templates",

Check:

- dev mode 'false' when running live
- emails set to send!!!!!
- recording logs, and not storing
- manually upload config files with keys (awsconfig.json and config.json)

Next up:

https://certsimple.com/blog/deploy-node-on-linux
https://stackoverflow.com/questions/4018154/how-do-i-run-a-node-js-app-as-a-background-service?rq=1