::  campfire: room management types
::
|%
+$  room-id  @ta
+$  room
  $:  host=@p
      name=room-id
      title=@t
      members=(set @p)
      public=?
      created=@da
  ==
::
+$  action
  $%  [%create name=room-id title=@t public=?]
      [%join host=@p name=room-id]
      [%leave host=@p name=room-id]
      [%close name=room-id]
  ==
::
+$  update
  $%  [%snapshot =room]
      [%joined name=room-id who=@p]
      [%left name=room-id who=@p]
      [%closed name=room-id]
  ==
::
+$  remote-action
  $%  [%join name=room-id]
      [%leave name=room-id]
  ==
::
::  guest types for public rooms
::
+$  guest-id  @ta
+$  guest-token  @ta
+$  guest-session
  $:  room=room-id
      token=guest-token
      display-name=@t
      offer=@t
      outbox=(list guest-event)
      last-seen=@da
  ==
::
+$  guest-event
  $%  [%answer sdp=@t]
      [%ice candidate=@t]
      [%closed ~]
  ==
::
::  updates sent to the host browser subscribing to /public/room/[name]
::
+$  guest-update
  $%  [%guest-join guest-id=guest-id display-name=@t offer=@t]
      [%guest-ice guest-id=guest-id candidate=@t]
      [%guest-left guest-id=guest-id]
  ==
::
::  pokes from the host browser when answering a guest
::
+$  host-signal
  $%  [%answer guest-id=guest-id sdp=@t]
      [%host-ice guest-id=guest-id candidate=@t]
      [%kick guest-id=guest-id]
  ==
--
