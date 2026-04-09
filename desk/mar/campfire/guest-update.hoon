::  campfire guest update mark
::
/-  campfire
|_  =guest-update:campfire
++  grab
  |%
  ++  noun  guest-update:campfire
  --
++  grow
  |%
  ++  noun  guest-update
  ++  json  enjs
  --
++  grad  %noun
::
++  enjs
  ^-  ^json
  =,  enjs:format
  ?-  -.guest-update
      %guest-join
    %-  pairs
    :~  ['type' s+'guest-join']
        ['guestId' s+guest-id.guest-update]
        ['displayName' s+display-name.guest-update]
        ['offer' s+offer.guest-update]
    ==
  ::
      %guest-ice
    %-  pairs
    :~  ['type' s+'guest-ice']
        ['guestId' s+guest-id.guest-update]
        ['candidate' s+candidate.guest-update]
    ==
  ::
      %guest-left
    %-  pairs
    :~  ['type' s+'guest-left']
        ['guestId' s+guest-id.guest-update]
    ==
  ==
--
