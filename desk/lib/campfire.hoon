::  campfire: JSON serialization helpers
::
/-  campfire
|%
++  enjs
  =,  enjs:format
  |%
  ++  room
    |=  =room:campfire
    ^-  json
    %-  pairs
    :~  host+s+(scot %p host.room)
        name+s+name.room
        title+s+title.room
        public+b+public.room
        created+s+(scot %da created.room)
        :-  'members'
        :-  %a
        %+  turn  ~(tap in members.room)
        |=(who=@p s+(scot %p who))
    ==
  ::
  ++  update
    |=  =update:campfire
    ^-  json
    ?-  -.update
        %snapshot
      %-  pairs
      :~  type+s+'snapshot'
          room+(room room.update)
      ==
        %joined
      %-  pairs
      :~  type+s+'joined'
          name+s+name.update
          who+s+(scot %p who.update)
      ==
        %left
      %-  pairs
      :~  type+s+'left'
          name+s+name.update
          who+s+(scot %p who.update)
      ==
        %closed
      %-  pairs
      :~  type+s+'closed'
          name+s+name.update
      ==
    ==
  ::
  ++  rooms
    |=  rms=(map room-id:campfire room:campfire)
    ^-  json
    :-  %a
    %+  turn  ~(val by rms)
    room
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  action
    |=  jon=json
    ^-  action:campfire
    ?>  ?=([%o *] jon)
    =/  typ  (so (~(got by p.jon) 'type'))
    ?:  =(typ 'create')
      :*  %create
          (so (~(got by p.jon) 'name'))
          (so (~(got by p.jon) 'title'))
          (fall (bind (~(get by p.jon) 'public') bo) %.n)
      ==
    ?:  =(typ 'join')
      :*  %join
          (slav %p (so (~(got by p.jon) 'host')))
          (so (~(got by p.jon) 'name'))
      ==
    ?:  =(typ 'leave')
      :*  %leave
          (slav %p (so (~(got by p.jon) 'host')))
          (so (~(got by p.jon) 'name'))
      ==
    ?:  =(typ 'close')
      [%close (so (~(got by p.jon) 'name'))]
    ~|("unknown campfire action: {<typ>}" !!)
  ::
  ++  remote-action
    |=  jon=json
    ^-  remote-action:campfire
    ?>  ?=([%o *] jon)
    =/  typ  (so (~(got by p.jon) 'type'))
    ?:  =(typ 'join')
      [%join (so (~(got by p.jon) 'name'))]
    ?:  =(typ 'leave')
      [%leave (so (~(got by p.jon) 'name'))]
    ~|("unknown campfire remote action: {<typ>}" !!)
  --
--
