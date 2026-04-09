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
--
