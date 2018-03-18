# sunday-node

Run `yarn dev` in Terminal to start the app

Add this line to compile pug:
"pug": "pug -w src/mail/templates -o dist/mail/templates",

# Testing:

louis.barclay@gmail.com sends email

EXPECTED: reply asking for more info

louis.barclay@gmail.com provides more info
invites:
- janet@curtains.com
- fred@pie.com
- xanthe@exotic.com
Also has own email in signature at bottom of email
louis.barclay@gmail.com

EXPECTED: confirmation. ignore own email

louis.barclay@gmail.com emails in again, with image and story

EXPECTED: confirmation of story creation

janet@curtains.com asks not to be sent stories by louis.barclay@gmail.com - TAKEMEOUT

EXPECTED: confirmation of deletion - to janet@curtains.com and to louis.barclay@gmail.com

louis.barclay@gmail.com emails in again, with updated image and story

EXPECTED: story gets updated

louis.barclay@gmail.com emails in again, writing UPDATEIMAGE and with new image

EXPECTED: story gets updated, confirmation gets sent

fred@pie.com emails with name

FIXME: clarify in invite that inviter will be recipient by default

EXPECTED: louis.barclay@gmail.com update receiveFromID. send confirmation of recipients to fred@pie.com

louis.barclay@gmail.com writes CANCEL to story

EXPECTED: story gets deleted, confirmation gets sent
