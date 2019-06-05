Clone and run this in conjunction with thr sunday-react-frontend project to try out a development Sunday web-app project.
You can find it by following this link: https://github.com/rak99/sunday-react-frontend

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
