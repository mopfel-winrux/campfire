::  campfire rooms list mark
::
/-  campfire
/+  camp=campfire
|_  rms=(map room-id:campfire room:campfire)
++  grab
  |%
  ++  noun  (map room-id:campfire room:campfire)
  --
++  grow
  |%
  ++  noun  rms
  ++  json  (rooms:enjs:camp rms)
  --
++  grad  %noun
--
