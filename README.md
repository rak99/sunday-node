# sunday-node

Run `yarn dev` in Terminal to test
Run `yarn start` to run

REMOTE

Run `yarn build` and then `pm2 start dist` to run remotely

Add this line to compile pug:
"pug": "pug -w src/mail/templates -o dist/mail/templates",

Check:

- dev mode 'false' when running live
- emails set to send!!!!!
- recording logs, and not storing
- manually upload config files with keys (awsconfig.json and config.json)
