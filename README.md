# sunday-node

Run `yarn dev` in Terminal to start the app

Add this line to compile pug:
"pug": "pug -w src/mail/templates -o dist/mail/templates",

# Testing:

1. louis.barclay@gmail.com sends email

EXPECTED: reply asking for more info

2. louis barclay fails to send more info

EXPECTED: send 'on_noinfo'

3. louis.barclay@gmail.com provides more info
invites:
- louis.barclay+janet@gmail.com
- louis.barclay+fred@gmail.com
- louis.barclay+xanthe@gmail.com
Also has own email in signature at bottom of email
louis.barclay@gmail.com

~~expected to add all 3 of them to louis barclay's receive from ids? or not yet. RESOLVED~~
FIXME: if send more emails, should ignore right? i think so yeah.

EXPECTED: confirmation. ignore own email

#. louis.barclay+janet@gmail.com asks not to be sent stories by louis.barclay@gmail.com - TAKEMEOUT

EXPECTED: confirmation of deletion - to louis.barclay+janet@gmail.com and to louis.barclay@gmail.com

4. louis.barclay@gmail.com emails in again, with repeated sign up info

EXPECTED: assume it's a story from here on in, unless there's a command

5. louis.barclay@gmail.com emails in again, with image and story

EXPECTED: confirmation of story creation


louis.barclay@gmail.com emails in again, with updated image and story

EXPECTED: story gets updated

louis.barclay@gmail.com emails in again, writing UPDATEIMAGE and with new image

EXPECTED: story gets updated, confirmation gets sent

7. louis.barclay+fred@gmail.com emails with name, and wants to add louis.barclay@gmail.com, and louis.barclay+xanthe.com

FIXME: clarify in invite that inviter will be recipient by default

EXPECTED: louis.barclay@gmail.com update receiveFromID. send confirmation of recipients to louis.barclay+fred@gmail.com

louis.barclay@gmail.com writes CANCEL to story

EXPECTED: story gets deleted, confirmation gets sent
