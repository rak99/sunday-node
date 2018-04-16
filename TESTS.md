# Testing:

Nice status quo:

1. louis.barclay@gmail.com
Louistest Barclaytest
- louis.barclay+janet@gmail.com
- louis.barclay+fred@gmail.com
- louis.barclay+xanthe@gmail.com

2. louis.barclay+janet@gmail.com
Janet Baby
- louis.barclay@gmail.com
- louis.barclay+fred@gmail.com
- louis.barclay+xanthe@gmail.com
- louis.barclay+horty@gmail.com


1. louis.barclay@gmail.com sends email
>EXPECTED: reply asking for more info

2. louis barclay fails to send more info
>EXPECTED: send 'on_noinfo'

3. louis.barclay@gmail.com provides more info
invites:
- louis.barclay+janet@gmail.com
- louis.barclay+fred@gmail.com
- louis.barclay+xanthe@gmail.com
has own email
- louis.barclay@gmail.com

>EXPECTED: confirmation. ignore own email

4. louis.barclay+janet@gmail.com asks not to be sent stories by 
louis.barclay@gmail.com - NOTHANKS

>EXPECTED: confirmation of deletion
to louis.barclay+janet@gmail.com
to louis.barclay@gmail.com

5. louis.barclay@gmail.com emails in again, with repeated sign up info

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
